import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { normalizeCallData } from './execution.js';
import { prepareSessionExecution, readSessionNonce } from './session-execution.js';

const SELECTOR_GET_USER_OP_HASH = '22cdde4c';
const SELECTOR_HANDLE_OP = '9eec012b';
export const USER_OPERATION_HANDLED_TOPIC = '0x112a8640ccbb4f7d6b7d89a235e0e74c02afd6a9f6a9dd27cee0ff1e874cf62a';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;

function uintWord(value) {
  const parsed = BigInt(value);
  if (parsed < 0n || parsed >= (1n << 256n)) throw new Error('user operation integer out of uint256 range');
  return parsed.toString(16).padStart(64, '0');
}

function addressWord(value) {
  return normalizeAddress(value).slice(2).padStart(64, '0');
}

function bytesTail(value) {
  const normalized = normalizeCallData(value);
  const hex = normalized.slice(2);
  const padded = hex.padEnd(Math.ceil(hex.length / 64) * 64, '0');
  return `${uintWord(hex.length / 2)}${padded}`;
}

function normalizeSignature(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{130}$/.test(value)) throw new Error('session signer returned an invalid 65-byte signature');
  return value.toLowerCase();
}

function normalizeHash(value, label = 'user operation hash') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`invalid ${label}`);
  return value.toLowerCase();
}

function normalizeTxHash(value) {
  return normalizeHash(value, 'transaction hash');
}

export function normalizePackedUserOperation(userOperation = {}) {
  return {
    sender: normalizeAddress(userOperation.sender),
    nonce: BigInt(userOperation.nonce),
    initCode: normalizeCallData(userOperation.initCode ?? '0x'),
    callData: normalizeCallData(userOperation.callData ?? '0x'),
    accountGasLimits: normalizeBytes32(userOperation.accountGasLimits ?? ZERO_BYTES32),
    preVerificationGas: BigInt(userOperation.preVerificationGas ?? 0n),
    gasFees: normalizeBytes32(userOperation.gasFees ?? ZERO_BYTES32),
    paymasterAndData: normalizeCallData(userOperation.paymasterAndData ?? '0x'),
    signature: normalizeCallData(userOperation.signature ?? '0x'),
  };
}

export function encodePackedUserOperationTuple(userOperation) {
  const op = normalizePackedUserOperation(userOperation);
  const dynamicValues = [op.initCode, op.callData, op.paymasterAndData, op.signature];
  const tails = dynamicValues.map(bytesTail);
  const headBytes = 9 * 32;
  const offsets = [];
  let cursor = headBytes;
  for (const tail of tails) {
    offsets.push(cursor);
    cursor += tail.length / 2;
  }
  const head = [
    addressWord(op.sender),
    uintWord(op.nonce),
    uintWord(offsets[0]),
    uintWord(offsets[1]),
    op.accountGasLimits.slice(2),
    uintWord(op.preVerificationGas),
    op.gasFees.slice(2),
    uintWord(offsets[2]),
    uintWord(offsets[3]),
  ].join('');
  return `${head}${tails.join('')}`;
}

export function encodeGetUserOpHash(userOperation) {
  return `0x${SELECTOR_GET_USER_OP_HASH}${uintWord(32)}${encodePackedUserOperationTuple(userOperation)}`;
}

export function encodeHandleOp(userOperation) {
  return `0x${SELECTOR_HANDLE_OP}${uintWord(32)}${encodePackedUserOperationTuple(userOperation)}`;
}

export function decodeHandleOpSuccess(result) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]+$/.test(result) || result.length < 130) throw new Error('invalid EntryPoint420 handleOp simulation result');
  const successWord = result.slice(2, 66);
  if (!/^0{63}[01]$/i.test(successWord)) throw new Error('invalid EntryPoint420 handleOp success value');
  return successWord.endsWith('1');
}

export async function readEntryPointUserOpHash(provider, entryPoint, userOperation) {
  const to = normalizeAddress(entryPoint);
  const result = await provider.request('eth_call', [{ to, data: encodeGetUserOpHash(userOperation) }, 'latest']);
  return normalizeHash(result);
}

async function assertSignerAvailable(provider, signer) {
  const accounts = await provider.request('eth_accounts');
  const normalized = Array.isArray(accounts) ? accounts.map((value) => normalizeAddress(value)) : [];
  if (!normalized.includes(normalizeAddress(signer))) throw new Error('session signer is not available in the connected wallet');
}

async function simulateSignedUserOperation(provider, signer, entryPoint, userOperation) {
  const transaction = { from: normalizeAddress(signer), to: normalizeAddress(entryPoint), value: '0x0', data: encodeHandleOp(userOperation) };
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
  return { transaction, gas: gas.toLowerCase(), simulationPassed: true };
}

export async function prepareEntryPointTransport(provider, smartAccountState, sessionKey, sessionPreflight) {
  if (!sessionPreflight || sessionPreflight.broadcastReady !== false) throw new Error('qualified session execution preflight required before EntryPoint420 transport');
  const signer = normalizeAddress(sessionKey);
  if (normalizeAddress(sessionPreflight.signer) !== signer) throw new Error('session preflight signer mismatch');
  const entryPoint = normalizeAddress(smartAccountState?.entryPoint);
  const unsigned = normalizePackedUserOperation(sessionPreflight.userOperation);
  if (unsigned.sender !== normalizeAddress(smartAccountState.smartAccount)) throw new Error('session user operation sender mismatch');
  if (unsigned.signature !== '0x') throw new Error('session preflight must be unsigned');
  await assertSignerAvailable(provider, signer);

  const userOpHash = await readEntryPointUserOpHash(provider, entryPoint, unsigned);
  const signature = normalizeSignature(await provider.request('personal_sign', [userOpHash, signer]));
  const userOperation = { ...unsigned, signature };
  const simulation = await simulateSignedUserOperation(provider, signer, entryPoint, userOperation);
  return {
    ...sessionPreflight,
    entryPoint,
    userOpHash,
    userOperation,
    signature,
    entryPointSimulation: simulation,
    broadcastReady: true,
    blockReason: null,
  };
}

export async function prepareSessionUserOperationTransport(provider, smartAccountState, sessionKey, request = {}) {
  const preflight = await prepareSessionExecution(provider, smartAccountState, sessionKey, request);
  return prepareEntryPointTransport(provider, smartAccountState, sessionKey, preflight);
}

export async function sendPreparedEntryPointUserOperation(provider, prepared) {
  if (!prepared?.broadcastReady || !prepared?.entryPointSimulation?.simulationPassed) throw new Error('EntryPoint420 transport is not ready for broadcast');
  const currentNonce = await readSessionNonce(provider, prepared.smartAccount || prepared.userOperation.sender, prepared.signer);
  if (currentNonce !== BigInt(prepared.userOperation.nonce)) throw new Error('session nonce changed after user operation preparation');

  const resimulation = await simulateSignedUserOperation(provider, prepared.signer, prepared.entryPoint, prepared.userOperation);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [resimulation.transaction]));
  return { ...prepared, entryPointSimulation: resimulation, submitted: true, txHash };
}

export async function sendSessionUserOperation(provider, smartAccountState, sessionKey, request = {}) {
  const prepared = await prepareSessionUserOperationTransport(provider, smartAccountState, sessionKey, request);
  return sendPreparedEntryPointUserOperation(provider, prepared);
}

function eventTopicAddress(address) {
  return `0x${addressWord(address)}`.toLowerCase();
}

function eventTopicUint(value) {
  return `0x${uintWord(value)}`.toLowerCase();
}

function findHandledEvent(receipt, prepared) {
  const expectedHash = normalizeHash(prepared.userOpHash);
  const expectedSender = eventTopicAddress(prepared.userOperation.sender);
  const expectedKey = eventTopicUint(prepared.nonceKey);
  const expectedEntryPoint = normalizeAddress(prepared.entryPoint);
  for (const log of receipt?.logs || []) {
    if (normalizeAddress(log.address) !== expectedEntryPoint) continue;
    const topics = Array.isArray(log.topics) ? log.topics.map((topic) => String(topic).toLowerCase()) : [];
    if (topics[0] !== USER_OPERATION_HANDLED_TOPIC || topics[1] !== expectedHash || topics[2] !== expectedSender || topics[3] !== expectedKey) continue;
    if (typeof log.data !== 'string' || !/^0x[0-9a-fA-F]{128}$/.test(log.data)) throw new Error('malformed EntryPoint420 UserOperationHandled event');
    const sequence = BigInt(`0x${log.data.slice(2, 66)}`);
    const success = BigInt(`0x${log.data.slice(66, 130)}`) === 1n;
    return { sequence, success };
  }
  throw new Error('EntryPoint420 UserOperationHandled confirmation event not found');
}

export async function confirmEntryPointUserOperation(provider, submitted, options = {}) {
  const txHash = normalizeTxHash(submitted?.txHash);
  const attempts = Number.isInteger(options.attempts) && options.attempts > 0 ? options.attempts : 30;
  const delayMs = Number.isInteger(options.delayMs) && options.delayMs >= 0 ? options.delayMs : 1000;
  const sleep = options.sleep || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  let receipt = null;
  for (let index = 0; index < attempts; index += 1) {
    receipt = await provider.request('eth_getTransactionReceipt', [txHash]);
    if (receipt) break;
    if (index + 1 < attempts) await sleep(delayMs);
  }
  if (!receipt) throw new Error('EntryPoint420 user operation was not confirmed');
  if (receipt.status !== '0x1') throw new Error('EntryPoint420 transaction reverted');

  const handled = findHandledEvent(receipt, submitted);
  const expectedSequence = BigInt(submitted.userOperation.nonce) & ((1n << 64n) - 1n);
  if (handled.sequence !== expectedSequence) throw new Error('EntryPoint420 handled an unexpected session nonce sequence');
  const nonceAfter = await readSessionNonce(provider, submitted.smartAccount || submitted.userOperation.sender, submitted.signer);
  if (nonceAfter !== BigInt(submitted.userOperation.nonce) + 1n) throw new Error('session nonce did not advance exactly once after EntryPoint420 handling');
  if (!handled.success) throw new Error('session execution failed after validation; EntryPoint420 consumed the session nonce to prevent replay');
  return { txHash, receipt, handled, nonceAfter, confirmed: true };
}
