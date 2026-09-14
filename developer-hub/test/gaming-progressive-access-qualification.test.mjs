import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamingProgressiveAccessQualificationError420,
  qualifyGamingProgressiveAccess420
} from '../src/gaming-progressive-access-qualification.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';

function onboardingManifest() {
  return {
    schemaVersion: '1.0.0',
    gameId,
    displayName: 'High Country',
    applicationRelease: {
      schemaVersion: '1.0.0',
      applicationId: '420-gaming-game-high_country-v1',
      chainId: '420',
      serviceId: hash('1'),
      version: 1,
      implementation: address,
      runtimeCodeHash: hash('2'),
      metadataHash: hash('3'),
      registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
      publisher: { address },
      walletScopes: ['gaming:entitlements:read'],
      appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
    },
    progressiveAccess: {
      coreGameplayWalletFree: true,
      states: ['guest', 'registered', 'wallet-linked'],
      walletFeaturesOptional: true
    },
    protocols: ['identity', 'entitlements', 'claims', 'attestations', 'migration', 'smart-account']
  };
}

function policy(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    gameId,
    features: [
      { id: 'core-gameplay', requiresRegistration: false, requiresWallet: false, coreProgression: true, grantsCompetitiveAdvantage: false },
      { id: 'cloud-save', requiresRegistration: true, requiresWallet: false, coreProgression: false, grantsCompetitiveAdvantage: false },
      { id: 'owned-cosmetic', requiresRegistration: true, requiresWallet: true, coreProgression: false, grantsCompetitiveAdvantage: false }
    ],
    ...overrides
  };
}

test('GP-17.4 passes guest, registered and optional wallet-linked progression', () => {
  const result = qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy() });
  assert.equal(result.status, 'PASS');
  assert.equal(result.checks.guestCoreGameplay, true);
  assert.equal(result.checks.registeredContinuity, true);
  assert.equal(result.checks.walletLinkedOptional, true);
  assert.equal(result.checks.noWalletRequiredCoreProgression, true);
  assert.equal(result.checks.noWalletLinkedPayToWin, true);
  assert.equal(result.developerHubAuthority, false);
  assert.equal(result.canonicalAuthorityChanged, false);
});

test('GP-17.4 rejects wallet-required core progression', () => {
  assert.throws(() => qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy({ features: [
    { id: 'core-gameplay', requiresRegistration: false, requiresWallet: true, coreProgression: true, grantsCompetitiveAdvantage: false }
  ] }) }), /wallet-required core progression is forbidden/);
});

test('GP-17.4 rejects wallet-linked pay-to-win capability', () => {
  assert.throws(() => qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy({ features: [
    { id: 'core-gameplay', requiresRegistration: false, requiresWallet: false, coreProgression: true, grantsCompetitiveAdvantage: false },
    { id: 'stat-boost', requiresRegistration: true, requiresWallet: true, coreProgression: false, grantsCompetitiveAdvantage: true }
  ] }) }), /wallet-linked pay-to-win capability is forbidden/);
});

test('GP-17.4 requires guest-accessible core gameplay', () => {
  assert.throws(() => qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy({ features: [
    { id: 'core-gameplay', requiresRegistration: true, requiresWallet: false, coreProgression: true, grantsCompetitiveAdvantage: false }
  ] }) }), /available to guests/);
});

test('GP-17.4 rejects mismatched game identity', () => {
  assert.throws(() => qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy({ gameId: '420/GAMING/GAME/OTHER/V1' }) }), GamingProgressiveAccessQualificationError420);
});

test('GP-17.4 rejects duplicate feature ids', () => {
  assert.throws(() => qualifyGamingProgressiveAccess420({ onboardingManifest: onboardingManifest(), policy: policy({ features: [
    { id: 'same', requiresRegistration: false, requiresWallet: false, coreProgression: true, grantsCompetitiveAdvantage: false },
    { id: 'same', requiresRegistration: true, requiresWallet: false, coreProgression: false, grantsCompetitiveAdvantage: false }
  ] }) }), /feature ids must be unique/);
});
