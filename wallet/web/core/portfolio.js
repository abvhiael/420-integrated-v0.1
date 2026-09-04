import { decodeString, decodeUint, encodeBalanceOf, encodeDecimals, encodeSymbol, normalizeAddress } from './abi.js';

const MAX_TOKEN_SYMBOL_LENGTH = 32;

function hexToBigInt(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) throw new Error(`invalid ${label}`);
  return BigInt(value);
}

function normalizeDecimals(value) {
  const decimals = Number(value);
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 255) throw new Error('invalid token decimals');
  return decimals;
}

function normalizeSymbol(value) {
  const raw = String(value ?? '');
  if (/[\u0000-\u001f\u007f]/.test(raw)) throw new Error('invalid token symbol');
  const symbol = raw.trim();
  if (!symbol || symbol.length > MAX_TOKEN_SYMBOL_LENGTH) throw new Error('invalid token symbol');
  return symbol;
}

export async function readNetwork(provider, expectedChainId = null) {
  const [chainId, blockNumber] = await Promise.all([
    provider.request('eth_chainId'),
    provider.request('eth_blockNumber'),
  ]);
  if (typeof chainId !== 'string' || !/^0x[0-9a-fA-F]+$/.test(chainId)) throw new Error('invalid chain id');
  const normalizedChainId = chainId.toLowerCase();
  const expected = expectedChainId?.toLowerCase() || null;
  return {
    healthy: true,
    chainId: normalizedChainId,
    blockNumber: hexToBigInt(blockNumber, 'block number'),
    expectedChainId: expected,
    chainMismatch: Boolean(expected && normalizedChainId !== expected),
  };
}

export async function readNativeBalance(provider, address) {
  const normalized = normalizeAddress(address);
  const raw = await provider.request('eth_getBalance', [normalized, 'latest']);
  return { address: normalized, raw: hexToBigInt(raw, 'native balance'), decimals: 18, symbol: '420' };
}

async function call(provider, to, data) {
  return provider.request('eth_call', [{ to: normalizeAddress(to), data }, 'latest']);
}

export async function readErc20Balance(provider, asset, address) {
  if (!asset?.address) throw new Error('tracked asset address required');
  const token = normalizeAddress(asset.address);
  const account = normalizeAddress(address);
  const [balanceRaw, decimalsRaw, symbolRaw] = await Promise.all([
    call(provider, token, encodeBalanceOf(account)),
    asset.decimals == null ? call(provider, token, encodeDecimals()) : null,
    asset.symbol ? null : call(provider, token, encodeSymbol()),
  ]);
  const decimals = normalizeDecimals(asset.decimals == null ? decodeUint(decimalsRaw) : asset.decimals);
  const symbol = normalizeSymbol(asset.symbol || decodeString(symbolRaw));
  return {
    address: token,
    account,
    raw: decodeUint(balanceRaw),
    decimals,
    symbol,
  };
}

export async function readPortfolio(provider, addresses, trackedAssets = []) {
  const uniqueAddresses = [...new Set(addresses.filter(Boolean).map(normalizeAddress))];
  const native = await Promise.all(uniqueAddresses.map((address) => readNativeBalance(provider, address)));
  const tokens = [];
  for (const asset of trackedAssets) {
    for (const address of uniqueAddresses) {
      tokens.push(await readErc20Balance(provider, asset, address));
    }
  }
  return { native, tokens };
}

export function formatUnits(raw, decimals = 18, precision = 6) {
  raw = BigInt(raw);
  decimals = normalizeDecimals(decimals);
  if (!Number.isInteger(precision) || precision < 0 || precision > 255) throw new Error('invalid display precision');
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = (raw % base).toString().padStart(decimals, '0').slice(0, precision).replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
