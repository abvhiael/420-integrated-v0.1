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
