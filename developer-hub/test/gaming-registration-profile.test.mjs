import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamingRegistrationProfileError420,
  createGamingRegistrationPlan420,
  validateGamingRegistrationProfile420
} from '../src/gaming-registration-profile.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId = '420-gaming-game-high_country-v1';

function release() {
  return {
    schemaVersion: '1.0.0',
    applicationId,
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
    }
  };
}

function onboardingManifest(overrides = {}) {
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

function profile(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    gameId,
    applicationId,
    capabilities: [
      { protocol: 'identity', scope: 'game', actions: ['profile:read', 'profile:ensure'] },
      { protocol: 'entitlements', scope: 'game', actions: ['entitlement:read', 'entitlement:verify'] },
      { protocol: 'claims', scope: 'game', actions: ['claim:prepare', 'claim:read'] },
      { protocol: 'attestations', scope: 'game', actions: ['attestation:read', 'attestation:verify'] },
      { protocol: 'migration', scope: 'game', actions: ['migration:prepare', 'migration:claim', 'migration:consume'] },
      { protocol: 'smart-account', scope: 'game', actions: ['session:request', 'session:status'] }
    ],
    compatibility: {
      gamingProtocol: '420GP/V1',
      sdkPackage: '@420/gaming-sdk',
      minimumSdkVersion: '0.1.0',
      finalityModel: 'GP-16'
    },
    ...overrides
  };
}

test('GP-17.2 accepts game-scoped declared protocol capabilities', () => {
  const result = validateGamingRegistrationProfile420(profile());
  assert.equal(result.gameId, gameId);
  assert.equal(result.capabilities.length, 6);
  assert.ok(result.capabilities.every((capability) => capability.scope === 'game'));
});

test('GP-17.2 rejects wallet-global capability scope', () => {
  const capabilities = [{ protocol: 'entitlements', scope: 'wallet-global', actions: ['entitlement:read'] }];
  assert.throws(() => validateGamingRegistrationProfile420(profile({ capabilities })), /scope must be game/);
});

test('GP-17.2 rejects wildcard and undeclared authority actions', () => {
  assert.throws(() => validateGamingRegistrationProfile420(profile({ capabilities: [
    { protocol: 'identity', scope: 'game', actions: ['*'] }
  ] })), /forbidden gaming authority action/);
  assert.throws(() => validateGamingRegistrationProfile420(profile({ capabilities: [
    { protocol: 'identity', scope: 'game', actions: ['profile:delete'] }
  ] })), /unsupported action/);
});

test('GP-17.2 rejects duplicate protocol declarations', () => {
  assert.throws(() => validateGamingRegistrationProfile420(profile({ capabilities: [
    { protocol: 'identity', scope: 'game', actions: ['profile:read'] },
    { protocol: 'identity', scope: 'game', actions: ['profile:ensure'] }
  ] })), /duplicate gaming protocol capability/);
});

test('GP-17.2 requires GP-16 finality compatibility', () => {
  assert.throws(() => validateGamingRegistrationProfile420(profile({ compatibility: {
    gamingProtocol: '420GP/V1', sdkPackage: '@420/gaming-sdk', minimumSdkVersion: '0.1.0', finalityModel: 'optimistic-only'
  } })), /finalityModel must be GP-16/);
});

test('GP-17.2 binds registration profile to onboarding game and application identity', () => {
  assert.throws(() => createGamingRegistrationPlan420({
    onboardingManifest: onboardingManifest(),
    registrationProfile: profile({ gameId: '420/GAMING/GAME/OTHER/V1' })
  }), /gameId must match onboarding manifest/);
  assert.throws(() => createGamingRegistrationPlan420({
    onboardingManifest: onboardingManifest(),
    registrationProfile: profile({ applicationId: 'other-app' })
  }), /applicationId must match onboarding application identity/);
});

test('GP-17.2 refuses capability protocols omitted from GP-17.1 onboarding', () => {
  assert.throws(() => createGamingRegistrationPlan420({
    onboardingManifest: onboardingManifest({ protocols: ['identity'] }),
    registrationProfile: profile({ capabilities: [
      { protocol: 'entitlements', scope: 'game', actions: ['entitlement:read'] }
    ] })
  }), /was not declared during onboarding/);
});

test('GP-17.2 produces a noncanonical capability handoff', () => {
  const plan = createGamingRegistrationPlan420({ onboardingManifest: onboardingManifest(), registrationProfile: profile() });
  assert.equal(plan.status, 'READY_FOR_CAPABILITY_PREFLIGHT');
  assert.equal(plan.developerHubAuthority, false);
  assert.equal(plan.canonicalGrantCreated, false);
  assert.match(plan.authorityBoundary, /CapabilityRegistry420/);
});
