import { normalizeAddress } from './abi.js';

const ERC20_TRANSFER_SELECTOR = 'a9059cbb';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const MAX_AMOUNT_TEXT_LENGTH = 96;

function uintWord(value) {
  const amount = BigInt(value);
  if (amount < 0n || amount >= (1n << 256n)) throw new Error('amount out of uint256 range');
  return amount.toString(16).padStart(64, '0');
}

function addressWord(value) {
  return normalizeAddress(value).slice(2).padStart(64, '0');
}

function assertNonZeroAddress(value, label) {
  const normalized = normalizeAddress(value);
  if (normalized === ZERO_ADDRESS) throw new Error(`${label} cannot be the zero address`);
  return normalized;
}

function normalizeAssetDecimals(value = 18) {
  const decimals = Number(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('invalid asset decimals');
  return decimals;
}

export function parseUnits(value, decimals = 18) {
  decimals = normalizeAssetDecimals(decimals);
  const text = String(value ?? '').trim();
  if (!text || text.length > MAX_AMOUNT_TEXT_LENGTH) throw new Error('amount must be a positive decimal number');
  if (!/^\d+(?:\.\d+)?$/.test(text)) throw new Error('amount must be a positive decimal number');
  const [whole, fraction = ''] = text.split('.');
  if (fraction.length > decimals) throw new Error(`amount has more than ${decimals} decimal places`);
  const units = BigInt(whole) * (10n ** BigInt(decimals)) + BigInt((fraction + '0'.repeat(decimals)).slice(0, decimals) || '0');
  if (units <= 0n) throw new Error('amount must be greater than zero');
  if (units >= (1n << 256n)) throw new Error('amount out of uint256 range');
  return units;
}

export function encodeErc20Transfer(recipient, amount) {
  const to = assertNonZeroAddress(recipient, 'recipient');
  return `0x${ERC20_TRANSFER_SELECTOR}${addressWord(to)}${uintWord(amount)}`;
}

export function buildSendExecution({ recipient, amount, asset }) {
  const to = assertNonZeroAddress(recipient, 'recipient');
  if (!asset || asset.kind === 'native') {
    const units = parseUnits(amount, normalizeAssetDecimals(asset?.decimals ?? 18));
    return {
      request: { target: to, value: units.toString(), data: '0x' },
      summary: { kind: 'native', symbol: asset?.symbol || '420', recipient: to, amount: String(amount).trim(), units },
    };
  }
  if (asset.kind !== 'erc20') throw new Error('unsupported asset kind');
  const token = assertNonZeroAddress(asset.address, 'token address');
  if (token === to) throw new Error('token contract cannot be used as the transfer recipient');
  const units = parseUnits(amount, normalizeAssetDecimals(asset.decimals ?? 18));
  return {
    request: { target: token, value: '0', data: encodeErc20Transfer(to, units) },
    summary: { kind: 'erc20', symbol: asset.symbol || 'TOKEN', recipient: to, token, amount: String(amount).trim(), units },
  };
}
