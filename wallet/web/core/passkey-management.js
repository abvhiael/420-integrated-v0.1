import { normalizeAddress, ZERO_ADDRESS } from './abi.js';
import { readDeployedSmartAccountState } from './accounts.js';
import { validatePasskeyCredentialBinding } from './passkey-metadata.js';
import { keccak256Hex } from './keccak.js';

const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

function selector(signature) {
  return keccak256Hex(new TextEncoder().encode(signature)).slice(2, 10);
}

const SELECTOR_ENROLL_PASSKEY = selector('enrollPasskey(bytes32,bytes32,bytes32,uint256,uint256)');
const SELECTOR_REENROLL_PASSKEY = selector('reenrollPasskey(bytes32)');
const SELECTOR_PASSKEY_CREDENTIAL = selector('passkeyCredential(bytes32)');

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}

function uintWord(value) {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error('uint256 out of range');
  return parsed.toString(16).padStart(64, '0');
}

function bytes32Word(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32 hex`);
  return value.slice(2).toLowerCase();
}

function assertDeployedOwnerState(state, actor) {
  if (!state?.deployed) throw new Error('SmartAccount420 must be deployed before passkey management');
  const account = normalizeAddress(state.smartAccount);
  const owner = normalizeAddress(state.owner);
  const connected = normalizeAddress(actor);
  if (!state.controllerIsOwner || connected !== owner) throw new Error('connected account is not the on-chain SmartAccount420 owner');
  if (normalizeAddress(state.pendingRecoveryOwner || ZERO_ADDRESS) !== ZERO_ADDRESS) throw new Error('passkey management is blocked while recovery is pending');
  return { account, owner: connected };
}

function bytesFromHex32(value, label) {
  const clean = bytes32Word(value, label);
  return Uint8Array.from(clean.match(/../g), (byte) => Number.parseInt(byte, 16));
}

async function sha256Hex(bytes) {
  if (globalThis.crypto?.subtle?.digest) {
    const digest = new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes));
    return `0x${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    const { createHash } = await import('node:crypto');
    return `0x${createHash('sha256').update(bytes).digest('hex')}`;
  }
  throw new Error('SHA-256 unavailable');
}

async function bindingHashes(binding) {
  const rpIdBytes = new TextEncoder().encode(binding.rpId);
  const originBytes = new TextEncoder().encode(binding.origin);
  return {
    rpIdHash: await sha256Hex(rpIdBytes),
    originHash: keccak256Hex(originBytes),
  };
}

function decodePasskeyCredential(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{320}$/.test(result)) throw new Error('invalid passkey credential ABI response');
  const hex = result.slice(2).toLowerCase();
  return {
    epoch: BigInt(`0x${hex.slice(0, 64)}`),
    rpIdHash: `0x${hex.slice(64, 128)}`,
    originHash: `0x${hex.slice(128, 192)}`,
    publicKeyX: `0x${hex.slice(192, 256)}`,
    publicKeyY: `0x${hex.slice(256, 320)}`,
  };
}

async function readPasskeyCredential(provider, smartAccount, credentialIdHash) {
  const hash = bytes32Word(credentialIdHash, 'credential ID hash');
  const data = `0x${SELECTOR_PASSKEY_CREDENTIAL}${hash}`;
  const result = await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']);
  return decodePasskeyCredential(result);
}

async function simulateManagementTransaction(provider, from, to, data) {
  const transaction = { from: normalizeAddress(from), to: normalizeAddress(to), value: '0x0', data };
  try {
    await provider.request('eth_call', [transaction, 'latest']);
  } catch (error) {
    throw new Error(`SmartAccount420 passkey management simulation reverted: ${error?.message || 'eth_call failed'}`);
  }
  let gas;
  try {
    gas = await provider.request('eth_estimateGas', [transaction]);
  } catch (error) {
    throw new Error(`SmartAccount420 passkey management gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`);
  }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid passkey management gas estimate');
  return { transaction, gas: gas.toLowerCase(), simulationPassed: true };
}

async function waitForReceipt(provider, txHash, options = {}) {
  const normalizedHash = normalizeTxHash(txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  for (let index = 0; index < attempts; index += 1) {
    const receipt = await provider.request('eth_getTransactionReceipt', [normalizedHash]);
    if (receipt) {
      if (receipt.status !== '0x1') throw new Error('SmartAccount420 passkey management transaction reverted');
      return { txHash: normalizedHash, receipt };
    }
    if (index + 1 < attempts) await sleep(delayMs);
  }
  throw new Error('SmartAccount420 passkey management transaction was not confirmed');
}

function assertStoredMaterial(credential, validated, hashes, expectedEpoch = null) {
  if (expectedEpoch != null && credential.epoch !== BigInt(expectedEpoch)) throw new Error('stored passkey authorization epoch changed');
  if (credential.rpIdHash !== hashes.rpIdHash) throw new Error('stored passkey RP ID hash changed');
  if (credential.originHash !== hashes.originHash) throw new Error('stored passkey origin hash changed');
  if (credential.publicKeyX !== validated.publicKeyX) throw new Error('stored passkey P-256 x coordinate changed');
  if (credential.publicKeyY !== validated.publicKeyY) throw new Error('stored passkey P-256 y coordinate changed');
}

export async function prepareEnrollPasskey(provider, actor, smartAccountState, binding) {
  const { account, owner } = assertDeployedOwnerState(smartAccountState, actor);
  const validated = validatePasskeyCredentialBinding(binding, {
    smartAccountState,
    rpId: binding?.rpId,
    origin: binding?.origin,
  });
  const existing = await readPasskeyCredential(provider, account, validated.credentialIdHash);
  if (existing.epoch !== 0n) throw new Error('passkey credential already exists on SmartAccount420');
  const hashes = await bindingHashes(validated);
  const data = `0x${SELECTOR_ENROLL_PASSKEY}${bytes32Word(validated.credentialIdHash, 'credential ID hash')}${bytes32Word(hashes.rpIdHash, 'RP ID hash')}${bytes32Word(hashes.originHash, 'origin hash')}${uintWord(validated.publicKeyX)}${uintWord(validated.publicKeyY)}`;
  const simulation = await simulateManagementTransaction(provider, owner, account, data);
  return {
    action: 'enrollPasskey', actor: owner, smartAccount: account, before: smartAccountState,
    binding, validated, hashes, ...simulation,
  };
}

export async function sendEnrollPasskey(provider, actor, smartAccountState, binding) {
  const prepared = await prepareEnrollPasskey(provider, actor, smartAccountState, binding);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmEnrollPasskey(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount, { controller: prepared.actor });
  if (after.owner !== prepared.actor) throw new Error('SmartAccount420 owner changed during passkey enrollment');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch)) throw new Error('authorization epoch changed during passkey enrollment');
  if (normalizeAddress(after.pendingRecoveryOwner || ZERO_ADDRESS) !== ZERO_ADDRESS) throw new Error('recovery became pending during passkey enrollment');
  validatePasskeyCredentialBinding(prepared.binding, { smartAccountState: after, rpId: prepared.binding.rpId, origin: prepared.binding.origin });
  const credential = await readPasskeyCredential(provider, after.smartAccount, prepared.validated.credentialIdHash);
  if (credential.epoch !== after.authorizationEpoch) throw new Error('enrolled passkey is not active in the current authorization epoch');
  assertStoredMaterial(credential, prepared.validated, prepared.hashes, after.authorizationEpoch);
  return { ...confirmation, smartAccount: after, credential, binding: prepared.binding };
}

export async function prepareReenrollPasskey(provider, actor, smartAccountState, binding) {
  const { account, owner } = assertDeployedOwnerState(smartAccountState, actor);
  const staleEpoch = BigInt(binding?.authorizationEpoch);
  if (staleEpoch < 1n || staleEpoch === BigInt(smartAccountState.authorizationEpoch)) throw new Error('passkey re-enrollment requires a stale credential binding');
  const staleState = { ...smartAccountState, authorizationEpoch: staleEpoch };
  const validated = validatePasskeyCredentialBinding(binding, {
    smartAccountState: staleState,
    rpId: binding?.rpId,
    origin: binding?.origin,
  });
  const existing = await readPasskeyCredential(provider, account, validated.credentialIdHash);
  if (existing.epoch === 0n) throw new Error('passkey credential is not enrolled on SmartAccount420');
  if (existing.epoch === BigInt(smartAccountState.authorizationEpoch)) throw new Error('passkey credential is already active in the current authorization epoch');
  const hashes = await bindingHashes(validated);
  assertStoredMaterial(existing, validated, hashes, staleEpoch);
  const data = `0x${SELECTOR_REENROLL_PASSKEY}${bytes32Word(validated.credentialIdHash, 'credential ID hash')}`;
  const simulation = await simulateManagementTransaction(provider, owner, account, data);
  return {
    action: 'reenrollPasskey', actor: owner, smartAccount: account, before: smartAccountState,
    binding, validated, hashes, staleCredential: existing, ...simulation,
  };
}

export async function sendReenrollPasskey(provider, actor, smartAccountState, binding) {
  const prepared = await prepareReenrollPasskey(provider, actor, smartAccountState, binding);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmReenrollPasskey(provider, txHash, prepared, options = {}) {
  const confirmation = await waitForReceipt(provider, txHash, options);
  const after = await readDeployedSmartAccountState(provider, prepared.smartAccount, { controller: prepared.actor });
  if (after.owner !== prepared.actor) throw new Error('SmartAccount420 owner changed during passkey re-enrollment');
  if (after.authorizationEpoch !== BigInt(prepared.before.authorizationEpoch)) throw new Error('authorization epoch changed during passkey re-enrollment');
  if (normalizeAddress(after.pendingRecoveryOwner || ZERO_ADDRESS) !== ZERO_ADDRESS) throw new Error('recovery became pending during passkey re-enrollment');
  const credential = await readPasskeyCredential(provider, after.smartAccount, prepared.validated.credentialIdHash);
  if (credential.epoch !== after.authorizationEpoch) throw new Error('re-enrolled passkey is not active in the current authorization epoch');
  assertStoredMaterial(credential, prepared.validated, prepared.hashes, after.authorizationEpoch);
  const refreshedBinding = Object.freeze({ ...prepared.binding, authorizationEpoch: after.authorizationEpoch.toString() });
  validatePasskeyCredentialBinding(refreshedBinding, { smartAccountState: after, rpId: refreshedBinding.rpId, origin: refreshedBinding.origin });
  return { ...confirmation, smartAccount: after, credential, binding: refreshedBinding };
}
