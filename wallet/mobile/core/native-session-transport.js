import { normalizeAddress, normalizeBytes32 } from '../../web/core/abi.js';
import { prepareSessionExecution } from '../../web/core/session-execution.js';
import {
  normalizePackedUserOperation,
  readEntryPointUserOpHash,
  encodeHandleOp,
  decodeHandleOpSuccess,
  revalidatePreparedSession,
} from '../../web/core/entrypoint-transport.js';

const SESSION_EXECUTE_CAPABILITY_420 = `0x${'0'.repeat(63)}1`;

function normalizeHash(value, label = 'hash') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`invalid ${label}`);
  return value.toLowerCase();
}

function normalizeSignature(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(value)) throw new Error('native session signer returned an invalid 65-byte signature');
  return value.toLowerCase();
}

function assertNativeSessionRuntime(runtime) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (typeof runtime.sessionSigner?.signHash !== 'function') throw new Error('native non-exportable session signer capability required');
  if (typeof runtime.transaction?.submit !== 'function') throw new Error('native transaction submission capability required');
  return runtime;
}

async function simulate(provider, entryPoint, userOperation) {
  const transaction = { to: normalizeAddress(entryPoint), value: '0x0', data: encodeHandleOp(userOperation) };
  let result;
  try {
    result = await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`EntryPoint420 user operation simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  if (!decodeHandleOpSuccess(result)) throw new Error('EntryPoint420 simulation completed but the SmartAccount420 session call would fail');
  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`EntryPoint420 user operation gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid EntryPoint420 gas estimate');
  return Object.freeze({ transaction, gas: gas.toLowerCase(), simulationPassed: true });
}

export async function prepareNativeMobileSessionTransport420({ runtime, provider, smartAccountState, sessionKey, request = {} } = {}) {
  assertNativeSessionRuntime(runtime);
  if (!provider || typeof provider.request !== 'function') throw new Error('mobile provider required');
  if (!smartAccountState?.deployed) throw new Error('deployed SmartAccount420 required');

  const signer = normalizeAddress(sessionKey);
  const preflight = await prepareSessionExecution(provider, smartAccountState, signer, request);
  if (!preflight || preflight.broadcastReady !== false) throw new Error('qualified session execution preflight required before native transport');

  const entryPoint = normalizeAddress(smartAccountState.entryPoint);
  const unsigned = normalizePackedUserOperation(preflight.userOperation);
  if (unsigned.sender !== normalizeAddress(smartAccountState.smartAccount)) throw new Error('session user operation sender mismatch');
  if (unsigned.signature !== '0x') throw new Error('session preflight must be unsigned');

  const userOpHash = await readEntryPointUserOpHash(provider, entryPoint, unsigned);
  const signature = normalizeSignature(await runtime.sessionSigner.signHash(signer, userOpHash));
  const userOperation = { ...unsigned, signature };
  const simulation = await simulate(provider, entryPoint, userOperation);

  return Object.freeze({
    ...preflight,
    entryPoint,
    signer,
    userOpHash,
    userOperation,
    signature,
    entryPointSimulation: simulation,
    broadcastReady: true,
    blockReason: null,
    nativeSigner: true,
  });
}

export async function sendNativeMobileSessionTransport420({ runtime, provider, prepared } = {}) {
  assertNativeSessionRuntime(runtime);
  if (!provider || typeof provider.request !== 'function') throw new Error('mobile provider required');
  if (!prepared?.broadcastReady || !prepared?.entryPointSimulation?.simulationPassed || prepared.nativeSigner !== true) {
    throw new Error('prepared native mobile session execution required');
  }

  await revalidatePreparedSession(provider, prepared);
  const canonicalHash = await readEntryPointUserOpHash(provider, prepared.entryPoint, { ...prepared.userOperation, signature: '0x' });
  if (normalizeHash(canonicalHash) !== normalizeHash(prepared.userOpHash, 'user operation hash')) {
    throw new Error('canonical user operation hash changed after native signing');
  }

  const resimulation = await simulate(provider, prepared.entryPoint, prepared.userOperation);
  const txHash = normalizeHash(await runtime.transaction.submit(resimulation.transaction), 'transaction hash');
  return Object.freeze({ ...prepared, entryPointSimulation: resimulation, submitted: true, txHash, nativeSubmitted: true });
}

export function assertNativeMobileSessionGrant420(prepared) {
  const capability = prepared?.grant?.grant?.capabilityId;
  if (capability && normalizeBytes32(capability) !== normalizeBytes32(SESSION_EXECUTE_CAPABILITY_420)) {
    throw new Error('mobile session execution grant is not SESSION_EXECUTE');
  }
  return prepared;
}
