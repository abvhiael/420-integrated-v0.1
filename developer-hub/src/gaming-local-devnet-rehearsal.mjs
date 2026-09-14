import { createGamingSdkIntegration420 } from './gaming-sdk-generator.mjs';

const SCHEMA_VERSION = '1.0.0';

export class GamingLocalDevnetRehearsalError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingLocalDevnetRehearsalError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingLocalDevnetRehearsalError420(message);
}

function validateDevnetProfile420(profile) {
  assert420(profile && typeof profile === 'object' && !Array.isArray(profile), 'devnet profile must be an object');
  assert420(profile.schemaVersion === SCHEMA_VERSION, 'devnet profile schemaVersion must be 1.0.0');
  assert420(profile.profile === 'real15', 'GP-17.8 rehearsal must use the DEVHUB-5 real15 profile');
  assert420(profile.environment === 'local', 'GP-17.8 rehearsal must remain local');
  assert420(profile.chainId === '420', 'GP-17.8 rehearsal chainId must be 420');
  assert420(profile.executionNodes === 15 && profile.consensusNodes === 15, 'GP-17.8 rehearsal requires 15 execution and 15 consensus nodes');
  assert420(profile.consensusTransport === 'devnet-tcp', 'GP-17.8 rehearsal must use the deterministic devnet-tcp transport');
  return profile;
}

export function createGamingLocalDevnetRehearsal420({ onboardingManifest, registrationProfile, devnetProfile }) {
  const devnet = validateDevnetProfile420(devnetProfile);
  const integration = createGamingSdkIntegration420({ onboardingManifest, registrationProfile });

  assert420(integration.status === 'READY_FOR_SDK_INTEGRATION', 'generated SDK integration must be ready before rehearsal');
  assert420(integration.config.authority.developerHubAuthority === false, 'Developer Hub cannot become authority during rehearsal');
  assert420(integration.config.authority.canonicalGrantCreated === false, 'local rehearsal cannot create a canonical grant');
  assert420(integration.config.sdk.finalityModel === 'GP-16', 'local rehearsal must preserve GP-16 finality semantics');

  const commands = Object.freeze([
    'npm run devnet:doctor',
    'npm run devnet:plan',
    'npm run devnet:prepare',
    'npm run devnet:smoke'
  ]);

  const checks = Object.freeze([
    Object.freeze({ id: 'DEVNET_PROFILE', required: true, expected: 'real15/local/chain-420' }),
    Object.freeze({ id: 'SDK_CONFIG', required: true, expected: 'generated integration pinned to canonical gameId' }),
    Object.freeze({ id: 'GUEST_CORE', required: true, expected: 'core gameplay remains wallet-free' }),
    Object.freeze({ id: 'REGISTERED_CONTINUITY', required: true, expected: 'registered core progression remains wallet-free' }),
    Object.freeze({ id: 'WALLET_OPTIONAL', required: true, expected: 'wallet-linked features remain optional' }),
    Object.freeze({ id: 'AUTHORITY_BOUNDARY', required: true, expected: 'no Developer Hub grant/session authority' }),
    Object.freeze({ id: 'FINALITY_MODEL', required: true, expected: 'GP-16 fail-closed semantics preserved' })
  ]);

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'READY_FOR_LOCAL_DEVNET_REHEARSAL',
    gameId: integration.gameId,
    applicationId: integration.applicationId,
    devnet: Object.freeze({
      profile: devnet.profile,
      environment: devnet.environment,
      chainId: devnet.chainId,
      executionNodes: devnet.executionNodes,
      consensusNodes: devnet.consensusNodes,
      consensusTransport: devnet.consensusTransport
    }),
    generatedFiles: Object.freeze(Object.keys(integration.files).sort()),
    commands,
    checks,
    developerHubAuthority: false,
    canonicalGrantCreated: false,
    canonicalRegistrationCreated: false,
    liveTestnetQualified: false,
    authorityBoundary: 'local deterministic rehearsal only; canonical Registry, CapabilityRegistry420, SmartAccount420 and chain state remain authoritative'
  });
}
