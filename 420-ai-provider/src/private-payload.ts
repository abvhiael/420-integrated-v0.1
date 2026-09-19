import { createCipheriv, createDecipheriv, randomBytes, timingSafeEqual } from 'node:crypto';
import { bytesCommitment420 } from './commitments.js';
import type { Hex32, PayloadPort420 } from './types.js';

const ID = /^0x[0-9a-fA-F]{64}$/;
const REF = /^420ai:private:v1:([0-9a-f]{64})$/;
const AAD_SCHEMA = '420-ai-private-object-v1';

/** The actual object store and key release service MUST independently authenticate callers.
 * Neither the payload reference nor this provider-side adapter is an access token. */
export interface EncryptedObjectStore420 {
  putOnce(objectId: string, ciphertext: Uint8Array): Promise<void>;
  get(objectId: string): Promise<Uint8Array>;
}
export interface PayloadKeyService420 {
  /** Release only to the authorized provider/job under the canonical privacy policy. */
  release(input: { jobId: Hex32; providerId: Hex32; objectId: string; purpose: 'input' | 'output'; expiresAtMs: number }): Promise<Uint8Array>;
}
export interface PayloadAccess420 {
  authorize(input: { jobId: Hex32; providerId: Hex32; purpose: 'input' | 'output'; objectId: string }): Promise<boolean>;
}
export interface PrivatePayloadContext420 {
  jobId: Hex32;
  providerId: Hex32;
  expiresAtMs: number;
  /** The input commitment must be independently loaded from the canonical request. */
  expectedInputCommitment: Hex32;
  maxBytes: number;
}

function hexId(value: string, name: string): Hex32 {
  if (!ID.test(value) || /^0x0{64}$/i.test(value)) throw new Error(`invalid ${name}`);
  return value.toLowerCase() as Hex32;
}
function bytes32Equal(a: string, b: string): boolean {
  if (!ID.test(a) || !ID.test(b)) return false;
  return timingSafeEqual(Buffer.from(a.slice(2), 'hex'), Buffer.from(b.slice(2), 'hex'));
}
function key32(key: Uint8Array): Buffer {
  if (!(key instanceof Uint8Array) || key.byteLength !== 32) throw new Error('key service did not release a 256-bit key');
  return Buffer.from(key);
}
function payloadSize(data: Uint8Array, maxBytes: number): void {
  if (!(data instanceof Uint8Array) || data.byteLength === 0 || data.byteLength > maxBytes) throw new Error('payload size outside configured limits');
}
function aad(context: PrivatePayloadContext420, objectId: string, purpose: string): Buffer {
  return Buffer.from([AAD_SCHEMA, context.jobId.toLowerCase(), context.providerId.toLowerCase(), objectId, purpose].join('|'));
}

/** AES-256-GCM encrypted, job-scoped PayloadPort420. The store accepts opaque IDs,
 * not HTTP URLs, file paths, redirects, or caller-selected object names. */
export class PrivatePayload420 implements PayloadPort420 {
  constructor(
    readonly context: PrivatePayloadContext420,
    readonly store: EncryptedObjectStore420,
    readonly keys: PayloadKeyService420,
    readonly access: PayloadAccess420,
    readonly clock: () => number = Date.now
  ) {
    hexId(context.jobId, 'jobId'); hexId(context.providerId, 'providerId');
    hexId(context.expectedInputCommitment, 'expectedInputCommitment');
    if (!Number.isSafeInteger(context.expiresAtMs) || context.expiresAtMs <= clock()) throw new Error('payload capability expired');
    if (!Number.isSafeInteger(context.maxBytes) || context.maxBytes < 1 || context.maxBytes > 32 * 1024 * 1024) throw new Error('invalid payload size limit');
  }
  private async authorize(objectId: string, purpose: 'input' | 'output'): Promise<Buffer> {
    if (this.clock() >= this.context.expiresAtMs) throw new Error('payload capability expired');
    if (!(await this.access.authorize({jobId:this.context.jobId,providerId:this.context.providerId,purpose,objectId}))) throw new Error('payload access denied');
    return key32(await this.keys.release({jobId:this.context.jobId,providerId:this.context.providerId,purpose,objectId,expiresAtMs:this.context.expiresAtMs}));
  }
  async get(ref: string): Promise<Uint8Array> {
    const match = REF.exec(ref);
    if (!match) throw new Error('invalid opaque payload reference');
    const objectId = match[1]!;
    const key = await this.authorize(objectId, 'input');
    try {
      const envelope = Buffer.from(await this.store.get(objectId));
      if (envelope.byteLength < 1 + 12 + 16 || envelope[0] !== 1 || envelope.byteLength > this.context.maxBytes + 29) throw new Error('invalid encrypted payload envelope');
      const nonce = envelope.subarray(1, 13), tag = envelope.subarray(13, 29), body = envelope.subarray(29);
      const decipher = createDecipheriv('aes-256-gcm', key, nonce);
      decipher.setAAD(aad(this.context, objectId, 'input'));
      decipher.setAuthTag(tag);
      const plaintext = Buffer.concat([decipher.update(body), decipher.final()]);
      payloadSize(plaintext, this.context.maxBytes);
      if (!bytes32Equal(bytesCommitment420(plaintext), this.context.expectedInputCommitment)) throw new Error('canonical input commitment mismatch');
      return plaintext;
    } finally { key.fill(0); }
  }
  async put(bytes: Uint8Array, contentType: string): Promise<string> {
    if (contentType !== 'application/octet-stream') throw new Error('only binary private outputs supported');
    payloadSize(bytes, this.context.maxBytes);
    const objectId = randomBytes(32).toString('hex');
    const key = await this.authorize(objectId, 'output');
    try {
      const nonce = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      cipher.setAAD(aad(this.context, objectId, 'output'));
      const ciphertext = Buffer.concat([cipher.update(bytes), cipher.final()]);
      await this.store.putOnce(objectId, Buffer.concat([Buffer.from([1]), nonce, cipher.getAuthTag(), ciphertext]));
      return `420ai:private:v1:${objectId}`;
    } finally { key.fill(0); }
  }
}
