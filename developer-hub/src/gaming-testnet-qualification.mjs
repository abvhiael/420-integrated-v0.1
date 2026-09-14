import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';
import { validateGamingRegistrationProfile420 } from './gaming-registration-profile.mjs';
import { createSecurityQualificationReport420 } from './security-qualification.mjs';

const SCHEMA_VERSION = '1.0.0';
const SHA_RE = /^[0-9a-f]{40}$/;
const REQUIRED_CHECKS = Object.freeze([
  ['network-discovery', 'network'],
  ['faucet-account', 'testnet-access'],
  ['sdk-integration', 'integration'],
  ['registration-read', 'registry'],
  ['finalized-state-read', 'finality'],
  ['wallet-optionality', 'progressive-access'],
  ['authority-scope', 'authorization']
]);

export class GamingTestnetQualificationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingTestnetQualificationError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingTestnetQualificationError420(message);
}

function expectedApplicationId420(gameId) {
  return gameId.toLowerCase().replaceAll('/', '-');
}

function qualificationProfile420(gameId) {
  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    profileId: `gaming-testnet-${gameId.split('/')[3].toLowerCase().replaceAll('_', '-')}`,
    canonicalAuthority: false,
    securityCertification: false,
    checks: Object.freeze(REQUIRED_CHECKS.map(([id, category]) => Object.freeze({
      id,
      category,
      required: true,
      environments: Object.freeze(['testnet'])
    })))
  });
}

export function createGamingTestnetQualification420({ onboardingManifest, registrationProfile, evidence, network }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const registration = validateGamingRegistrationProfile420(registrationProfile);
  const applicationId = expectedApplicationId420(onboarding.gameId);

  assert420(registration.gameId === onboarding.gameId, 'registration profile gameId must match onboarding manifest');
  assert420(registration.applicationId === applicationId, 'registration profile applicationId must match onboarding application identity');
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(network.environment === 'testnet', 'GP-17.9 qualification requires a discovered testnet');
  assert420(typeof network.chainIdDecimal === 'string' && /^[1-9][0-9]*$/.test(network.chainIdDecimal), 'discovered testnet chainId is invalid');
  assert420(evidence && typeof evidence === 'object' && !Array.isArray(evidence), 'testnet evidence package is required');
  assert420(evidence.schemaVersion === SCHEMA_VERSION, 'unsupported testnet evidence schemaVersion');
  assert420(evidence.gameId === onboarding.gameId, 'testnet evidence gameId must match onboarding manifest');
  assert420(evidence.applicationId === applicationId, 'testnet evidence applicationId must match onboarding application identity');
  assert420(typeof evidence.commitSha === 'string' && SHA_RE.test(evidence.commitSha), 'testnet evidence requires an exact 40-character lowercase commit SHA');
  assert420(evidence.liveNetworkObserved === true, 'testnet qualification requires live-network evidence');
  assert420(evidence.network?.environment === 'testnet', 'testnet evidence environment must be testnet');
  assert420(evidence.network?.chainId === network.chainIdDecimal, 'testnet evidence chainId must match discovered testnet');

  const profile = qualificationProfile420(onboarding.gameId);
  const securityEvidence = {
    schemaVersion: SCHEMA_VERSION,
    profileId: profile.profileId,
    projectId: applicationId,
    network: {
      chainId: evidence.network.chainId,
      environment: 'testnet'
    },
    observedAt: evidence.observedAt,
    checks: evidence.checks
  };
  const report = createSecurityQualificationReport420({ profile, evidence: securityEvidence, network });
  const liveTestnetQualified = report.result === 'PASS';

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: liveTestnetQualified ? 'QUALIFIED_FOR_TESTNET_ONBOARDING' : 'BLOCKED_FOR_TESTNET_ONBOARDING',
    gameId: onboarding.gameId,
    applicationId,
    commitSha: evidence.commitSha,
    network: Object.freeze({ chainId: network.chainIdDecimal, environment: 'testnet' }),
    observedAt: report.observedAt,
    result: report.result,
    checks: report.checks,
    liveTestnetQualified,
    developerHubAuthority: false,
    canonicalRegistrationCreated: false,
    canonicalGrantCreated: false,
    securityCertification: false,
    evidenceRule: 'live testnet qualification requires deployed-network evidence bound to the exact game, application, chain and commit; repository CI or local/devnet rehearsal alone is insufficient'
  });
}
