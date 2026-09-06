import { normalizeAddress } from './abi.js';
import { encodeExecute, normalizeBytes32 } from './abi.js';
import { normalizeCallData, normalizeNativeValue } from './execution.js';
import { readDeployedSmartAccountState } from './accounts.js';
import { authenticatePasskey } from './passkeys.js';
import { buildPk42Signature } from './passkey-envelope.js';
import { validatePasskeyCredentialBinding, advancePasskeyCredentialBinding } from './passkey-metadata.js';
import { keccak256Hex } from './keccak.js';
import {
  decodeHandleOpSuccess,
  encodeHandleOp,
  normalizePackedUserOperation,
  readEntryPointUserOpHash,
} from './entrypoint-transport.js';

const SELECTOR_ACCOUNT_NONCE = 'd86f2b3c';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

function uintWord(value) {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error('uint256 out of range');
  return parsed.toString(16).padStart(64, '0');
}

function selector(signature) {
  return keccak256Hex(new TextEncoder().encode(signature)).slice(2, 10);
}

const SELECTOR_IS_PASSKEY_ACTIVE = selector('isPasskeyActive(bytes32)');

function decodeBool(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  if (result === `0x${'0'.repeat(64)}`) return false;
  if (result === `0x${'0'.repeat(63)}1`) return true;
  throw new Error(`invalid ${label} boolean`);
}

function decodeUint(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return BigInt(result);
}

async function readOwnerNonce(provider, smartAccount) {
  const data = `0x${SELECTOR_ACCOUNT_NONCE}${uintWord(0)}`;
  return decodeUint(await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']), 'owner nonce');
}

async function assertPasskeyActive(provider, smartAccount, credentialIdHash) {
  const hash = normalizeBytes32(credentialIdHash);
  const data = `0x${SELECTOR_IS_PASSKEY_ACTIVE}${hash.slice(2)}`;
  const result = await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']);
  if (!decodeBool(result, 'passkey active')) throw new Error('passkey credential is not active on SmartAccount420');
}

function assertSafeOwnerTarget(target, state) {
  const normalized = normalizeAddress(target);
  const denied = new Set([
    state.smartAccount,
    state.factoryAddress,
    state.entryPoint,
    state.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
  if (denied.has(normalized)) throw new Error('passkey execution target cannot be a wallet authority contract');
  return normalized;
}

async function simulatePasskeyUserOperation(provider, entryPoint, userOperation) {
  const transaction = { to: normalizeAddress(entryPoint), value: '0x0', data: encodeHandleOp(userOperation) };
  let result;
  try {
    result = await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`EntryPoint420 passkey simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  if (!decodeHandleOpSuccess(result)) throw new Error('EntryPoint420 simulation completed but the SmartAccount420 passkey call would fail');
  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`EntryPoint420 passkey gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid EntryPoint420 passkey gas estimate');
  return { transaction, gas: gas.toLowerCase(), simulationPassed: true };
}

export async function preparePasskeyUserOperationTransport(provider, navigatorLike, smartAccountState, binding, request = {}, options = {}) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before passkey transport');
  const rpId = options.rpId ?? binding?.rpId;
  const origin = options.origin ?? binding?.origin;
  const validated = validatePasskeyCredentialBinding(binding, { smartAccountState, rpId, origin });
  const target = assertSafeOwnerTarget(request.target, smartAccountState);
  const value = normalizeNativeValue(request.value ?? 0n);
  const data = normalizeCallData(request.data ?? '0x');
  const entryPoint = normalizeAddress(smartAccountState.entryPoint);

  await assertPasskeyActive(provider, smartAccountState.smartAccount, validated.credentialIdHash);
  const nonce = await readOwnerNonce(provider, smartAccountState.smartAccount);
  if ((nonce >> 64n) !== 0n) throw new Error('passkey owner nonce is not on lane zero');

  const unsigned = normalizePackedUserOperation({
    sender: smartAccountState.smartAccount,
    nonce,
    initCode: '0x',
    callData: encodeExecute(target, value, data),
    accountGasLimits: request.accountGasLimits ?? ZERO_BYTES32,
    preVerificationGas: request.preVerificationGas ?? 0n,
    gasFees: request.gasFees ?? ZERO_BYTES32,
    paymasterAndData: request.paymasterAndData ?? '0x',
    signature: '0x',
  });
  const userOpHash = await readEntryPointUserOpHash(provider, entryPoint, unsigned);

  const assertion = await authenticatePasskey(navigatorLike, {
    userOpHash,
    rpId: validated.rpId,
    credentialId: validated.credentialId,
    timeout: options.timeout ?? 60000,
  }, {
    expectedOrigin: validated.origin,
    previousSignCount: validated.signCount,
  });

  // The WebAuthn ceremony can take seconds and is an explicit trust boundary. Re-read
  // account state, credential activity, owner nonce and canonical hash before accepting it.
  const live = await readDeployedSmartAccountState(provider, smartAccountState.smartAccount);
  validatePasskeyCredentialBinding(binding, { smartAccountState: live, rpId, origin, credentialId: assertion.credentialId });
  if (normalizeAddress(live.entryPoint) !== entryPoint) throw new Error('SmartAccount420 EntryPoint changed during passkey ceremony');
  await assertPasskeyActive(provider, live.smartAccount, validated.credentialIdHash);
  const nonceAfterCeremony = await readOwnerNonce(provider, live.smartAccount);
  if (nonceAfterCeremony !== nonce) throw new Error('owner nonce changed during passkey ceremony');
  const canonicalHash = await readEntryPointUserOpHash(provider, entryPoint, unsigned);
  if (canonicalHash !== userOpHash) throw new Error('canonical user operation hash changed during passkey ceremony');

  const signature = buildPk42Signature(assertion, binding);
  const userOperation = { ...unsigned, signature };
  const simulation = await simulatePasskeyUserOperation(provider, entryPoint, userOperation);
  const advancedBinding = advancePasskeyCredentialBinding(binding, assertion);

  return {
    signerType: 'passkey',
    smartAccount: normalizeAddress(live.smartAccount),
    entryPoint,
    target,
    value,
    data,
    nonce,
    nonceKey: 0n,
    userOpHash,
    assertion,
    signature,
    userOperation,
    advancedBinding,
    entryPointSimulation: simulation,
    broadcastReady: true,
    blockReason: null,
  };
}

export async function sendPreparedPasskeyUserOperation(provider, prepared, transactionSender = null) {
  if (!prepared?.broadcastReady || prepared?.signerType !== 'passkey' || !prepared?.entryPointSimulation?.simulationPassed) {
    throw new Error('passkey EntryPoint420 transport is not ready for broadcast');
  }
  const live = await readDeployedSmartAccountState(provider, prepared.smartAccount);
  if (normalizeAddress(live.entryPoint) !== normalizeAddress(prepared.entryPoint)) throw new Error('SmartAccount420 EntryPoint changed before passkey broadcast');
  await assertPasskeyActive(provider, live.smartAccount, prepared.advancedBinding.credentialIdHash);
  const currentNonce = await readOwnerNonce(provider, live.smartAccount);
  if (currentNonce !== BigInt(prepared.nonce)) throw new Error('owner nonce changed before passkey broadcast');
  const canonicalHash = await readEntryPointUserOpHash(provider, prepared.entryPoint, { ...prepared.userOperation, signature: '0x' });
  if (canonicalHash !== prepared.userOpHash) throw new Error('canonical user operation hash changed before passkey broadcast');
  const simulation = await simulatePasskeyUserOperation(provider, prepared.entryPoint, prepared.userOperation);
  const transaction = { ...simulation.transaction };
  if (transactionSender != null) transaction.from = normalizeAddress(transactionSender);
  const txHash = await provider.request('eth_sendTransaction', [transaction]);
  if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) throw new Error('invalid passkey EntryPoint420 transaction hash');
  return { ...prepared, entryPointSimulation: simulation, submitted: true, txHash: txHash.toLowerCase() };
}
