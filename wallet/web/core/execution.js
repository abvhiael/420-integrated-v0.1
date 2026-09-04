import { decodeAddress, decodeUint, encodeAddressGetter, encodeExecute, encodeUintGetter, normalizeAddress } from './abi.js';
import { discoverSmartAccount } from './accounts.js';

const MAX_CALLDATA_BYTES = 4096;

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

export function normalizeCallData(value = '0x') {
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw new Error('calldata must be even-length hex');
  if ((value.length - 2) / 2 > MAX_CALLDATA_BYTES) throw new Error(`calldata exceeds ${MAX_CALLDATA_BYTES} byte wallet limit`);
  return value.toLowerCase();
}

export function normalizeNativeValue(value = 0n) {
  let amount;
  try {
    amount = typeof value === 'bigint' ? value : BigInt(value === '' ? '0' : value);
  } catch {
    throw new Error('native value must be an integer amount of wei');
  }
  if (amount < 0n || amount >= (1n << 256n)) throw new Error('native value out of uint256 range');
  return amount;
}

function assertOwnerExecutionBoundary(controller, smartAccountState, target) {
  const owner = normalizeAddress(controller);
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before execution');
  if (!smartAccountState.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== owner) {
    throw new Error('connected controller is not the on-chain SmartAccount420 owner');
  }

  const denied = new Set([
    smartAccountState.smartAccount,
    smartAccountState.factoryAddress,
    smartAccountState.entryPoint,
    smartAccountState.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
  if (denied.has(target)) throw new Error('direct execution to a wallet authority contract is not permitted');
}

async function assertOwnerBoundaryStillCurrent(provider, controller, smartAccountState) {
  const owner = normalizeAddress(controller);
  const account = normalizeAddress(smartAccountState.smartAccount);
  const ownerResult = await provider.request('eth_call', [{ to: account, data: encodeAddressGetter('owner') }, 'latest']);
  if (decodeAddress(ownerResult) !== owner) throw new Error('SmartAccount420 owner changed after simulation');

  if (smartAccountState.authorizationEpoch != null) {
    const epochResult = await provider.request('eth_call', [{ to: account, data: encodeUintGetter('authorizationEpoch') }, 'latest']);
    if (decodeUint(epochResult) !== BigInt(smartAccountState.authorizationEpoch)) {
      throw new Error('SmartAccount420 authorization epoch changed after simulation');
    }
  }
}

export async function prepareSmartAccountExecution(provider, controller, smartAccountState, request = {}) {
  const owner = normalizeAddress(controller);
  const account = normalizeAddress(smartAccountState?.smartAccount);
  const target = normalizeAddress(request.target);
  const value = normalizeNativeValue(request.value ?? 0n);
  const data = normalizeCallData(request.data ?? '0x');

  assertOwnerExecutionBoundary(owner, smartAccountState, target);

  const transaction = {
    from: owner,
    to: account,
    value: '0x0',
    data: encodeExecute(target, value, data),
  };

  let result;
  try {
    result = await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`SmartAccount420 simulation reverted: ${error?.message || 'eth_call failed'}`);
  }

  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`SmartAccount420 gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid gas estimate');

  return {
    controller: owner,
    smartAccount: account,
    target,
    value,
    data,
    transaction,
    simulation: { passed: true, result, gas: gas.toLowerCase() },
  };
}

export async function sendSmartAccountExecution(provider, controller, smartAccountState, request = {}) {
  const prepared = await prepareSmartAccountExecution(provider, controller, smartAccountState, request);
  await assertOwnerBoundaryStillCurrent(provider, controller, smartAccountState);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmSmartAccountExecution(provider, txHash, controller, config = {}, options = {}) {
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
  if (!receipt) throw new Error('SmartAccount420 execution transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('SmartAccount420 execution transaction reverted');

  const discovered = await discoverSmartAccount(provider, controller, config);
  if (!discovered.deployed || !discovered.controllerIsOwner) {
    throw new Error('SmartAccount420 owner boundary changed after execution');
  }
  return { txHash: normalizedHash, receipt, smartAccount: discovered };
}
