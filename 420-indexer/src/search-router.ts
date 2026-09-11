export type SearchKind420 = 'block_number' | 'hash' | 'address' | 'protocol_object' | 'unknown';

export interface SearchRoute420 {
  kind: SearchKind420;
  normalized: string;
}

const HEX_40 = /^0x[0-9a-f]{40}$/;
const HEX_64 = /^0x[0-9a-f]{64}$/;
const DECIMAL = /^\d+$/;
const PROTOCOL_OBJECT = /^[a-zA-Z][a-zA-Z0-9_-]*:[^\s]+$/;

export function classifySearch420(term: string): SearchRoute420 {
  const normalized = term.trim().toLowerCase();
  if (!normalized) return { kind: 'unknown', normalized };
  if (DECIMAL.test(normalized)) return { kind: 'block_number', normalized };
  if (HEX_40.test(normalized)) return { kind: 'address', normalized };
  if (HEX_64.test(normalized)) return { kind: 'hash', normalized };
  if (PROTOCOL_OBJECT.test(normalized)) return { kind: 'protocol_object', normalized };
  return { kind: 'unknown', normalized };
}
