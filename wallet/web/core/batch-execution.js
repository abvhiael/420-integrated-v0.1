import { decodeAddress, decodeUint, encodeAddressGetter, encodeUintGetter, normalizeAddress } from './abi.js';
import { normalizeCallData, normalizeNativeValue } from './execution.js';
import { discoverSmartAccount } from './accounts.js';

const SELECTOR_EXECUTE_BATCH = '34fcd5be';
export const MAX_BATCH_CALLS = 8;
export const MAX_BATCH_CALLDATA_BYTES = 16384;

function uintWord(value) {
  const amount = BigInt(value);
  if (amount < 0n || amount >= (1n << 256n)) throw new Error('uint256 out of range');
  return amount.toString(16).padStart(64, '0');
}

function addressWord(value) {
  return normalizeAddress(value).slice(2).padStart(64, '0');
}

function bytesTail(data) {
  const normalized = normalizeCallData(data);
  const hex = normalized.slice(2);
  return `${uintWord(hex.length / 2)}${hex.padEnd(Math.ceil(hex.length / 64) * 64, '0')}`;
}

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

function deniedTargets(state) {
  return new Set([
    state.smartAccount,
    state.factoryAddress,
    state.entryPoint,
    state.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
}

export function normalizeBatchCalls(smartAccountState, calls) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before batch execution');
  if (!Array.isArray(calls) || calls.length === 0) throw new Error('batch execution requires at least one call');
  if (calls.length > MAX_BATCH_CALLS) throw new Error(`batch execution exceeds ${MAX_BATCH_CALLS} call wallet limit`);

  const denied = deniedTargets(smartAccountState);
  const seen = new Map();
  const duplicateCallIndexes = [];
  let totalValue = 0n;
  let totalCalldataBytes = 0;
  const normalized = calls.map((call, index) => {
    if (!call || typeof call !== 'object' || Array.isArray(call)) throw new Error(`batch call ${index + 1} must be an object`);
    if (typeof call.target !== 'string' || call.target.length === 0) throw new Error(`batch call ${index + 1} target is required`);
    const target = normalizeAddress(call.target);
    if (denied.has(target)) throw new Error(`batch call ${index + 1} targets a wallet authority contract`);
    const value = normalizeNativeValue(call.value ?? 0n);
    const data = normalizeCallData(call.data ?? '0x');
    totalValue += value;
    if (totalValue >= (1n << 256n)) throw new Error('aggregate batch native value exceeds uint256 range');
    totalCalldataBytes += (data.length - 2) / 2;
    if (totalCalldataBytes > MAX_BATCH_CALLDATA_BYTES) throw new Error(`aggregate batch calldata exceeds ${MAX_BATCH_CALLDATA_BYTES} byte wallet limit`);
    const key = `${target}:${value}:${data}`;
    if (seen.has(key)) duplicateCallIndexes.push([seen.get(key), index]);
    else seen.set(key, index);
    return { target, value, data };
  });
  return { calls: normalized, totalValue, totalCalldataBytes, duplicateCallIndexes };
}

export function encodeExecuteBatch(calls) {
  if (!Array.isArray(calls) || calls.length === 0) throw new Error('batch calls required');
  const tuples = calls.map((call) => {
    const tail = bytesTail(call.data ?? '0x');
    return `${addressWord(call.target)}${uintWord(call.value ?? 0n)}${uintWord(96)}${tail}`;
  });
  const offsets = [];
  let cursorBytes = 32 * calls.length;
  for (const tuple of tuples) {
    offsets.push(uintWord(cursorBytes));
    cursorBytes += tuple.length / 2;
  }
  const array = `${uintWord(calls.length)}${offsets.join('')}${tuples.join('')}`;
  return `0x${SELECTOR_EXECUTE_BATCH}${uintWord(32)}${array}`;
}

async function assertOwnerBoundaryStillCurrent(provider, controller, smartAccountState) {
  const owner = normalizeAddress(controller);
  const account = normalizeAddress(smartAccountState.smartAccount);
  const ownerResult = await provider.request('eth_call', [{ to: account, data: encodeAddressGetter('owner') }, 'latest']);
  if (decodeAddress(ownerResult) !== owner) throw new Error('SmartAccount420 owner changed after batch simulation');
  if (smartAccountState.authorizationEpoch != null) {
    const epochResult = await provider.request('eth_call', [{ to: account, data: encodeUintGetter('authorizationEpoch') }, 'latest']);
    if (decodeUint(epochResult) !== BigInt(smartAccountState.authorizationEpoch)) {
      throw new Error('SmartAccount420 authorization epoch changed after batch simulation');
    }
  }
}

async function simulateBatchTransaction(provider, transaction) {
  let result;
  try {
    result = await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`SmartAccount420 batch simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`SmartAccount420 batch gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid batch gas estimate');
  return { passed: true, result, gas: gas.toLowerCase() };
}

export async function prepareSmartAccountBatch(provider, controller, smartAccountState, calls) {
  const owner = normalizeAddress(controller);
  if (!smartAccountState?.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== owner) {
    throw new Error('connected controller is not the on-chain SmartAccount420 owner');
  }
  const normalized = normalizeBatchCalls(smartAccountState, calls);
  const account = normalizeAddress(smartAccountState.smartAccount);
  const transaction = { from: owner, to: account, value: '0x0', data: encodeExecuteBatch(normalized.calls) };
  const simulation = await simulateBatchTransaction(provider, transaction);

  return {
    controller: owner,
    smartAccount: account,
    authorizationEpoch: smartAccountState.authorizationEpoch == null ? null : BigInt(smartAccountState.authorizationEpoch),
    calls: normalized.calls.map((call) => ({ ...call })),
    totalValue: normalized.totalValue,
    totalCalldataBytes: normalized.totalCalldataBytes,
    duplicateCallIndexes: normalized.duplicateCallIndexes.map((pair) => pair.slice()),
    transaction: { ...transaction },
    simulation,
  };
}

export async function sendPreparedSmartAccountBatch(provider, prepared, smartAccountState) {
  if (!prepared?.simulation?.passed) throw new Error('prepared SmartAccount420 batch has not passed simulation');
  const controller = normalizeAddress(prepared.controller);
  const account = normalizeAddress(prepared.smartAccount);
  if (!smartAccountState?.deployed || normalizeAddress(smartAccountState.smartAccount) !== account) throw new Error('prepared batch SmartAccount420 binding changed');
  if (!smartAccountState.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== controller) throw new Error('prepared batch owner boundary changed');
  if (prepared.authorizationEpoch != null && BigInt(smartAccountState.authorizationEpoch) !== BigInt(prepared.authorizationEpoch)) {
    throw new Error('prepared batch authorization epoch changed');
  }

  const canonicalData = encodeExecuteBatch(prepared.calls);
  if (canonicalData !== prepared.transaction?.data) throw new Error('prepared batch calldata changed after simulation');
  if (normalizeAddress(prepared.transaction?.from) !== controller || normalizeAddress(prepared.transaction?.to) !== account || prepared.transaction?.value !== '0x0') {
    throw new Error('prepared batch transaction envelope changed after simulation');
  }

  await assertOwnerBoundaryStillCurrent(provider, controller, smartAccountState);
  const resimulation = await simulateBatchTransaction(provider, prepared.transaction);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [{ ...prepared.transaction }]));
  return { ...prepared, simulation: resimulation, submitted: true, txHash };
}

export async function sendSmartAccountBatch(provider, controller, smartAccountState, calls) {
  const prepared = await prepareSmartAccountBatch(provider, controller, smartAccountState, calls);
  return sendPreparedSmartAccountBatch(provider, prepared, smartAccountState);
}

export async function confirmSmartAccountBatch(provider, txHash, controller, config = {}, options = {}) {
  const normalizedHash = normalizeTxHash(txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let receipt = null;
  for (let i = 0; i < attempts; i += 1) {
    receipt = await provider.request('eth_getTransactionReceipt', [normalizedHash]);
    if (receipt) break;
    if (i + 1 < attempts) await sleep(delayMs);
  }
  if (!receipt) throw new Error('SmartAccount420 batch transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('SmartAccount420 batch transaction reverted atomically; no batch call was committed');
  const discovered = await discoverSmartAccount(provider, controller, config);
  if (!discovered.deployed || !discovered.controllerIsOwner) throw new Error('SmartAccount420 owner boundary changed after batch execution');
  return { txHash: normalizedHash, receipt, smartAccount: discovered };
}
