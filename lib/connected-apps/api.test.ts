import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { GET, POST, DELETE } from '@/app/api/connected-apps/route';
import { POST as authorize } from '@/app/api/connected-apps/oauth/start/route';
import { GET as callback } from '@/app/api/connected-apps/oauth/callback/route';
import { GET as reviews, POST as review } from '@/app/api/connected-apps/reviews/route';

test('connection API and OAuth start reject unauthenticated users and cross-origin mutations', async () => {
  const base = 'http://localhost:3103';
  const body = JSON.stringify({ appId: 'google_drive' });
  assert.equal((await GET()).status, 401); assert.equal((await reviews()).status, 401);
  for (const handler of [POST, DELETE, authorize, review]) {
    assert.equal((await handler(new Request(`${base}/api/connected-apps`, { method: 'POST', body,
      headers: { Origin: 'https://unrelated.example', 'Content-Type': 'application/json' } }))).status, 403);
    assert.equal((await handler(new Request(`${base}/api/connected-apps`, { method: 'POST', body,
      headers: { Origin: base, 'Content-Type': 'application/json' } }))).status, 401);
  }
});

test('unauthenticated callback never saves a grant; no secrets in redirect', async () => {
  const response = await callback(new NextRequest('http://localhost:3103/api/connected-apps/oauth/callback?code=untrusted-code&state=wrong-state'));
  assert.equal(response.status, 307);
  assert.equal(response.headers.get('location'), 'http://localhost:3103/studio/chat?connected_app_result=failed');
  assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
  assert.ok(!response.headers.get('location')?.includes('untrusted-code'));
  assert.ok(response.headers.get('set-cookie')?.includes('Max-Age=0'));
});
