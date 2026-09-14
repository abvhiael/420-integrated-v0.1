import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamingTestnetQualification420, GamingTestnetQualificationError420 } from '../src/gaming-testnet-qualification.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId = '420-gaming-game-high_country-v1';
const commitSha = 'a'.repeat(40);

function onboarding() {
  return {
    schemaVersion: '1.0.0', gameId, displayName: 'High Country',
    applicationRelease: {
      schemaVersion: '1.0.0', applicationId, chainId: '420', serviceId: hash('1'), version: 1,
      implementation: address, runtimeCodeHash: hash('2'), metadataHash: hash('3'),
      registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
      publisher: { address }, walletScopes: ['gaming:entitlements:read'],
      appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
    },
    progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
    protocols: ['identity','entitlements','claims','attestations','migration','smart-account']
  };
}

function registration() {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    capabilities: [
      { protocol: 'identity', scope: 'game', actions: ['profile:read'] },
      { protocol: 'entitlements', scope: 'game', actions: ['entitlement:read','entitlement:verify'] },
      { protocol: 'smart-account', scope: 'game', actions: ['session:request','session:status'] }
    ],
    compatibility: { gamingProtocol: '420GP/V1', sdkPackage: '@420/gaming-sdk', minimumSdkVersion: '1.0.0', finalityModel: 'GP-16' }
  };
}

const network = Object.freeze({ chainIdDecimal: '420', environment: 'testnet' });

function evidence(overrides = {}) {
  const checks = [
    'network-discovery', 'faucet-account', 'sdk-integration', 'registration-read',
    'finalized-state-read', 'wallet-optionality', 'authority-scope'
  ].map((id) => ({ id, status: 'PASS', source: `testnet://${id}`, evidence: { observed: true } }));
  return {
    schemaVersion: '1.0.0', gameId, applicationId, commitSha,
    liveNetworkObserved: true,
    network: { chainId: '420', environment: 'testnet' },
    observedAt: '2026-09-14T20:30:00.000Z',
    checks,
    ...overrides
  };
}

test('GP-17.9 qualifies a complete live testnet evidence package', () => {
  const result = createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence(), network });
  assert.equal(result.status, 'QUALIFIED_FOR_TESTNET_ONBOARDING');
  assert.equal(result.result, 'PASS');
  assert.equal(result.liveTestnetQualified, true);
  assert.equal(result.commitSha, commitSha);
  assert.equal(result.gameId, gameId);
});

test('GP-17.9 blocks incomplete required testnet evidence', () => {
  const bad = evidence();
  bad.checks = bad.checks.filter((check) => check.id !== 'finalized-state-read');
  const result = createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: bad, network });
  assert.equal(result.status, 'BLOCKED_FOR_TESTNET_ONBOARDING');
  assert.equal(result.result, 'BLOCKED');
  assert.equal(result.liveTestnetQualified, false);
});

test('GP-17.9 preserves explicit failures', () => {
  const bad = evidence();
  bad.checks = bad.checks.map((check) => check.id === 'authority-scope' ? { ...check, status: 'FAIL' } : check);
  const result = createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: bad, network });
  assert.equal(result.result, 'FAIL');
  assert.equal(result.liveTestnetQualified, false);
});

test('GP-17.9 refuses local or devnet evidence as live testnet qualification', () => {
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence(), network: { chainIdDecimal: '420', environment: 'local' } }), /requires a discovered testnet/);
});

test('GP-17.9 requires live-network observation', () => {
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence({ liveNetworkObserved: false }), network }), /requires live-network evidence/);
});

test('GP-17.9 binds evidence to exact chain, game, application and commit', () => {
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence({ network: { chainId: '421', environment: 'testnet' } }), network }), /chainId must match discovered testnet/);
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence({ gameId: '420\/GAMING\/GAME\/OTHER\/V1' }), network }), /gameId must match onboarding manifest/);
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence({ applicationId: 'wrong-app' }), network }), /applicationId must match onboarding application identity/);
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence({ commitSha: 'abc' }), network }), /exact 40-character lowercase commit SHA/);
});

test('GP-17.9 never promotes Developer Hub evidence into canonical authority', () => {
  const result = createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: evidence(), network });
  assert.equal(result.developerHubAuthority, false);
  assert.equal(result.canonicalRegistrationCreated, false);
  assert.equal(result.canonicalGrantCreated, false);
  assert.equal(result.securityCertification, false);
  assert.match(result.evidenceRule, /repository CI or local\/devnet rehearsal alone is insufficient/);
});

test('GP-17.9 rejects secret-shaped evidence', () => {
  const bad = evidence();
  bad.checks = bad.checks.map((check) => check.id === 'faucet-account' ? { ...check, evidence: { privateKey: 'forbidden' } } : check);
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: registration(), evidence: bad, network }));
});

test('GP-17.9 rejects mismatched registration identity', () => {
  const bad = registration();
  bad.gameId = '420/GAMING/GAME/OTHER/V1';
  assert.throws(() => createGamingTestnetQualification420({ onboardingManifest: onboarding(), registrationProfile: bad, evidence: evidence(), network }), GamingTestnetQualificationError420);
});
