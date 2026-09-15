import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';

const SCHEMA_VERSION = '1.0.0';

export const GamingProtocolActions420 = Object.freeze({
  identity: Object.freeze(['profile:read', 'profile:ensure']),
  entitlements: Object.freeze(['entitlement:read', 'entitlement:verify']),
  claims: Object.freeze(['claim:prepare', 'claim:read']),
  attestations: Object.freeze(['attestation:read', 'attestation:verify']),
  migration: Object.freeze(['migration:prepare', 'migration:claim', 'migration:consume']),
  'smart-account': Object.freeze(['session:request', 'session:status'])
});

export class GamingRegistrationProfileError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingRegistrationProfileError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingRegistrationProfileError420(message);
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

export function validateGamingRegistrationProfile420(input) {
  const profile = object420(input, 'gaming registration profile');
  exactKeys420(profile, new Set(['schemaVersion','gameId','applicationId','capabilities','compatibility']), 'gaming registration profile');
  assert420(profile.schemaVersion === SCHEMA_VERSION, 'unsupported gaming registration profile schemaVersion');

  const gameId = text420(profile.gameId, 'gameId', 128);
  const applicationId = text420(profile.applicationId, 'applicationId', 128);

  assert420(Array.isArray(profile.capabilities) && profile.capabilities.length >= 1, 'capabilities must contain at least one declaration');
  const seenProtocols = new Set();
  const capabilities = profile.capabilities.map((raw, index) => {
    const capability = object420(raw, `capabilities[${index}]`);
    exactKeys420(capability, new Set(['protocol','scope','actions']), `capabilities[${index}]`);
    const protocol = text420(capability.protocol, `capabilities[${index}].protocol`, 64);
    assert420(Object.hasOwn(GamingProtocolActions420, protocol), `unsupported gaming protocol capability: ${protocol}`);
    assert420(!seenProtocols.has(protocol), `duplicate gaming protocol capability: ${protocol}`);
    seenProtocols.add(protocol);

    assert420(capability.scope === 'game', `capabilities[${index}].scope must be game`);
    assert420(Array.isArray(capability.actions) && capability.actions.length >= 1, `capabilities[${index}].actions must contain at least one action`);
    const allowedActions = GamingProtocolActions420[protocol];
    const actions = capability.actions.map((value, actionIndex) => text420(value, `capabilities[${index}].actions[${actionIndex}]`, 96));
    assert420(new Set(actions).size === actions.length, `capabilities[${index}].actions must be unique`);
    for (const action of actions) {
      assert420(action !== '*' && !action.includes('wallet-wide') && !action.includes('global'), `forbidden gaming authority action: ${action}`);
      assert420(allowedActions.includes(action), `unsupported action ${action} for protocol ${protocol}`);
    }
    return Object.freeze({ protocol, scope: 'game', actions: Object.freeze(actions) });
  });

  const compatibility = object420(profile.compatibility, 'compatibility');
  exactKeys420(compatibility, new Set(['gamingProtocol','sdkPackage','minimumSdkVersion','finalityModel']), 'compatibility');
  assert420(compatibility.gamingProtocol === '420GP/V1', 'compatibility.gamingProtocol must be 420GP/V1');
  assert420(compatibility.sdkPackage === '@420/gaming-sdk', 'compatibility.sdkPackage must be @420/gaming-sdk');
  const minimumSdkVersion = text420(compatibility.minimumSdkVersion, 'compatibility.minimumSdkVersion', 32);
  assert420(/^\d+\.\d+\.\d+$/.test(minimumSdkVersion), 'compatibility.minimumSdkVersion must be semver');
  assert420(compatibility.finalityModel === 'GP-16', 'compatibility.finalityModel must be GP-16');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    gameId,
    applicationId,
    capabilities: Object.freeze(capabilities),
    compatibility: Object.freeze({
      gamingProtocol: '420GP/V1',
      sdkPackage: '@420/gaming-sdk',
      minimumSdkVersion,
      finalityModel: 'GP-16'
    })
  });
}

export function createGamingRegistrationPlan420({ onboardingManifest, registrationProfile }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const profile = validateGamingRegistrationProfile420(registrationProfile);
  const expectedApplicationId = onboarding.gameId.toLowerCase().replaceAll('/', '-');

  assert420(profile.gameId === onboarding.gameId, 'registration profile gameId must match onboarding manifest');
  assert420(profile.applicationId === expectedApplicationId, 'registration profile applicationId must match onboarding application identity');

  const declaredProtocols = new Set(onboarding.protocols);
  for (const capability of profile.capabilities) {
    assert420(declaredProtocols.has(capability.protocol), `capability protocol was not declared during onboarding: ${capability.protocol}`);
  }

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'READY_FOR_CAPABILITY_PREFLIGHT',
    gameId: onboarding.gameId,
    applicationId: profile.applicationId,
    capabilities: profile.capabilities,
    compatibility: profile.compatibility,
    developerHubAuthority: false,
    authorityBoundary: 'CapabilityRegistry420 / canonical game-scoped grant authority',
    canonicalGrantCreated: false,
    nextActions: Object.freeze([
      'VERIFY_DECLARED_PROTOCOLS',
      'VERIFY_GAME_SCOPES',
      'VERIFY_ACTION_CATALOGUE',
      'HANDOFF_TO_CAPABILITY_REGISTRY_AUTHORITY'
    ])
  });
}
