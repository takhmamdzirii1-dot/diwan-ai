// Optional first-party browser-key continuity. Clearing site storage removes it.
const DATABASE = 'vantra-device-v1';

function storedKey(): Promise<CryptoKeyPair | null> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onupgradeneeded = () => open.result.createObjectStore('keys');
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const get = db.transaction('keys', 'readonly').objectStore('keys').get('continuity');
      get.onsuccess = () => { resolve((get.result as CryptoKeyPair | undefined) ?? null); db.close(); };
      get.onerror = () => { reject(get.error); db.close(); };
    };
  });
}

function saveKey(key: CryptoKeyPair): Promise<void> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open(DATABASE, 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      const transaction = db.transaction('keys', 'readwrite');
      transaction.objectStore('keys').put(key, 'continuity');
      transaction.oncomplete = () => { resolve(); db.close(); };
      transaction.onerror = () => { reject(transaction.error); db.close(); };
    };
  });
}

function base64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), (character) => character.charCodeAt(0));
}

export async function enrollFreeDeviceKey(): Promise<string | null> {
  if (!globalThis.crypto?.subtle || !globalThis.indexedDB) return null;
  try {
    let key = await storedKey();
    if (!key) {
      key = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
      await saveKey(key);
    }
    const challengeResponse = await fetch('/api/studio/device-key', { cache: 'no-store' });
    if (!challengeResponse.ok) return null;
    const challenge = await challengeResponse.json() as { challenge: string; expires: number; mac: string };
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' },
      key.privateKey, fromBase64url(challenge.challenge).buffer as ArrayBuffer);
    const publicKey = await crypto.subtle.exportKey('spki', key.publicKey);
    const response = await fetch('/api/studio/device-key', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...challenge, publicKey: base64url(new Uint8Array(publicKey)),
        signature: base64url(new Uint8Array(signature)) }),
    });
    if (!response.ok) return null;
    const result = await response.json() as { freeEligibility?: string | null };
    return result.freeEligibility ?? null;
  } catch {
    // Installation cookie and existing Free assessment remain authoritative.
    return null;
  }
}
