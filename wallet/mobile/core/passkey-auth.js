import { normalizeAddress, normalizeBytes32 } from '../../web/core/abi.js';
import { readDeployedSmartAccountState } from '../../web/core/accounts.js';
import { keccak256Hex } from '../../web/core/keccak.js';
import { preparePasskeyUserOperationTransport } from '../../web/core/passkey-entrypoint-transport.js';
import { encodeHandleOp, decodeHandleOpSuccess, readEntryPointUserOpHash } from '../../web/core/entrypoint-transport.js';
import { createMobileProvider420 } from './runtime-adapter.js';

const SELECTOR_ACCOUNT_NONCE = 'd86f2b3c';
function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function selector(signature) { return keccak256Hex(new TextEncoder().encode(signature)).slice(2, 10); }
const SELECTOR_IS_PASSKEY_ACTIVE = selector('isPasskeyActive(bytes32)');

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid passkey EntryPoint420 transaction hash');
  return value.toLowerCase();
}

function assertBinding(binding) {
  if (!binding || typeof binding !== 'object') throw new TypeError('passkey binding required');
  if (typeof binding.credentialId !== 'string' || !binding.credentialId) throw new TypeError('passkey credential id required');
  if (typeof binding.credentialIdHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(binding.credentialIdHash)) {
    throw new TypeError('passkey credential id hash required');
  }
  if (typeof binding.rpId !== 'string' || !binding.rpId) throw new TypeError('passkey rpId required');
  if (typeof binding.origin !== 'string' || !/^https:\/\//i.test(binding.origin)) throw new TypeError('https passkey origin required');
  return binding;
}

function createNavigatorLike(adapter) {
  if (!adapter?.passkeys || typeof adapter.passkeys.get !== 'function') throw new Error('mobile passkey capability required');
  return { credentials: { async get(options) {
    const credential = await adapter.passkeys.get(options);
    if (!credential || typeof credential !== 'object') throw new Error('native passkey assertion unavailable');
    return credential;
  } } };
}

async function readOwnerNonce(provider, smartAccount) {
  const data = `0x${SELECTOR_ACCOUNT_NONCE}${uintWord(0)}`;
  const result = await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']);
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error('invalid owner nonce ABI response');
  return BigInt(result);
}

async function assertPasskeyActive(provider, smartAccount, credentialIdHash) {
  const hash = normalizeBytes32(credentialIdHash);
  const data = `0x${SELECTOR_IS_PASSKEY_ACTIVE}${hash.slice(2)}`;
  const result = await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']);
  if (result !== `0x${'0'.repeat(63)}1`) throw new Error('passkey credential is not active on SmartAccount420');
}

async function simulate(provider, entryPoint, userOperation) {
  const transaction = { to: normalizeAddress(entryPoint), value: '0x0', data: encodeHandleOp(userOperation) };
  let result;
  try { result = await provider.request('eth_call', [transaction, 'latest']); }
  catch (error) { throw new Error(`EntryPoint420 passkey simulation reverted: ${error?.message || 'eth_call failed'}`); }
  if (!decodeHandleOpSuccess(result)) throw new Error('EntryPoint420 simulation completed but the SmartAccount420 passkey call would fail');
  const gas = await provider.request('eth_estimateGas', [transaction]);
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid EntryPoint420 passkey gas estimate');
  return Object.freeze({ transaction, gas: gas.toLowerCase(), simulationPassed: true });
}

export async function prepareMobilePasskeyExecution420({ runtime, smartAccountState, binding, request, rpId, origin, timeout } = {}) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (!smartAccountState?.deployed) throw new Error('deployed SmartAccount420 required');
  assertBinding(binding);
  const provider = createMobileProvider420(runtime);
  const prepared = await preparePasskeyUserOperationTransport(provider, createNavigatorLike(runtime), smartAccountState, binding, request, {
    rpId: rpId ?? binding.rpId,
    origin: origin ?? binding.origin,
    timeout,
  });
  if (prepared.signerType !== 'passkey' || !prepared.broadcastReady || !prepared.entryPointSimulation?.simulationPassed) {
    throw new Error('mobile passkey execution did not qualify for broadcast');
  }
  if (normalizeAddress(prepared.smartAccount) !== normalizeAddress(smartAccountState.smartAccount)) throw new Error('mobile passkey execution SmartAccount mismatch');
  if (prepared.advancedBinding?.credentialId !== binding.credentialId) throw new Error('mobile passkey credential binding changed unexpectedly');
  return Object.freeze({ ...prepared, nativeSubmitRequired: true });
}

export async function sendMobilePasskeyExecution420({ runtime, prepared } = {}) {
  if (!runtime || typeof runtime.request !== 'function') throw new Error('mobile runtime adapter required');
  if (typeof runtime.transaction?.submit !== 'function') throw new Error('native transaction submission capability required');
  if (!prepared || prepared.signerType !== 'passkey' || prepared.nativeSubmitRequired !== true || !prepared.broadcastReady) {
    throw new Error('prepared mobile passkey execution required');
  }
  const provider = createMobileProvider420(runtime);
  const live = await readDeployedSmartAccountState(provider, prepared.smartAccount);
  if (normalizeAddress(live.entryPoint) !== normalizeAddress(prepared.entryPoint)) throw new Error('SmartAccount420 EntryPoint changed before passkey broadcast');
  await assertPasskeyActive(provider, live.smartAccount, prepared.advancedBinding.credentialIdHash);
  if (await readOwnerNonce(provider, live.smartAccount) !== BigInt(prepared.nonce)) throw new Error('owner nonce changed before passkey broadcast');
  const canonicalHash = await readEntryPointUserOpHash(provider, prepared.entryPoint, { ...prepared.userOperation, signature: '0x' });
  if (canonicalHash !== prepared.userOpHash) throw new Error('canonical user operation hash changed before passkey broadcast');
  const resimulation = await simulate(provider, prepared.entryPoint, prepared.userOperation);
  const txHash = normalizeTxHash(await runtime.transaction.submit(resimulation.transaction));
  return Object.freeze({ ...prepared, entryPointSimulation: resimulation, submitted: true, txHash, nativeSubmitted: true });
}
