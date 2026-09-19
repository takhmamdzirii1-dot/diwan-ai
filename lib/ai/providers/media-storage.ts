import 'server-only';

import { createHash, createHmac, randomUUID } from 'node:crypto';

export type TemporaryProviderMedia = {
  kind: 'temporary_provider_url';
  url: string;
  expiresAt: string | null;
  providerOperationId: string;
};

export type PermanentMediaObject = {
  kind: 'permanent_object';
  storageKey: string;
  contentType: string;
  sizeBytes: number | null;
};

export interface PermanentMediaStorage {
  readonly kind: 's3-compatible';
  putObject(input: {
    storageKey: string;
    contentType: string;
    body: Uint8Array;
  }): Promise<PermanentMediaObject>;
  createDirectUploadTarget(input: {
    userId: string;
    modality: 'image' | 'video';
    contentType: string;
  }): Promise<{ storageKey: string; uploadUrl: string; expiresAt: string }>;
  createPrivateReadUrl(storageKey: string): Promise<{ url: string; expiresAt: string }>;
  deleteObject(storageKey: string): Promise<void>;
}

type B2Config = {
  endpoint: URL;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

const encode = (value: string) => encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
  `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
const sha256 = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const hmac = (key: string | Uint8Array, value: string) => createHmac('sha256', key).update(value).digest();
const canonicalKey = (key: string) => key.split('/').map(encode).join('/');

function configuredB2(): B2Config | null {
  const endpointValue = process.env.B2_S3_ENDPOINT?.trim();
  const region = process.env.B2_S3_REGION?.trim();
  const bucket = process.env.B2_S3_BUCKET?.trim();
  const accessKeyId = process.env.B2_S3_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.B2_S3_SECRET_ACCESS_KEY?.trim();
  if (!endpointValue || !region || !bucket || !accessKeyId || !secretAccessKey) return null;
  let endpoint: URL;
  try {
    endpoint = new URL(endpointValue);
  } catch {
    return null;
  }
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password
    || endpoint.search || endpoint.hash || !/^[A-Za-z0-9.-]+$/.test(bucket)) return null;
  endpoint.pathname = endpoint.pathname.replace(/\/$/, '');
  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
}

function signingKey(config: B2Config, date: string) {
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, date);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, 's3');
  return hmac(serviceKey, 'aws4_request');
}

function objectUrl(config: B2Config, storageKey: string) {
  const url = new URL(config.endpoint);
  url.pathname = `${config.endpoint.pathname}/${encode(config.bucket)}/${canonicalKey(storageKey)}`
    .replace(/\/+/g, '/');
  return url;
}

function requestTimestamp() {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  return { amzDate, date: amzDate.slice(0, 8) };
}

function authorization(config: B2Config, input: {
  method: string;
  url: URL;
  contentType?: string;
  payloadHash: string;
  amzDate: string;
  date: string;
}) {
  const headerEntries = [
    ['host', input.url.host],
    ...(input.contentType ? [['content-type', input.contentType]] : []),
    ['x-amz-content-sha256', input.payloadHash],
    ['x-amz-date', input.amzDate],
  ].sort(([left], [right]) => left.localeCompare(right));
  const canonicalHeaders = `${headerEntries.map(([name, value]) => `${name}:${value.trim()}`).join('\n')}\n`;
  const signedHeaders = headerEntries.map(([name]) => name).join(';');
  const canonicalRequest = [
    input.method,
    input.url.pathname,
    '',
    canonicalHeaders,
    signedHeaders,
    input.payloadHash,
  ].join('\n');
  const scope = `${input.date}/${config.region}/s3/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${input.amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
  const signature = createHmac('sha256', signingKey(config, input.date)).update(stringToSign).digest('hex');
  return {
    value: `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    signedHeaders,
  };
}

class B2S3MediaStorage implements PermanentMediaStorage {
  readonly kind = 's3-compatible' as const;
  constructor(private readonly config: B2Config) {}

  async putObject(input: { storageKey: string; contentType: string; body: Uint8Array }) {
    const url = objectUrl(this.config, input.storageKey);
    const payloadHash = sha256(input.body);
    const timestamp = requestTimestamp();
    const auth = authorization(this.config, {
      method: 'PUT', url, contentType: input.contentType, payloadHash, ...timestamp,
    });
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        Authorization: auth.value,
        'Content-Type': input.contentType,
        'Content-Length': String(input.body.byteLength),
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': timestamp.amzDate,
      },
      body: new Blob([input.body as BlobPart], { type: input.contentType }),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error(`MEDIA_STORAGE_UPLOAD_FAILED_${response.status}`);
    return {
      kind: 'permanent_object' as const,
      storageKey: input.storageKey,
      contentType: input.contentType,
      sizeBytes: input.body.byteLength,
    };
  }

  async createDirectUploadTarget(input: {
    userId: string;
    modality: 'image' | 'video';
    contentType: string;
  }) {
    const folder = input.modality === 'image' ? 'images' : 'videos';
    const storageKey = `${input.userId}/${folder}/${randomUUID()}`;
    return {
      storageKey,
      uploadUrl: this.presignedUrl('PUT', storageKey, 300),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  async createPrivateReadUrl(storageKey: string) {
    return {
      url: this.presignedUrl('GET', storageKey, 300),
      expiresAt: new Date(Date.now() + 300_000).toISOString(),
    };
  }

  async deleteObject(storageKey: string) {
    const url = objectUrl(this.config, storageKey);
    const payloadHash = sha256('');
    const timestamp = requestTimestamp();
    const auth = authorization(this.config, {
      method: 'DELETE', url, payloadHash, ...timestamp,
    });
    const response = await fetch(url, {
      method: 'DELETE',
      headers: {
        Authorization: auth.value,
        'x-amz-content-sha256': payloadHash,
        'x-amz-date': timestamp.amzDate,
      },
      cache: 'no-store',
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`MEDIA_STORAGE_DELETE_FAILED_${response.status}`);
    }
  }

  private presignedUrl(method: 'GET' | 'PUT', storageKey: string, expires: number) {
    const url = objectUrl(this.config, storageKey);
    const { amzDate, date } = requestTimestamp();
    const scope = `${date}/${this.config.region}/s3/aws4_request`;
    const parameters = new Map([
      ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
      ['X-Amz-Credential', `${this.config.accessKeyId}/${scope}`],
      ['X-Amz-Date', amzDate],
      ['X-Amz-Expires', String(expires)],
      ['X-Amz-SignedHeaders', 'host'],
    ]);
    const canonicalQuery = [...parameters.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${encode(key)}=${encode(value)}`)
      .join('&');
    const canonicalRequest = [
      method,
      url.pathname,
      canonicalQuery,
      `host:${url.host}\n`,
      'host',
      'UNSIGNED-PAYLOAD',
    ].join('\n');
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256(canonicalRequest)}`;
    const signature = createHmac('sha256', signingKey(this.config, date)).update(stringToSign).digest('hex');
    url.search = `${canonicalQuery}&X-Amz-Signature=${signature}`;
    return url.toString();
  }
}

let storage: PermanentMediaStorage | null | undefined;

export function getPermanentMediaStorage(): PermanentMediaStorage | null {
  if (storage !== undefined) return storage;
  const config = configuredB2();
  storage = config ? new B2S3MediaStorage(config) : null;
  return storage;
}
