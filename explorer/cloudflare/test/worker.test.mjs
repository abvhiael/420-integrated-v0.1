import test from 'node:test';
import assert from 'node:assert/strict';
import worker, { validatedOrigin } from '../src/worker.mjs';

test('validatedOrigin requires https and rejects loopback', () => {
  assert.equal(validatedOrigin('https://origin.example').origin, 'https://origin.example');
  assert.throws(() => validatedOrigin('http://origin.example'), /must use https/);
  assert.throws(() => validatedOrigin('https://127.0.0.1:8420'), /loopback/);
});

test('static assets are served through ASSETS with security headers', async () => {
  const env = {
    ASSETS: {
      fetch: async () => new Response('ok', { headers: {'content-type':'text/html'} })
    }
  };
  const response = await worker.fetch(new Request('https://explorer.420integrated.org/'), env);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match(response.headers.get('content-security-policy'), /connect-src 'self'/);
});

test('API fails closed when origin is absent', async () => {
  const env = { ASSETS: { fetch: async () => new Response('unused') } };
  const response = await worker.fetch(new Request('https://explorer.420integrated.org/v1/status'), env);
  assert.equal(response.status, 503);
  const body = await response.json();
  assert.equal(body.code, 'ORIGIN_NOT_CONFIGURED');
});

test('API rejects mutation methods before proxying', async () => {
  const env = { EXPLORER_ORIGIN:'https://origin.example', ASSETS:{fetch:async()=>new Response('unused')} };
  const response = await worker.fetch(new Request('https://explorer.420integrated.org/v1/status',{method:'POST'}), env);
  assert.equal(response.status, 405);
});

test('API proxy preserves path/query, strips credentials and disables caching', async () => {
  const originalFetch = globalThis.fetch;
  let seen;
  globalThis.fetch = async (request) => {
    seen = request;
    return new Response(JSON.stringify({ready:true}), {
      status:200,
      headers:{'content-type':'application/json','set-cookie':'should-not-pass'}
    });
  };
  try {
    const env = { EXPLORER_ORIGIN:'https://origin.example/base', ASSETS:{fetch:async()=>new Response('unused')} };
    const request = new Request('https://explorer.420integrated.org/v1/status?probe=1', {
      headers:{authorization:'Bearer no',cookie:'session=no'}
    });
    const response = await worker.fetch(request, env);
    assert.equal(response.status, 200);
    assert.equal(seen.url, 'https://origin.example/base/v1/status?probe=1');
    assert.equal(seen.headers.get('authorization'), null);
    assert.equal(seen.headers.get('cookie'), null);
    assert.equal(seen.headers.get('x-420-edge'), 'cloudflare-worker');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal(response.headers.get('set-cookie'), null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
