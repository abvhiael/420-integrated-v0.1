import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { inspectCapabilityGrant, CANONICAL_CAPABILITY_REGISTRY_420 } from './capabilities.js';

const SELECTOR_CREATE_GAS_SPONSOR_GRANT = '297945e0';
const SELECTOR_REVOKE_CAPABILITY_GRANT = 'be737654';
const ZERO_BYTES32 = `0x${'0'.repeat(64)}`;
const UINT64_MAX = (1n << 64n) - 1n;
const UINT256_MAX = (1n << 256n) - 1n;

function word(hex) { return hex.replace(/^0x/, '').padStart(64, '0'); }
function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function normalizeTxHash(value) {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error('invalid transaction hash');
  return value.toLowerCase();
}
function normalizeUint(value, label, max = UINT256_MAX) {
  let n;
  try { n = typeof value === 'bigint' ? value : BigInt(value === '' ? '0' : value); }
  catch { throw new Error(`${label} must be an unsigned integer`); }
  if (n < 0n || n > max) throw new Error(`${label} out of range`);
  return n;
}
function assertOwnerBoundary(controller, smartAccountState) {
  const owner = normalizeAddress(controller);
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before capability management');
  if (!smartAccountState.controllerIsOwner || normalizeAddress(smartAccountState.owner) !== owner) {
    throw new Error('connected controller is not the on-chain SmartAccount420 owner');
  }
  if (normalizeAddress(smartAccountState.capabilityRegistry) !== CANONICAL_CAPABILITY_REGISTRY_420) {
    throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  }
  return owner;
}
function encodeCreateGasSponsorGrant(request) {
  return `0x${SELECTOR_CREATE_GAS_SPONSOR_GRANT}${word(request.sponsor)}${request.operation.slice(2)}${uintWord(request.perCallLimit)}${uintWord(request.periodLimit)}${uintWord(request.periodSeconds)}${uintWord(request.validFrom)}${uintWord(request.validUntil)}`;
}
function encodeRevokeCapabilityGrant(grantId) {
  return `0x${SELECTOR_REVOKE_CAPABILITY_GRANT}${normalizeBytes32(grantId).slice(2)}`;
}
async function simulate(provider, transaction, label) {
  let result;
  try { result = await provider.request('eth_call', [transaction, 'latest']); }
  catch (error) { throw new Error(`${label} simulation reverted: ${error?.message || 'eth_call failed'}`); }
  let gas;
  try { gas = await provider.request('eth_estimateGas', [transaction]); }
  catch (error) { throw new Error(`${label} gas estimation failed: ${error?.message || 'eth_estimateGas failed'}`); }
  if (typeof gas !== 'string' || !/^0x[0-9a-fA-F]+$/.test(gas)) throw new Error('invalid gas estimate');
  return { result, gas: gas.toLowerCase() };
}

export function normalizeGasSponsorGrantRequest(request = {}) {
  const sponsor = normalizeAddress(request.sponsor);
  if (sponsor === '0x0000000000000000000000000000000000000000') throw new Error('sponsor must be non-zero');
  const operation = normalizeBytes32(request.operation);
  if (operation === ZERO_BYTES32) throw new Error('operation must be non-zero');
  const perCallLimit = normalizeUint(request.perCallLimit ?? 0n, 'per-call limit');
  const periodLimit = normalizeUint(request.periodLimit ?? 0n, 'period limit');
  const periodSeconds = normalizeUint(request.periodSeconds ?? 0n, 'period seconds', UINT64_MAX);
  const validFrom = normalizeUint(request.validFrom ?? 0n, 'valid from', UINT64_MAX);
  const validUntil = normalizeUint(request.validUntil ?? 0n, 'valid until', UINT64_MAX);
  if ((periodLimit === 0n) !== (periodSeconds === 0n)) throw new Error('period limit and period seconds must both be zero or both be non-zero');
  if (validUntil !== 0n && validUntil <= validFrom) throw new Error('valid until must be zero or greater than valid from');
  return { sponsor, operation, perCallLimit, periodLimit, periodSeconds, validFrom, validUntil };
}

export async function prepareGasSponsorGrantCreation(provider, controller, smartAccountState, request = {}) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const normalized = normalizeGasSponsorGrantRequest(request);
  const transaction = {
    from: owner,
    to: normalizeAddress(smartAccountState.smartAccount),
    value: '0x0',
    data: encodeCreateGasSponsorGrant(normalized),
  };
  const simulation = await simulate(provider, transaction, 'gas sponsor grant creation');
  const expectedGrantId = normalizeBytes32(simulation.result);
  if (expectedGrantId === ZERO_BYTES32) throw new Error('gas sponsor grant simulation returned zero grant ID');
  return { ...normalized, transaction, simulation: { passed: true, ...simulation }, expectedGrantId };
}

export async function sendGasSponsorGrantCreation(provider, controller, smartAccountState, request = {}) {
  const prepared = await prepareGasSponsorGrantCreation(provider, controller, smartAccountState, request);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function prepareCapabilityGrantRevocation(provider, controller, smartAccountState, grantId) {
  const owner = assertOwnerBoundary(controller, smartAccountState);
  const inspection = await inspectCapabilityGrant(provider, smartAccountState, grantId);
  if (!inspection.exists) throw new Error('capability grant does not exist');
  if (!inspection.belongsToAccount) throw new Error('capability grant does not belong to this SmartAccount420');
  if (inspection.grant.revoked) throw new Error('capability grant is already revoked');
  const transaction = {
    from: owner,
    to: normalizeAddress(smartAccountState.smartAccount),
    value: '0x0',
    data: encodeRevokeCapabilityGrant(inspection.grantId),
  };
  const simulation = await simulate(provider, transaction, 'capability grant revocation');
  return { grantId: inspection.grantId, inspection, transaction, simulation: { passed: true, ...simulation } };
}

export async function sendCapabilityGrantRevocation(provider, controller, smartAccountState, grantId) {
  const prepared = await prepareCapabilityGrantRevocation(provider, controller, smartAccountState, grantId);
  const txHash = normalizeTxHash(await provider.request('eth_sendTransaction', [prepared.transaction]));
  return { ...prepared, submitted: true, txHash };
}

export async function confirmCapabilityManagementTransaction(provider, txHash, smartAccountState, expected = {}, options = {}) {
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
  if (!receipt) throw new Error('capability management transaction was not confirmed');
  if (receipt.status !== '0x1') throw new Error('capability management transaction reverted');

  if (expected.createdGrantId) {
    const inspection = await inspectCapabilityGrant(provider, smartAccountState, expected.createdGrantId);
    if (!inspection.exists || !inspection.belongsToAccount || inspection.grant.revoked) {
      throw new Error('created capability grant failed post-confirmation verification');
    }
    if (expected.principal && inspection.grant.principal !== normalizeAddress(expected.principal)) {
      throw new Error('created capability grant principal mismatch');
    }
    return { txHash: normalizedHash, receipt, inspection };
  }
  if (expected.revokedGrantId) {
    const inspection = await inspectCapabilityGrant(provider, smartAccountState, expected.revokedGrantId);
    if (!inspection.exists || !inspection.belongsToAccount || !inspection.grant.revoked) {
      throw new Error('capability grant revocation failed post-confirmation verification');
    }
    return { txHash: normalizedHash, receipt, inspection };
  }
  return { txHash: normalizedHash, receipt };
}
