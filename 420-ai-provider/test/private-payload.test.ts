import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { bytesCommitment420 } from '../src/commitments.js';
import { PrivatePayload420 } from '../src/private-payload.js';

const jobId = ('0x' + '11'.repeat(32)) as `0x${string}`;
const providerId = ('0x' + '22'.repeat(32)) as `0x${string}`;
const input = Buffer.from('a private input');
const objectId = 'aa'.repeat(32);
const key = randomBytes(32);
const stored = new Map<string, Uint8Array>();
let allow = true;
let now = 1000;
const store = {
  async putOnce(id: string, bytes: Uint8Array) { if (stored.has(id)) throw new Error('already stored'); stored.set(id, bytes); },
  async get(id: string) { const bytes = stored.get(id); if (!bytes) throw new Error('object not found'); return bytes; }
};
const keys = { async release() { return Buffer.from(key); } };
const access = { async authorize() { return allow; } };
function adapter(commitment = bytesCommitment420(input)) {
  return new PrivatePayload420({ jobId, providerId, expectedInputCommitment: commitment, maxBytes: 1024, expiresAtMs: 3000 }, store, keys, access, () => now);
}
function provisionInput(bytes: Uint8Array, id = objectId) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(['420-ai-private-object-v1', jobId, providerId, id, 'input'].join('|')));
  const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
  stored.set(id, Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]));
}

test('decrypts authenticated job-bound input and validates canonical commitment', async () => {
  provisionInput(input);
  assert.deepEqual(await adapter().get(`420ai:private:v1:${objectId}`), input);
});
test('rejects unknown URLs, corrupted AEAD tags and mismatched canonical commitments', async () => {
  await assert.rejects(adapter().get('https://example.com/private'), /opaque payload reference/);
  provisionInput(input);
  const corrupt = Buffer.from(stored.get(objectId)!); corrupt[15] ^= 1; stored.set(objectId, corrupt);
  await assert.rejects(adapter().get(`420ai:private:v1:${objectId}`));
  provisionInput(input);
  await assert.rejects(adapter(('0x' + '33'.repeat(32)) as `0x${string}`).get(`420ai:private:v1:${objectId}`), /canonical input commitment mismatch/);
});
test('rejects unauthorized, expired and oversized input', async () => {
  provisionInput(input);
  allow = false;
  await assert.rejects(adapter().get(`420ai:private:v1:${objectId}`), /access denied/);
  allow = true;
  now = 3000;
  try {
    // An expired capability is rejected synchronously when the adapter is constructed.
    assert.throws(() => adapter(), /expired/);
  } finally {
    now = 1000;
  }
  assert.throws(() => new PrivatePayload420({jobId,providerId,expectedInputCommitment:bytesCommitment420(input),maxBytes:0,expiresAtMs:3000},store,keys,access,()=>now), /size limit/);
});
test('encrypts output under unpredictable opaque object reference; rejects unsupported content types', async () => {
  const a = adapter();
  const ref = await a.put(Buffer.from('private output'), 'application/octet-stream');
  assert.match(ref, /^420ai:private:v1:[0-9a-f]{64}$/);
  assert.equal(stored.get(ref.split(':').at(-1)!)?.[0], 1);
  assert.equal(Buffer.from(stored.get(ref.split(':').at(-1)!)!).includes(Buffer.from('private output')), false);
  await assert.rejects(a.put(Buffer.from('private output'), 'text/plain'), /binary private outputs/);
});
