import { base64UrlToBytes, bytesToBase64Url, normalizeRpConfiguration } from './passkeys.js';
import { createPasskeyDeviceRecord, replacePasskeyDeviceRecord, revokePasskeyDeviceRecord } from './passkey-devices.js';
import { normalizeAddress } from './abi.js';

const SELECTOR_REGISTER_PASSKEY = '923e3cec';
const SELECTOR_REVOKE_PASSKEY = '739afee3';
const SELECTOR_PASSKEY_VERIFIER = '2b6ae8e4';
const SELECTOR_AUTHORIZATION_EPOCH = '6d5f87be';
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;

function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}
function normalizeBytes32(value, label) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${label} must be bytes32`);
  return value.toLowerCase();
}
function uintWord(value, label) {
  let n;
  try { n = typeof value === 'bigint' ? value : BigInt(value); }
  catch { throw new Error(`${label} must be uint256`); }
  if (n < 0n || n >= (1n << 256n)) throw new Error(`${label} out of range`);
  return n.toString(16).padStart(64, '0');
}
function bytes32Word(value, label) { return normalizeBytes32(value, label).slice(2); }
function decodeAddress(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return normalizeAddress(`0x${result.slice(-40)}`);
}
function decodeUint(result, label) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(result)) throw new Error(`invalid ${label} ABI response`);
  return BigInt(result);
}
async function sha256(bytes, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) throw new Error('Web Crypto SHA-256 unavailable');
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return new Uint8Array(await cryptoImpl.subtle.digest('SHA-256', view));
}
async function sha256Text(value, cryptoImpl) {
  return sha256(new TextEncoder().encode(value), cryptoImpl);
}
function hex32(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (view.length !== 32) throw new Error('expected 32 bytes');
  return `0x${[...view].map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}
function assertOwnerBoundary(controller, smartAccountState) {
  const owner = normalizeAddress(controller);
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before passkey management');
  if (!smartAccountState.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== owner) {
    throw new Error('connected controller is not the on-chain SmartAccount420 owner');
  }
  return owner;
}
async function accountCall(provider, account, data) {
  return provider.request('eth_call', [{ to: normalizeAddress(account), data }, 'latest']);
}
async function simulate(provider, transaction, label) {
  try { await provider.request('eth_call', [transaction, 'latest']); }
  catch (error) { throw new Error(`${label} simulation reverted: ${error?.message || 'eth_call failed'}`); }
  let gas;
  try { gas = await provider.request('eth_estimateGas', [transaction]); }
  catch (error) { throw new Error(`${label} gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`); }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid gas estimate');
  return { passed: true, gas: gas.toLowerCase() };
}

export async function readPasskeyManagementState(provider, smartAccount) {
  const account = normalizeAddress(smartAccount);
  const [verifierRaw, epochRaw] = await Promise.all([
    accountCall(provider, account, `0x${SELECTOR_PASSKEY_VERIFIER}`),
    accountCall(provider, account, `0x${SELECTOR_AUTHORIZATION_EPOCH}`),
  ]);
  const verifier = decodeAddress(verifierRaw, 'passkey verifier');
  const authorizationEpoch = decodeUint(epochRaw, 'authorization epoch');
  return { verifier, verifierConfigured: verifier !== ZERO_ADDRESS, authorizationEpoch };
}

export function extractP256PublicKeyFromSpki(publicKeySpki) {
  const bytes = typeof publicKeySpki === 'string' ? base64UrlToBytes(publicKeySpki) : new Uint8Array(publicKeySpki || []);
  if (bytes.length < 65) throw new Error('P-256 SPKI public key unavailable');
  let offset = -1;
  for (let i = bytes.length - 65; i >= 0; i -= 1) {
    if (bytes[i] === 0x04 && bytes.length - i >= 65) { offset = i; break; }
  }
  if (offset < 0 || offset + 65 > bytes.length) throw new Error('uncompressed P-256 public key point not found');
  const xBytes = bytes.slice(offset + 1, offset + 33);
  const yBytes = bytes.slice(offset + 33, offset + 65);
  const x = BigInt(`0x${[...xBytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`);
  const y = BigInt(`0x${[...yBytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`);
  if (x === 0n || y === 0n) throw new Error('invalid P-256 public key coordinates');
  return { x, y };
}

export async function buildPasskeyEnrollmentReview({
  registration,
  smartAccountState,
  rp,
  label = 'This device',
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (!registration?.rawId) throw new Error('serialized WebAuthn registration required');
  if (!registration.publicKeySpki) throw new Error('registration response does not expose the ES256 public key');
  const rpConfig = normalizeRpConfiguration(rp);
  const credentialIdBytes = base64UrlToBytes(registration.rawId);
  const credentialIdHash = hex32(await sha256(credentialIdBytes, cryptoImpl));
  const rpIdHash = hex32(await sha256Text(rpConfig.rpId, cryptoImpl));
  const originHash = hex32(await sha256Text(rpConfig.origin, cryptoImpl));
  const { x: publicKeyX, y: publicKeyY } = extractP256PublicKeyFromSpki(registration.publicKeySpki);
  return {
    smartAccount: normalizeAddress(smartAccountState.smartAccount),
    authorizationEpoch: BigInt(smartAccountState.authorizationEpoch),
    credentialId: registration.rawId,
    credentialIdHash,
    publicKeyX,
    publicKeyY,
    rpId: rpConfig.rpId,
    origin: rpConfig.origin,
    rpIdHash,
    originHash,
    label,
    transports: registration.transports || [],
    authenticatorAttachment: registration.authenticatorAttachment || null,
  };
}

export async function preparePasskeyEnrollment(provider, controller, smartAccountState, review) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const chainState = await readPasskeyManagementState(provider, smartAccountState.smartAccount);
  if (!chainState.verifierConfigured) throw new Error('SmartAccount420 passkey verifier is not configured');
  if (chainState.authorizationEpoch !== BigInt(review.authorizationEpoch)) throw new Error('authorization epoch changed; restart passkey enrollment');
  if (normalizeAddress(review.smartAccount) !== normalizeAddress(smartAccountState.smartAccount)) throw new Error('passkey enrollment review belongs to a different SmartAccount');
  const data = `0x${SELECTOR_REGISTER_PASSKEY}${bytes32Word(review.credentialIdHash, 'credentialIdHash')}${uintWord(review.publicKeyX, 'publicKeyX')}${uintWord(review.publicKeyY, 'publicKeyY')}${bytes32Word(review.rpIdHash, 'rpIdHash')}${bytes32Word(review.originHash, 'originHash')}`;
  const transaction = { from: owner, to: normalizeAddress(smartAccountState.smartAccount), value: '0x0', data };
  const simulation = await simulate(provider, transaction, 'passkey enrollment');
  return { review, previousEpoch: chainState.authorizationEpoch, transaction, simulation };
}

export async function sendPasskeyEnrollment(provider, controller, smartAccountState, review) {
  const prepared = await preparePasskeyEnrollment(provider, controller, smartAccountState, review);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, txHash, submitted: true };
}

export async function preparePasskeyRevocation(provider, controller, smartAccountState) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const chainState = await readPasskeyManagementState(provider, smartAccountState.smartAccount);
  if (!chainState.verifierConfigured) throw new Error('SmartAccount420 passkey verifier is not configured');
  const transaction = { from: owner, to: normalizeAddress(smartAccountState.smartAccount), value: '0x0', data: `0x${SELECTOR_REVOKE_PASSKEY}` };
  const simulation = await simulate(provider, transaction, 'passkey revocation');
  return { previousEpoch: chainState.authorizationEpoch, transaction, simulation };
}

export async function sendPasskeyRevocation(provider, controller, smartAccountState) {
  const prepared = await preparePasskeyRevocation(provider, controller, smartAccountState);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, txHash, submitted: true };
}

export async function confirmPasskeyManagementTransaction(provider, txHash, smartAccountState, previousEpoch, options = {}) {
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
  if (!receipt) throw new Error('passkey management transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('passkey management transaction reverted');
  const state = await readPasskeyManagementState(provider, smartAccountState.smartAccount);
  if (state.authorizationEpoch <= BigInt(previousEpoch)) throw new Error('passkey management did not advance authorization epoch');
  return { txHash: normalizedHash, receipt, authorizationEpoch: state.authorizationEpoch, verifier: state.verifier };
}

export function finalizePasskeyEnrollmentDevice(review, confirmedEpoch, createdAt = Date.now()) {
  return createPasskeyDeviceRecord({
    smartAccount: review.smartAccount,
    authorizationEpoch: Number(confirmedEpoch),
    credentialId: review.credentialId,
    credentialIdHash: review.credentialIdHash,
    rpId: review.rpId,
    origin: review.origin,
    label: review.label,
    transports: review.transports,
    authenticatorAttachment: review.authenticatorAttachment,
    createdAt,
  });
}

export function finalizePasskeyRevocationDevice(record, revokedAt = Date.now()) {
  return revokePasskeyDeviceRecord(record, revokedAt);
}

export function finalizePasskeyReplacementDevice(previousRecord, review, confirmedEpoch, replacedAt = Date.now()) {
  return replacePasskeyDeviceRecord(previousRecord, {
    smartAccount: review.smartAccount,
    authorizationEpoch: Number(confirmedEpoch),
    credentialId: review.credentialId,
    credentialIdHash: review.credentialIdHash,
    rpId: review.rpId,
    origin: review.origin,
    label: review.label,
    transports: review.transports,
    authenticatorAttachment: review.authenticatorAttachment,
    createdAt: replacedAt,
  }, replacedAt);
}

export { SELECTOR_REGISTER_PASSKEY, SELECTOR_REVOKE_PASSKEY, SELECTOR_PASSKEY_VERIFIER };
