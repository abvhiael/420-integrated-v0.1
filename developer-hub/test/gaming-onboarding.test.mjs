import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamingOnboardingError420,
  createGamingOnboardingPlan420,
  validateGamingOnboardingManifest420
} from '../src/gaming-onboarding.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';

function release(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    applicationId: '420-gaming-game-high_country-v1',
    chainId: '420',
    serviceId: hash('1'),
    version: 1,
    implementation: address,
    runtimeCodeHash: hash('2'),
    metadataHash: hash('3'),
    registrationProfile: {
      componentType: 'APPLICATION',
      manifestHash: hash('4'),
      dependencyRoot: hash('0'),
      interfaceHash: hash('5')
    },
    publisher: { address },
    walletScopes: ['gaming:entitlements:read'],
    appStore: {
      title: 'High Country',
      summary: 'Reference game for the 420 Gaming Protocol.',
      launchUrl: 'https://example.com/high-country',
      categories: ['games']
    },
    ...overrides
  };
}

function manifest(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    gameId,
    displayName: 'High Country',
    applicationRelease: release(),
    progressiveAccess: {
      coreGameplayWalletFree: true,
      states: ['guest', 'registered', 'wallet-linked'],
      walletFeaturesOptional: true
    },
    protocols: ['identity', 'entitlements', 'claims', 'attestations', 'migration', 'smart-account'],
    ...overrides
  };
}

const network = Object.freeze({ name: '420-testnet', environment: 'testnet', chainIdDecimal: '420' });

test('GP-17.1 accepts canonical game onboarding manifest', () => {
  const result = validateGamingOnboardingManifest420(manifest());
  assert.equal(result.gameId, gameId);
  assert.equal(result.progressiveAccess.coreGameplayWalletFree, true);
  assert.deepEqual(result.progressiveAccess.states, ['guest', 'registered', 'wallet-linked']);
});

test('GP-17.1 rejects noncanonical game namespace', () => {
  assert.throws(() => validateGamingOnboardingManifest420(manifest({ gameId: 'high-country' })), GamingOnboardingError420);
});

test('GP-17.1 refuses wallet-required core gameplay', () => {
  assert.throws(() => validateGamingOnboardingManifest420(manifest({ progressiveAccess: {
    coreGameplayWalletFree: false,
    states: ['guest', 'registered', 'wallet-linked'],
    walletFeaturesOptional: true
  } })), /core gameplay must remain wallet-free/);
});

test('GP-17.1 requires deliberate progressive access ordering', () => {
  assert.throws(() => validateGamingOnboardingManifest420(manifest({ progressiveAccess: {
    coreGameplayWalletFree: true,
    states: ['wallet-linked', 'registered', 'guest'],
    walletFeaturesOptional: true
  } })), /guest -> registered -> wallet-linked/);
});

test('GP-17.1 rejects unknown protocol surface', () => {
  assert.throws(() => validateGamingOnboardingManifest420(manifest({ protocols: ['identity', 'wallet-wide-history'] })), /unsupported gaming protocol/);
});

test('GP-17.1 binds application identity to canonical game id', () => {
  assert.throws(() => validateGamingOnboardingManifest420(manifest({ applicationRelease: release({ applicationId: 'other-game' }) })), /applicationRelease.applicationId/);
});

test('GP-17.1 reuses Developer Hub canonical publishing preflight', () => {
  const plan = createGamingOnboardingPlan420({ network, manifest: manifest() });
  assert.equal(plan.status, 'READY_FOR_GAMING_PREFLIGHT');
  assert.equal(plan.publishingPlan.status, 'READY_FOR_CANONICAL_PREFLIGHT');
  assert.equal(plan.publishingPlan.canonicalRegistration, false);
  assert.equal(plan.publishingPlan.registryCall.requiresGovernanceAuthorization, true);
  assert.equal(plan.developerHubAuthority, false);
});

test('GP-17.1 fails closed on network mismatch through shared publishing flow', () => {
  assert.throws(() => createGamingOnboardingPlan420({ network: { ...network, chainIdDecimal: '1' }, manifest: manifest() }), /chainId does not match selected network/);
});
