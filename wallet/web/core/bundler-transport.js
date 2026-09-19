import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { normalizeCallData } from './execution.js';

const HASH = /^0x[0-9a-fA-F]{64}$/;
const QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;

function normalizeHash(value) {
  if (typeof value !== 'string' || !HASH.test(value)) throw new Error('invalid Bundler UserOperation hash');
  return value.toLowerCase();
}

function quantity(value) {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error('Bundler quantity outside uint256 range');
  return `0x${parsed.toString(16)}`;
}

export function serializeBundlerUserOperation(operation) {
  if (!operation || typeof operation !== 'object') throw new Error('signed UserOperation required');
  const signature = normalizeCallData(operation.signature);
  if (signature === '0x') throw new Error('signed UserOperation required');
  return {
    sender: normalizeAddress(operation.sender),
    nonce: quantity(operation.nonce),
    initCode: normalizeCallData(operation.initCode ?? '0x'),
    callData: normalizeCallData(operation.callData ?? '0x'),
    accountGasLimits: normalizeBytes32(operation.accountGasLimits),
    preVerificationGas: quantity(operation.preVerificationGas),
    gasFees: normalizeBytes32(operation.gasFees),
    paymasterAndData: normalizeCallData(operation.paymasterAndData ?? '0x'),
    signature,
  };
}

export function validateBundlerEndpoints(endpoints) {
  if (!Array.isArray(endpoints) || endpoints.length === 0 || endpoints.length > 8) throw new Error('1–8 Bundler endpoints required');
  const seen = new Set();
  return endpoints.map((raw) => {
    if (typeof raw !== 'string') throw new Error('Bundler endpoint must be a URL');
    const url = new URL(raw);
    const local = url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (url.protocol !== 'https:' && !local) throw new Error('Bundler endpoint requires HTTPS outside localhost');
    if (url.username || url.password || url.hash || url.search) throw new Error('Bundler endpoint must not contain credentials, query or fragment');
    const canonical = url.href;
    if (seen.has(canonical)) throw new Error('duplicate Bundler endpoint');
    seen.add(canonical);
    return canonical;
  });
}

async function rpc(endpoint, method, params, fetcher, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error('Bundler provider unavailable');
    const body = await response.json();
    if (!body || body.jsonrpc !== '2.0' || body.id !== 1 || Object.prototype.hasOwnProperty.call(body, 'error')) {
      throw new Error('Bundler RPC rejected request');
    }
    if (!Object.prototype.hasOwnProperty.call(body, 'result')) throw new Error('Bundler RPC result missing');
    return body.result;
  } finally {
    clearTimeout(timer);
  }
}

export async function selectBundlerProvider(endpoints, entryPoint, options = {}) {
  const urls = validateBundlerEndpoints(endpoints);
  const expected = normalizeAddress(entryPoint);
  const fetcher = options.fetcher ?? globalThis.fetch;
  if (typeof fetcher !== 'function') throw new Error('Bundler HTTP transport unavailable');
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 30000) throw new Error('invalid Bundler timeout');
  const failures = [];
  for (const endpoint of urls) {
    try {
      const supported = await rpc(endpoint, 'eth_supportedEntryPoints', [], fetcher, timeoutMs);
      if (!Array.isArray(supported) || !supported.some((value) => normalizeAddress(value) === expected)) throw new Error('Bundler EntryPoint mismatch');
      return { endpoint, fetcher, timeoutMs, entryPoint: expected };
    } catch (error) {
      failures.push({ endpoint, reason: error?.message || 'provider unavailable' });
    }
  }
  throw new AggregateError(failures.map((failure) => new Error(failure.reason)), 'No qualified Bundler provider available');
}

export async function sendBundlerUserOperation(selected, operation, expectedHash) {
  if (!selected?.endpoint || !selected?.entryPoint) throw new Error('qualified Bundler provider required');
  const expected = normalizeHash(expectedHash);
  const signed = serializeBundlerUserOperation(operation);
  // The provider is selected before submission. An uncertain send error MUST NOT trigger
  // automatic failover: the first operator might already have accepted the operation.
  const returned = await rpc(selected.endpoint, 'eth_sendUserOperation', [signed, selected.entryPoint], selected.fetcher, selected.timeoutMs);
  if (normalizeHash(returned) !== expected) throw new Error('Bundler returned a different canonical UserOperation hash');
  return { userOpHash: expected, bundlerEndpoint: selected.endpoint, transport: 'bundler', submitted: true };
}

export async function readBundlerUserOperationReceipt(selected, expectedHash) {
  if (!selected?.endpoint) throw new Error('qualified Bundler provider required');
  const expected = normalizeHash(expectedHash);
  const receipt = await rpc(selected.endpoint, 'eth_getUserOperationReceipt', [expected], selected.fetcher, selected.timeoutMs);
  if (receipt === null) return null;
  if (!receipt || normalizeHash(receipt.userOpHash) !== expected || normalizeAddress(receipt.entryPoint) !== selected.entryPoint || !HASH.test(receipt.transactionHash) || !HASH.test(receipt.blockHash) || typeof receipt.blockNumber !== 'string' || !QUANTITY.test(receipt.blockNumber) || receipt.lifecycle !== 'included' || typeof receipt.success !== 'boolean') {
    throw new Error('malformed or mismatched Bundler inclusion evidence');
  }
  return { ...receipt, userOpHash: expected, transactionHash: receipt.transactionHash.toLowerCase(), blockHash: receipt.blockHash.toLowerCase() };
}
