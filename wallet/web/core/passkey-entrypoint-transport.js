import { encodeExecute, normalizeAddress } from './abi.js';
import { normalizeCallData, normalizeNativeValue } from './execution.js';
import { readDeployedSmartAccountState } from './accounts.js';
import { authenticatePasskey } from './passkeys.js';
import { validatePasskeyDeviceRecord } from './passkey-devices.js';
import { buildPasskeyUserOpChallenge, encodePasskeyUserOpSignature } from './passkey-userop.js';
import {
  USER_OPERATION_HANDLED_TOPIC,
  normalizePackedUserOperation,
  readEntryPointUserOpHash,
} from './entrypoint-transport.js';

const SELECTOR_ACCOUNT_NONCE = 'd86f2b3c';
const SELECTOR_HANDLE_OP = '9eec012b';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function addressWord(value) { return normalizeAddress(value).slice(2).padStart(64, '0'); }
function normalizeHash(value, label = 'hash') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`invalid ${label}`);
  return value.toLowerCase();
}
function normalizeTxHash(value) { return normalizeHash(value, 'transaction hash'); }
function bytesTail(value) {
  const normalized = normalizeCallData(value);
  const hex = normalized.slice(2);
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  return `${uintWord(hex.length / 2)}${padded}`;
}
function encodeTuple(userOperation) {
  const op = normalizePackedUserOperation(userOperation);
  const dynamicValues = [op.initCode, op.callData, op.paymasterAndData, op.signature];
  const tails = dynamicValues.map(bytesTail);
  const offsets = [];
  let cursor = 9 * 32;
  for (const tail of tails) { offsets.push(cursor); cursor += tail.length / 2; }
  return [
    addressWord(op.sender), uintWord(op.nonce), uintWord(offsets[0]), uintWord(offsets[1]),
    op.accountGasLimits.slice(2), uintWord(op.preVerificationGas), op.gasFees.slice(2),
    uintWord(offsets[2]), uintWord(offsets[3]),
  ].join('') + tails.join('');
}
function encodeHandleOp(userOperation) { return `0x${SELECTOR_HANDLE_OP}${uintWord(32)}${encodeTuple(userOperation)}`; }

export async function readOwnerNonce(provider, smartAccount) {
  const data = `0x${SELECTOR_ACCOUNT_NONCE}${uintWord(0)}`;
  const result = await provider.request('eth_call', [{ to: normalizeAddress(smartAccount), data }, 'latest']);
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error('invalid owner nonce ABI response');
  const nonce = BigInt(result);
  if ((nonce >> 64n) !== 0n) throw new Error('owner nonce is not on canonical nonce lane zero');
  return nonce;
}

function assertSafeTarget(target, smartAccountState) {
  const normalized = normalizeAddress(target);
  const denied = new Set([
    smartAccountState.smartAccount,
    smartAccountState.factoryAddress,
    smartAccountState.entryPoint,
    smartAccountState.capabilityRegistry,
  ].filter(Boolean).map(normalizeAddress));
  if (denied.has(normalized)) throw new Error('passkey execution target cannot be a wallet authority contract');
  return normalized;
}

async function simulate(provider, entryPoint, userOperation) {
  const transaction = { to: normalizeAddress(entryPoint), value: '0x0', data: encodeHandleOp(userOperation) };
  let result;
  try { result = await provider.request('eth_call', [transaction, 'latest']); }
  catch (error) { throw new Error(`EntryPoint420 passkey simulation reverted: ${error?.message || 'eth_call failed'}`); }
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result) || result.length < 66) throw new Error('invalid EntryPoint420 passkey simulation result');
  const successWord = result.slice(2, 66);
  if (!/^0{63}[01]$/i.test(successWord) || !successWord.endsWith('1')) throw new Error('EntryPoint420 passkey simulation reported failure');
  let gas;
  try { gas = await provider.request('eth_estimateGas', [transaction]); }
  catch (error) { throw new Error(`EntryPoint420 passkey gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`); }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid EntryPoint420 passkey gas estimate');
  return { transaction, gas: gas.toLowerCase(), simulationPassed: true };
}

export async function preparePasskeyUserOperation(provider, runtimeConfig, smartAccountState, deviceRecord, request = {}, options = {}) {
  if (runtimeConfig?.features?.passkeys !== true) throw new Error('runtime passkeys are disabled');
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before passkey execution');
  const chainIdHex = await provider.request('eth_chainId');
  const chainId = Number(BigInt(chainIdHex));
  if (runtimeConfig?.network?.chainId != null && BigInt(runtimeConfig.network.chainId) !== BigInt(chainId)) throw new Error('runtime chain ID mismatch');

  const rp = runtimeConfig?.passkey || {};
  const deviceStatus = validatePasskeyDeviceRecord(deviceRecord, {
    smartAccount: smartAccountState.smartAccount,
    authorizationEpoch: Number(smartAccountState.authorizationEpoch),
    rpId: rp.rpId,
    origin: rp.origin,
  });
  if (!deviceStatus.valid) throw new Error(`passkey device is not usable: ${deviceStatus.reason}`);

  const target = assertSafeTarget(request.target, smartAccountState);
  const value = normalizeNativeValue(request.value ?? 0n);
  const data = normalizeCallData(request.data ?? '0x');
  const nonce = await readOwnerNonce(provider, smartAccountState.smartAccount);
  const callData = encodeExecute(target, value, data);
  const unsigned = normalizePackedUserOperation({
    sender: smartAccountState.smartAccount,
    nonce,
    initCode: '0x',
    callData,
    accountGasLimits: ZERO_BYTES32,
    preVerificationGas: 0n,
    gasFees: ZERO_BYTES32,
    paymasterAndData: '0x',
    signature: '0x',
  });
  const entryPoint = normalizeAddress(smartAccountState.entryPoint);
  const userOpHash = await readEntryPointUserOpHash(provider, entryPoint, unsigned);
  const challenge = await buildPasskeyUserOpChallenge({
    chainId,
    smartAccount: smartAccountState.smartAccount,
    authorizationEpoch: smartAccountState.authorizationEpoch,
    userOpHash,
    nonce,
    cryptoImpl: options.cryptoImpl || globalThis.crypto,
  });
  const assertion = await authenticatePasskey({
    credentials: options.credentials || globalThis.navigator?.credentials,
    challenge,
    rp,
    credentialIds: [deviceRecord.credentialId],
  });
  if (assertion.rawId !== deviceRecord.credentialId) throw new Error('WebAuthn assertion credential does not match the selected device');
  const signature = encodePasskeyUserOpSignature({
    credentialIdHash: deviceRecord.credentialIdHash,
    authenticatorData: assertion.authenticatorData,
    clientDataJSON: assertion.clientDataJSON,
    signature: assertion.signature,
  });
  const userOperation = { ...unsigned, signature };
  const entryPointSimulation = await simulate(provider, entryPoint, userOperation);
  return {
    entryPoint,
    chainId,
    smartAccount: normalizeAddress(smartAccountState.smartAccount),
    authorizationEpoch: BigInt(smartAccountState.authorizationEpoch),
    target,
    value,
    data,
    nonce,
    nonceKey: 0n,
    userOpHash,
    userOperation,
    deviceRecord,
    entryPointSimulation,
    broadcastReady: true,
  };
}

export async function revalidatePreparedPasskeyUserOperation(provider, runtimeConfig, prepared) {
  if (!prepared?.broadcastReady) throw new Error('passkey user operation is not broadcast-ready');
  const live = await readDeployedSmartAccountState(provider, prepared.smartAccount);
  if (normalizeAddress(live.entryPoint) !== normalizeAddress(prepared.entryPoint)) throw new Error('SmartAccount420 EntryPoint changed after passkey signing');
  if (BigInt(live.authorizationEpoch) !== BigInt(prepared.authorizationEpoch)) throw new Error('authorization epoch changed after passkey signing');
  const rp = runtimeConfig?.passkey || {};
  const status = validatePasskeyDeviceRecord(prepared.deviceRecord, {
    smartAccount: live.smartAccount,
    authorizationEpoch: Number(live.authorizationEpoch),
    rpId: rp.rpId,
    origin: rp.origin,
  });
  if (!status.valid) throw new Error(`passkey device became unusable after signing: ${status.reason}`);
  const nonce = await readOwnerNonce(provider, live.smartAccount);
  if (nonce !== BigInt(prepared.nonce)) throw new Error('owner nonce changed after passkey signing');
  const canonicalHash = await readEntryPointUserOpHash(provider, prepared.entryPoint, { ...prepared.userOperation, signature: '0x' });
  if (normalizeHash(canonicalHash) !== normalizeHash(prepared.userOpHash)) throw new Error('canonical user operation hash changed after passkey signing');
  return { live, nonce };
}

export async function sendPreparedPasskeyUserOperation(provider, runtimeConfig, prepared) {
  await revalidatePreparedPasskeyUserOperation(provider, runtimeConfig, prepared);
  const resimulation = await simulate(provider, prepared.entryPoint, prepared.userOperation);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [resimulation.transaction]));
  return { ...prepared, entryPointSimulation: resimulation, submitted: true, txHash };
}

function topicAddress(address) { return `0x${addressWord(address)}`.toLowerCase(); }
function decodeHandledEvent(log) {
  if (typeof log?.data !== 'string' || !/^0x[0-9a-fA-F]{128}$/.test(log.data)) throw new Error('malformed EntryPoint420 UserOperationHandled event');
  const sequence = BigInt(`0x${log.data.slice(2, 66)}`);
  const successWord = log.data.slice(66, 130);
  if (!/^0{63}[01]$/i.test(successWord)) throw new Error('malformed EntryPoint420 UserOperationHandled success value');
  return { sequence, success: successWord.endsWith('1') };
}

export async function confirmPasskeyUserOperation(provider, submitted, options = {}) {
  const txHash = normalizeTxHash(submitted?.txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let receipt = null;
  for (let i = 0; i < attempts; i += 1) {
    receipt = await provider.request('eth_getTransactionReceipt', [txHash]);
    if (receipt) break;
    if (i + 1 < attempts) await sleep(delayMs);
  }
  if (!receipt) throw new Error('passkey user operation was not confirmed');
  if (receipt.status !== '0x1') throw new Error('EntryPoint420 passkey transaction reverted');
  const expectedHash = normalizeHash(submitted.userOpHash);
  const expectedSender = topicAddress(submitted.smartAccount);
  const matches = (receipt.logs || []).filter((log) => {
    const topics = Array.isArray(log?.topics) ? log.topics.map((t) => String(t).toLowerCase()) : [];
    return normalizeAddress(log.address) === normalizeAddress(submitted.entryPoint)
      && topics[0] === USER_OPERATION_HANDLED_TOPIC
      && topics[1] === expectedHash
      && topics[2] === expectedSender
      && topics[3] === `0x${uintWord(0)}`;
  });
  if (matches.length !== 1) throw new Error(matches.length ? 'ambiguous passkey UserOperationHandled confirmation events' : 'passkey UserOperationHandled confirmation event not found');
  const handled = decodeHandledEvent(matches[0]);
  const expectedSequence = BigInt(submitted.nonce) & ((1n << 64n) - 1n);
  if (handled.sequence !== expectedSequence) throw new Error('EntryPoint420 handled an unexpected owner nonce sequence');
  const nonceAfter = await readOwnerNonce(provider, submitted.smartAccount);
  if (nonceAfter !== BigInt(submitted.nonce) + 1n) throw new Error('owner nonce did not advance exactly once after passkey handling');
  if (!handled.success) throw new Error('passkey execution failed after validation; EntryPoint420 consumed the owner nonce to prevent replay');
  return { txHash, receipt, handled, nonceAfter, confirmed: true };
}
