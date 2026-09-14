import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';
import { validateGamingRegistrationProfile420 } from './gaming-registration-profile.mjs';

const SCHEMA_VERSION = '1.0.0';
const HEX_SELECTOR_RE = /^0x[0-9a-fA-F]{8}$/;
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class GamingAuthorityOnboardingError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingAuthorityOnboardingError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingAuthorityOnboardingError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function text420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

function exactKeys420(value, allowed, name) {
  for (const key of Object.keys(value)) assert420(allowed.has(key), `${name} contains unsupported field: ${key}`);
}

export function validateGamingAuthorityPlan420(input) {
  const plan = object420(input, 'gaming authority plan');
  exactKeys420(plan, new Set(['schemaVersion','gameId','applicationId','smartAccount','capabilityRegistry','sessionPolicy']), 'gaming authority plan');
  assert420(plan.schemaVersion === SCHEMA_VERSION, 'unsupported gaming authority plan schemaVersion');

  const gameId = text420(plan.gameId, 'gameId', 128);
  const applicationId = text420(plan.applicationId, 'applicationId', 128);

  const smartAccount = object420(plan.smartAccount, 'smartAccount');
  exactKeys420(smartAccount, new Set(['requiredForCoreGameplay','walletLinkOptional','sessionExecutionOnly']), 'smartAccount');
  assert420(smartAccount.requiredForCoreGameplay === false, 'SmartAccount cannot be required for core gameplay');
  assert420(smartAccount.walletLinkOptional === true, 'wallet linkage must remain optional');
  assert420(smartAccount.sessionExecutionOnly === true, 'session authority must execute through SmartAccount420 session execution');

  const registry = object420(plan.capabilityRegistry, 'capabilityRegistry');
  exactKeys420(registry, new Set(['scope','grantAuthority','developerHubCanGrant','gameIdBound','actionBound']), 'capabilityRegistry');
  assert420(registry.scope === 'game', 'CapabilityRegistry scope must be game');
  assert420(registry.grantAuthority === 'CapabilityRegistry420', 'grant authority must remain CapabilityRegistry420');
  assert420(registry.developerHubCanGrant === false, 'Developer Hub cannot mint capability grants');
  assert420(registry.gameIdBound === true, 'capability grants must bind exact gameId');
  assert420(registry.actionBound === true, 'capability grants must bind exact action');

  const sessionPolicy = object420(plan.sessionPolicy, 'sessionPolicy');
  exactKeys420(sessionPolicy, new Set(['authorizationEpochRequired','defaultDeny','calls']), 'sessionPolicy');
  assert420(sessionPolicy.authorizationEpochRequired === true, 'session policy must require authorization epoch validation');
  assert420(sessionPolicy.defaultDeny === true, 'session policy must default deny');
  assert420(Array.isArray(sessionPolicy.calls) && sessionPolicy.calls.length >= 1, 'sessionPolicy.calls must contain at least one call');

  const seen = new Set();
  const calls = sessionPolicy.calls.map((raw, index) => {
    const call = object420(raw, `sessionPolicy.calls[${index}]`);
    exactKeys420(call, new Set(['target','selector','valueLimitWei','gameId','action']), `sessionPolicy.calls[${index}]`);
    const target = text420(call.target, `sessionPolicy.calls[${index}].target`, 42);
    const selector = text420(call.selector, `sessionPolicy.calls[${index}].selector`, 10);
    const action = text420(call.action, `sessionPolicy.calls[${index}].action`, 96);
    const callGameId = text420(call.gameId, `sessionPolicy.calls[${index}].gameId`, 128);
    assert420(ADDRESS_RE.test(target), `sessionPolicy.calls[${index}].target must be an address`);
    assert420(HEX_SELECTOR_RE.test(selector), `sessionPolicy.calls[${index}].selector must be a bytes4 selector`);
    assert420(callGameId === gameId, `sessionPolicy.calls[${index}].gameId must match authority plan gameId`);
    assert420(typeof call.valueLimitWei === 'string' && /^\d+$/.test(call.valueLimitWei), `sessionPolicy.calls[${index}].valueLimitWei must be a decimal string`);
    assert420(call.valueLimitWei === '0', 'gaming session calls must not authorize native value transfer');
    assert420(action !== '*' && !action.includes('global') && !action.includes('wallet-wide'), `forbidden session authority action: ${action}`);
    const key = `${target.toLowerCase()}:${selector.toLowerCase()}:${action}`;
    assert420(!seen.has(key), 'duplicate session call authority');
    seen.add(key);
    return Object.freeze({ target: target.toLowerCase(), selector: selector.toLowerCase(), valueLimitWei: '0', gameId: callGameId, action });
  });

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    gameId,
    applicationId,
    smartAccount: Object.freeze({ requiredForCoreGameplay: false, walletLinkOptional: true, sessionExecutionOnly: true }),
    capabilityRegistry: Object.freeze({ scope: 'game', grantAuthority: 'CapabilityRegistry420', developerHubCanGrant: false, gameIdBound: true, actionBound: true }),
    sessionPolicy: Object.freeze({ authorizationEpochRequired: true, defaultDeny: true, calls: Object.freeze(calls) })
  });
}

export function createGamingAuthorityOnboardingPlan420({ onboardingManifest, registrationProfile, authorityPlan }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const registration = validateGamingRegistrationProfile420(registrationProfile);
  const authority = validateGamingAuthorityPlan420(authorityPlan);
  const expectedApplicationId = onboarding.gameId.toLowerCase().replaceAll('/', '-');

  assert420(authority.gameId === onboarding.gameId, 'authority plan gameId must match onboarding manifest');
  assert420(authority.applicationId === expectedApplicationId, 'authority plan applicationId must match onboarding identity');
  assert420(registration.gameId === onboarding.gameId, 'registration profile gameId must match onboarding manifest');
  assert420(registration.applicationId === expectedApplicationId, 'registration profile applicationId must match onboarding identity');

  const declaredActions = new Set(registration.capabilities.flatMap((capability) => capability.actions));
  for (const call of authority.sessionPolicy.calls) {
    assert420(declaredActions.has(call.action), `session action was not declared during capability onboarding: ${call.action}`);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'READY_FOR_AUTHORITY_PREFLIGHT',
    gameId: onboarding.gameId,
    applicationId: expectedApplicationId,
    smartAccountAuthority: 'SmartAccount420',
    capabilityGrantAuthority: 'CapabilityRegistry420',
    developerHubAuthority: false,
    canonicalGrantCreated: false,
    walletLinkRequiredForCoreGameplay: false,
    sessionPolicy: authority.sessionPolicy,
    nextActions: Object.freeze([
      'VERIFY_SMARTACCOUNT_SESSION_EXECUTION',
      'VERIFY_CAPABILITY_REGISTRY_GAME_SCOPE',
      'VERIFY_SELECTOR_AND_ACTION_SCOPE',
      'VERIFY_AUTHORIZATION_EPOCH',
      'HANDOFF_TO_CANONICAL_AUTHORITY'
    ])
  });
}
