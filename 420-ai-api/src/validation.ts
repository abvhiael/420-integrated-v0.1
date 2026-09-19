import type { Address420, Hex32 } from './types.js';

export const LIMIT_DEFAULT_420 = 50;
export const LIMIT_MAX_420 = 200;

export function limit420(value?: number): number {
  if (value === undefined) return LIMIT_DEFAULT_420;
  if (!Number.isInteger(value) || value < 1 || value > LIMIT_MAX_420) {
    throw new Error(`limit must be an integer between 1 and ${LIMIT_MAX_420}`);
  }
  return value;
}

export function cursor420(value?: string): string | undefined {
  if (value === undefined) return undefined;
  if (!/^[A-Za-z0-9_-]{1,512}$/.test(value)) throw new Error('invalid cursor');
  return value;
}

export function address420(value?: string): Address420 | undefined {
  if (value === undefined) return undefined;
  if (!/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('invalid address');
  return value.toLowerCase() as Address420;
}

export function hex32420(value: string, label = 'id'): Hex32 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32`);
  return value.toLowerCase() as Hex32;
}

export function enum420<T extends string>(value: string | undefined, allowed: readonly T[], label: string): T | undefined {
  if (value === undefined) return undefined;
  if (!allowed.includes(value as T)) throw new Error(`invalid ${label}`);
  return value as T;
}
