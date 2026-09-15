import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';
import { validateGamingRegistrationProfile420 } from './gaming-registration-profile.mjs';

const SCHEMA_VERSION = '1.0.0';

export class GamingSdkGeneratorError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingSdkGeneratorError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingSdkGeneratorError420(message);
}

function stableObject420(value) {
  if (Array.isArray(value)) return value.map(stableObject420);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableObject420(value[key])]));
}

function stableJson420(value) {
  return `${JSON.stringify(stableObject420(value), null, 2)}\n`;
}

export function createGamingSdkIntegration420({ onboardingManifest, registrationProfile }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const profile = validateGamingRegistrationProfile420(registrationProfile);
  const expectedApplicationId = onboarding.gameId.toLowerCase().replaceAll('/', '-');

  assert420(profile.gameId === onboarding.gameId, 'registration profile gameId must match onboarding manifest');
  assert420(profile.applicationId === expectedApplicationId, 'registration profile applicationId must match onboarding application identity');

  const declaredProtocols = new Set(onboarding.protocols);
  for (const capability of profile.capabilities) {
    assert420(declaredProtocols.has(capability.protocol), `capability protocol was not declared during onboarding: ${capability.protocol}`);
    assert420(capability.scope === 'game', `capability scope must remain game for ${capability.protocol}`);
  }

  const protocolClients = profile.capabilities.map((capability) => Object.freeze({
    protocol: capability.protocol,
    scope: 'game',
    actions: capability.actions,
    gameId: onboarding.gameId
  }));

  const config = Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    gameId: onboarding.gameId,
    applicationId: expectedApplicationId,
    sdk: Object.freeze({
      package: profile.compatibility.sdkPackage,
      minimumVersion: profile.compatibility.minimumSdkVersion,
      gamingProtocol: profile.compatibility.gamingProtocol,
      finalityModel: profile.compatibility.finalityModel
    }),
    progressiveAccess: onboarding.progressiveAccess,
    protocols: Object.freeze([...onboarding.protocols]),
    protocolClients: Object.freeze(protocolClients),
    authority: Object.freeze({
      scope: 'game',
      canonicalGrantCreated: false,
      developerHubAuthority: false,
      source: 'CapabilityRegistry420'
    }),
    forbiddenSurfaces: Object.freeze([
      'wallet-wide-game-history',
      'cross-game-player-activity-feed',
      'enumerate-all-entitlements-for-wallet',
      'enumerate-all-attestations-for-wallet',
      'enumerate-all-claims-for-wallet'
    ])
  });

  const starter = [
    `import { createGamingClient420 } from '${profile.compatibility.sdkPackage}';`,
    '',
    `export const GAME_ID = ${JSON.stringify(onboarding.gameId)};`,
    '',
    'export function createGameClient(adapters) {',
    '  return createGamingClient420({ gameId: GAME_ID, adapters });',
    '}',
    ''
  ].join('\n');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'READY_FOR_SDK_INTEGRATION',
    gameId: onboarding.gameId,
    applicationId: expectedApplicationId,
    files: Object.freeze({
      '420-gaming.config.json': stableJson420(config),
      'src/420-gaming-client.mjs': starter
    }),
    config,
    developerHubAuthority: false,
    canonicalGrantCreated: false
  });
}
