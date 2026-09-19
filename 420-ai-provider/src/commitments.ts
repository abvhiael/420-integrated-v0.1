import { keccak256, toUtf8Bytes } from 'ethers';
import type { Hex32 } from './types.js';

function sortValue420(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue420);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, sortValue420(v)])
    );
  }
  return value;
}

export function canonicalJson420(value: unknown): string {
  return JSON.stringify(sortValue420(value));
}

export function bytesCommitment420(bytes: Uint8Array): Hex32 {
  return keccak256(bytes) as Hex32;
}

export function objectCommitment420(value: unknown): Hex32 {
  return keccak256(toUtf8Bytes(canonicalJson420(value))) as Hex32;
}

export function assertHex32420(value: string, label: string): asserts value is Hex32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32`);
}
