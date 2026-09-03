const SELECTORS = Object.freeze({
  createAccount: '4003f6ba',
  getAddress: '49d27e27',
  owner: '8da5cb5b',
  recoveryAuthority: '8a957938',
  authorizationEpoch: '6d5f87be',
  authorizationPolicyVersion: '7d5366f4',
  pendingRecoveryOwner: 'e5f1af38',
  recoveryExecutableAt: '93261b5b',
  entryPoint: 'b0d691fe',
  capabilityRegistry: 'c9de3b48',
  balanceOf: '70a08231',
  decimals: '313ce567',
  symbol: '95d89b41',
});

export const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
export const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

export function normalizeAddress(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw new Error('invalid address');
  return value.toLowerCase();
}

export function normalizeBytes32(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid bytes32');
  return value.toLowerCase();
}

function word(hex) {
  return hex.replace(/^0x/, '').padStart(64, '0');
}

function encodeFactoryArgs(owner, recoveryAuthority, salt) {
  return `${word(normalizeAddress(owner))}${word(normalizeAddress(recoveryAuthority))}${normalizeBytes32(salt).slice(2)}`;
}

export function encodeCreateAccount(owner, recoveryAuthority, salt) {
  return `0x${SELECTORS.createAccount}${encodeFactoryArgs(owner, recoveryAuthority, salt)}`;
}

export function encodeGetAddress(owner, recoveryAuthority, salt) {
  return `0x${SELECTORS.getAddress}${encodeFactoryArgs(owner, recoveryAuthority, salt)}`;
}

export function encodeAddressGetter(name) {
  const selector = SELECTORS[name];
  if (!selector) throw new Error(`unknown address getter ${name}`);
  return `0x${selector}`;
}

export function encodeUintGetter(name) {
  const selector = SELECTORS[name];
  if (!selector) throw new Error(`unknown uint getter ${name}`);
  return `0x${selector}`;
}

export function encodeBalanceOf(address) {
  return `0x${SELECTORS.balanceOf}${word(normalizeAddress(address))}`;
}

export function encodeDecimals() { return `0x${SELECTORS.decimals}`; }
export function encodeSymbol() { return `0x${SELECTORS.symbol}`; }

export function decodeAddress(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error('invalid ABI address result');
  return normalizeAddress(`0x${result.slice(-40)}`);
}

export function decodeUint(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error('invalid ABI uint result');
  return BigInt(result);
}

export function decodeString(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(result)) throw new Error('invalid ABI string result');
  const hex = result.slice(2);
  if (hex.length === 64) {
    const bytes = hex.match(/.{2}/g) || [];
    return new TextDecoder().decode(Uint8Array.from(bytes.map((x) => parseInt(x, 16)))).replace(/\0+$/, '');
  }
  if (hex.length < 128) return '';
  const offset = Number(BigInt(`0x${hex.slice(0, 64)}`)) * 2;
  const length = Number(BigInt(`0x${hex.slice(offset, offset + 64)}`));
  const data = hex.slice(offset + 64, offset + 64 + length * 2);
  const bytes = data.match(/.{2}/g) || [];
  return new TextDecoder().decode(Uint8Array.from(bytes.map((x) => parseInt(x, 16))));
}
