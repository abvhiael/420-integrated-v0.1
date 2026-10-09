import { createHash, randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { verifyMessage, getAddress } from 'ethers';
import sharp from 'sharp';

export class Fault extends Error {
  constructor(code, status = 400) { super(code); this.code = code; this.status = status; }
}
export function requireThat(ok, code, status = 400) { if (!ok) throw new Fault(code, status); }
export const hash = value => createHash('sha256').update(value).digest('hex');
export const id = () => randomBytes(32).toString('hex');
export function wallet(value) {
  try { return getAddress(value).toLowerCase(); } catch { throw new Fault('invalid_wallet'); }
}
export function bytes32(value) { requireThat(/^0x[0-9a-f]{64}$/.test(value) && !/^0x0{64}$/.test(value), 'invalid_bytes32'); return value; }
export function text(value, max = 2000) {
  requireThat(typeof value === 'string' && value.length <= max && !/[<>\u0000-\u001f\u007f]/.test(value), 'invalid_text');
  return value.trim();
}
export function integer(value, min, max) { requireThat(Number.isSafeInteger(value) && value >= min && value <= max, 'invalid_integer'); return value; }
export function quantity(value) { requireThat(typeof value === 'string' && /^[1-9][0-9]{0,76}$/.test(value) && BigInt(value) < 2n ** 256n, 'invalid_quantity'); return value; }
export function keys(value, allowed) { requireThat(value && !Array.isArray(value) && typeof value === 'object' && Object.keys(value).every(key => allowed.includes(key)), 'unknown_field'); }

export function signingMessage({ origin, chainId, address, nonce, expiresAt, method, path, bodyHash }) {
  return ['420Commerce request v1', `Origin: ${origin}`, `Chain: ${chainId}`, `Wallet: ${address}`, `Nonce: ${nonce}`, `Expires: ${expiresAt}`, `Method: ${method}`, `Path: ${path}`, `Body-SHA256: ${bodyHash}`].join('\n');
}
export class RequestAuth {
  constructor(database, { origin, chainId, now = Date.now, verifyContractSignature = null }) { this.db = database; this.origin = origin; this.chainId = chainId; this.now = now; this.verifyContractSignature = verifyContractSignature; }
  challenge(address) {
    address = wallet(address);
    const expiresAt = this.now() + 120000, nonce = id();
    this.db.run('DELETE FROM auth_nonces WHERE expires_at<?', this.now());
    requireThat(this.db.get('SELECT COUNT(*) AS n FROM auth_nonces').n < 10000, 'nonce_capacity', 429);
    this.db.run('INSERT INTO auth_nonces(nonce,wallet,expires_at) VALUES(?,?,?)', nonce, address, expiresAt);
    return { nonce, expiresAt, address, chainId: this.chainId, origin: this.origin };
  }
  authenticate(headers, method, path, body, origin) {
    requireThat(origin === this.origin, 'origin_mismatch', 403);
    const nonce = headers['x-commerce-nonce'], address = wallet(headers['x-commerce-wallet']);
    const record = this.db.get('SELECT * FROM auth_nonces WHERE nonce=?', nonce ?? '');
    requireThat(record && !record.used && record.wallet === address && record.expires_at > this.now(), 'invalid_nonce', 401);
    const message = signingMessage({ origin, chainId: this.chainId, address, nonce, expiresAt: record.expires_at, method, path, bodyHash: hash(body) });
    let recovered;
    try { recovered = wallet(verifyMessage(message, headers['x-commerce-signature'])); } catch { recovered = null; }
    const consume = verified => {
      requireThat(verified, 'invalid_signature', 401);
      requireThat(this.db.run('UPDATE auth_nonces SET used=1 WHERE nonce=? AND used=0 AND expires_at>?', nonce, this.now()).changes === 1, 'nonce_replay', 401);
      return address;
    };
    if(recovered === address) return consume(true);
    requireThat(this.verifyContractSignature && typeof headers['x-commerce-signature']==='string' && /^0x(?:[0-9a-fA-F]{2}){1,4096}$/.test(headers['x-commerce-signature']), 'invalid_signature', 401);
    return Promise.resolve(this.verifyContractSignature(address,message,headers['x-commerce-signature'])).then(consume);
  }
}

// Never fetch URLs, interpret SVG/HTML or preserve EXIF/GPS. Decode only bounded
// JPEG/PNG/WebP and re-encode into an inert PNG; SQLite holds the public bytes.
export async function safeMedia(data, mime) {
  requireThat(Buffer.isBuffer(data) && data.length > 0 && data.length <= 5 * 1024 * 1024, 'media_size', 413);
  const formats = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/webp': 'webp' };
  requireThat(Object.hasOwn(formats, mime), 'media_type');
  const magic = mime==='image/png' ? data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) : mime==='image/jpeg' ? data[0]===255&&data[1]===216&&data[2]===255 : data.subarray(0,4).toString()==='RIFF'&&data.subarray(8,12).toString()==='WEBP';
  requireThat(magic,'media_magic');
  requireThat(mime!=='image/png'||!data.includes(Buffer.from('acTL')),'animated_media');
  try {
    const input = sharp(data, { limitInputPixels: 16000000, animated: false, failOn: 'warning' }).timeout({ seconds: 5 });
    const meta = await input.metadata();
    requireThat(meta.format === formats[mime] && meta.width <= 4096 && meta.height <= 4096 && (meta.pages ?? 1) === 1, 'media_dimensions');
    const output = await input.rotate().png().toBuffer();
    requireThat(output.length <= 5 * 1024 * 1024, 'media_size', 413);
    return output;
  } catch (error) { if (error instanceof Fault) throw error; throw new Fault('invalid_media'); }
}
export function encryptDelivery(key, order, store, value) {
  requireThat(Buffer.isBuffer(key) && key.length === 32, 'private_storage_unavailable', 503);
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(`${order}:${store}`));
  return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]);
}
export function decryptDelivery(key, order, store, value) {
  const decipher = createDecipheriv('aes-256-gcm', key, value.subarray(0, 12));
  decipher.setAAD(Buffer.from(`${order}:${store}`)); decipher.setAuthTag(value.subarray(-16));
  return Buffer.concat([decipher.update(value.subarray(12, -16)), decipher.final()]).toString('utf8');
}
