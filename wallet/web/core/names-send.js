import { normalizeAddress, normalizeBytes32, ZERO_ADDRESS, ZERO_BYTES32 } from './abi.js';

// The registry stores hashes of ASCII labels, not display names. Hashing and
// querying must be performed by a separately qualified canonical Names client.
export function normalize420Name(input) {
  if (typeof input !== 'string') throw new Error('invalid 420 Name');
  const text = input.trim();
  if (!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.420$/.test(text)) {
    throw new Error('invalid 420 Name: use a lowercase ASCII label ending in .420');
  }
  return text;
}

export function validateNamesRecord(record, { nowSeconds, expectedLabelHash } = {}) {
  if (!record || typeof record !== 'object') throw new Error('420 Name resolution unavailable');
  if (expectedLabelHash === undefined) throw new Error('420 Name hash not verified');
  const hash = normalizeBytes32(expectedLabelHash);
  if (hash === ZERO_BYTES32) throw new Error('420 Name hash not verified');
  if (record.labelHash !== undefined && normalizeBytes32(record.labelHash) !== hash) {
    throw new Error('420 Name hash mismatch');
  }
  const owner = normalizeAddress(record.owner);
  const recipient = normalizeAddress(record.resolvedAddress);
  if (owner === ZERO_ADDRESS || recipient === ZERO_ADDRESS) throw new Error('420 Name is unregistered or has no recipient');
  const expiry = BigInt(record.expiresAt);
  if (expiry <= 0n) throw new Error('420 Name has expired');
  if (!Number.isSafeInteger(nowSeconds) || nowSeconds < 0) throw new Error('trusted chain time unavailable');
  if (expiry <= BigInt(nowSeconds)) throw new Error('420 Name has expired');
  const length = Number(record.labelLength);
  if (!Number.isInteger(length) || length < 1 || length > 63) throw new Error('invalid 420 Name record');
  return Object.freeze({ labelHash: hash, owner, recipient, expiresAt: expiry, labelLength: length });
}

export async function confirm420NameRecipient({ name, lookup, chainTime, confirm }) {
  const normalizedName = normalize420Name(name);
  if (typeof lookup !== 'function' || typeof chainTime !== 'function' || typeof confirm !== 'function') {
    throw new Error('canonical 420 Names resolution and confirmation are required');
  }
  const first = await lookup(normalizedName);
  if (!first?.labelHash) throw new Error('420 Name hash not verified');
  const initial = validateNamesRecord(first.record, {
    nowSeconds: await chainTime(), expectedLabelHash: first.labelHash,
  });
  if (initial.labelLength !== normalizedName.slice(0, -4).length) throw new Error('420 Name label length mismatch');
  const accepted = await confirm({ name: normalizedName, recipient: initial.recipient, expiresAt: initial.expiresAt });
  if (accepted !== true) throw new Error('420 Name recipient was not confirmed');
  // A second canonical lookup catches re-registration, transfer and retargeting
  // between the user's review and preparation of transaction calldata.
  const second = await lookup(normalizedName);
  if (normalizeBytes32(second?.labelHash) !== initial.labelHash) throw new Error('420 Name changed during confirmation');
  const current = validateNamesRecord(second.record, {
    nowSeconds: await chainTime(), expectedLabelHash: initial.labelHash,
  });
  if (current.recipient !== initial.recipient || current.owner !== initial.owner || current.expiresAt !== initial.expiresAt) {
    throw new Error('420 Name changed during confirmation');
  }
  return Object.freeze({ name: normalizedName, recipient: initial.recipient, labelHash: initial.labelHash });
}
