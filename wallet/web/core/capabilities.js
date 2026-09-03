import { normalizeAddress, normalizeBytes32 } from './abi.js';
import { hasCode } from './accounts.js';

export const CANONICAL_CAPABILITY_REGISTRY_420 = '0x0000000000000000000000000000000000000421';
export const SESSION_EXECUTE_CAPABILITY_420 = '0x9d4b56157e30269b50ea6c6e4f268e8360bf5565165cd55c66ad0c4d007c9f92';
const SELECTOR_GRANT = '918e9de3';
const SELECTOR_USAGE = '4a8f2a54';
const SELECTOR_ACCOUNT_COMPONENT_ID = '2b081d1d';
const SELECTOR_ACTIVE_GRANT_ID = 'fabe3409';
const SELECTOR_IS_AUTHORIZED = '1e4129c9';

function word(value) { return value.replace(/^0x/, '').padStart(64, '0'); }
function addressWord(value) { return normalizeAddress(value).slice(2).padStart(64, '0'); }
function uintWord(value) { return BigInt(value).toString(16).padStart(64, '0'); }
function wordAt(result, index) {
  if (typeof result !== 'string' || !/^0x[0-9a-fA-F]*$/.test(result)) throw new Error('invalid capability ABI response');
  const hex = result.slice(2);
  const start = index * 64;
  if (hex.length < start + 64) throw new Error('truncated capability ABI response');
  return hex.slice(start, start + 64);
}
function decodeAddressWord(hex) { return normalizeAddress(`0x${hex.slice(-40)}`); }
function decodeBytes32Word(hex) { return normalizeBytes32(`0x${hex}`); }
function decodeUintWord(hex) { return BigInt(`0x${hex}`); }
function decodeBoolWord(hex) {
  const value = decodeUintWord(hex);
  if (value !== 0n && value !== 1n) throw new Error('invalid ABI bool');
  return value === 1n;
}
async function call(provider, to, data) {
  return provider.request('eth_call', [{ to: normalizeAddress(to), data }, 'latest']);
}

export async function readAccountComponentId(provider, smartAccount) {
  return decodeBytes32Word(wordAt(await call(provider, smartAccount, `0x${SELECTOR_ACCOUNT_COMPONENT_ID}`), 0));
}

export async function inspectCapabilityGrant(provider, smartAccountState, grantId) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before permission inspection');
  const registry = normalizeAddress(smartAccountState.capabilityRegistry);
  if (registry !== CANONICAL_CAPABILITY_REGISTRY_420) throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  if (!(await hasCode(provider, registry))) throw new Error('canonical CapabilityRegistry420 has no deployed code');

  const normalizedGrantId = normalizeBytes32(grantId);
  const [componentId, grantResult, usageResult] = await Promise.all([
    readAccountComponentId(provider, smartAccountState.smartAccount),
    call(provider, registry, `0x${SELECTOR_GRANT}${normalizedGrantId.slice(2)}`),
    call(provider, registry, `0x${SELECTOR_USAGE}${normalizedGrantId.slice(2)}`),
  ]);

  const grant = {
    principal: decodeAddressWord(wordAt(grantResult, 0)),
    componentId: decodeBytes32Word(wordAt(grantResult, 1)),
    capabilityId: decodeBytes32Word(wordAt(grantResult, 2)),
    scopeHash: decodeBytes32Word(wordAt(grantResult, 3)),
    perCallLimit: decodeUintWord(wordAt(grantResult, 4)),
    periodLimit: decodeUintWord(wordAt(grantResult, 5)),
    periodSeconds: decodeUintWord(wordAt(grantResult, 6)),
    validFrom: decodeUintWord(wordAt(grantResult, 7)),
    validUntil: decodeUintWord(wordAt(grantResult, 8)),
    revoked: decodeBoolWord(wordAt(grantResult, 9)),
  };
  const usage = { periodIndex: decodeUintWord(wordAt(usageResult, 0)), used: decodeUintWord(wordAt(usageResult, 1)) };
  const exists = grant.principal !== '0x0000000000000000000000000000000000000000';
  const belongsToAccount = exists && grant.componentId === componentId;
  return { registry, grantId: normalizedGrantId, accountComponentId: componentId, exists, belongsToAccount, grant, usage };
}

export async function readActiveGrantId(provider, smartAccountState, principal, capabilityId, scopeHash) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before authorization inspection');
  const registry = normalizeAddress(smartAccountState.capabilityRegistry);
  if (registry !== CANONICAL_CAPABILITY_REGISTRY_420) throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  const componentId = await readAccountComponentId(provider, smartAccountState.smartAccount);
  const data = `0x${SELECTOR_ACTIVE_GRANT_ID}${addressWord(principal)}${componentId.slice(2)}${normalizeBytes32(capabilityId).slice(2)}${normalizeBytes32(scopeHash).slice(2)}`;
  return decodeBytes32Word(wordAt(await call(provider, registry, data), 0));
}

export async function readCapabilityAuthorization(provider, smartAccountState, principal, capabilityId, scopeHash, amount) {
  if (!smartAccountState?.deployed) throw new Error('SmartAccount420 must be deployed before authorization inspection');
  const registry = normalizeAddress(smartAccountState.capabilityRegistry);
  if (registry !== CANONICAL_CAPABILITY_REGISTRY_420) throw new Error('SmartAccount420 is not bound to the canonical CapabilityRegistry420');
  const componentId = await readAccountComponentId(provider, smartAccountState.smartAccount);
  const data = `0x${SELECTOR_IS_AUTHORIZED}${addressWord(principal)}${componentId.slice(2)}${normalizeBytes32(capabilityId).slice(2)}${normalizeBytes32(scopeHash).slice(2)}${uintWord(amount)}`;
  return decodeBoolWord(wordAt(await call(provider, registry, data), 0));
}
