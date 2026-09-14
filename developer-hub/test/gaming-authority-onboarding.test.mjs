import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamingAuthorityOnboardingPlan420, GamingAuthorityOnboardingError420 } from '../src/gaming-authority-onboarding.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const target = `0x${'2'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId = '420-gaming-game-high_country-v1';

function release() {
  return {
    schemaVersion: '1.0.0', applicationId, chainId: '420', serviceId: hash('1'), version: 1,
    implementation: address, runtimeCodeHash: hash('2'), metadataHash: hash('3'),
    registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
    publisher: { address }, walletScopes: ['gaming:entitlements:read'],
    appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
  };
}

function onboarding() {
  return {
    schemaVersion: '1.0.0', gameId, displayName: 'High Country', applicationRelease: release(),
    progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
    protocols: ['identity','entitlements','claims','attestations','migration','smart-account']
  };
}

function registration() {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    capabilities: [
      { protocol: 'smart-account', scope: 'game', actions: ['session:request','session:status'] },
      { protocol: 'claims', scope: 'game', actions: ['claim:prepare'] }
    ],
    compatibility: { gamingProtocol: '420GP/V1', sdkPackage: '@420/gaming-sdk', minimumSdkVersion: '1.0.0', finalityModel: 'GP-16' }
  };
}

function authority(overrides = {}) {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    smartAccount: { requiredForCoreGameplay: false, walletLinkOptional: true, sessionExecutionOnly: true },
    capabilityRegistry: { scope: 'game', grantAuthority: 'CapabilityRegistry420', developerHubCanGrant: false, gameIdBound: true, actionBound: true },
    sessionPolicy: {
      authorizationEpochRequired: true,
      defaultDeny: true,
      calls: [{ target, selector: '0x12345678', valueLimitWei: '0', gameId, action: 'session:request' }]
    },
    ...overrides
  };
}

test('GP-17.7 accepts exact game-scoped SmartAccount and CapabilityRegistry authority plan', () => {
  const result = createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: authority() });
  assert.equal(result.status, 'READY_FOR_AUTHORITY_PREFLIGHT');
  assert.equal(result.smartAccountAuthority, 'SmartAccount420');
  assert.equal(result.capabilityGrantAuthority, 'CapabilityRegistry420');
  assert.equal(result.canonicalGrantCreated, false);
  assert.equal(result.walletLinkRequiredForCoreGameplay, false);
});

test('GP-17.7 rejects SmartAccount-required core gameplay', () => {
  const plan = authority();
  plan.smartAccount = { ...plan.smartAccount, requiredForCoreGameplay: true };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /cannot be required for core gameplay/);
});

test('GP-17.7 rejects Developer Hub as grant authority', () => {
  const plan = authority();
  plan.capabilityRegistry = { ...plan.capabilityRegistry, developerHubCanGrant: true };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /Developer Hub cannot mint capability grants/);
});

test('GP-17.7 requires game and action bound CapabilityRegistry grants', () => {
  const plan = authority();
  plan.capabilityRegistry = { ...plan.capabilityRegistry, gameIdBound: false };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /bind exact gameId/);
});

test('GP-17.7 defaults deny and requires authorization epoch validation', () => {
  const plan = authority();
  plan.sessionPolicy = { ...plan.sessionPolicy, defaultDeny: false };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /default deny/);
});

test('GP-17.7 rejects native value transfer in gaming session calls', () => {
  const plan = authority();
  plan.sessionPolicy = { ...plan.sessionPolicy, calls: [{ ...plan.sessionPolicy.calls[0], valueLimitWei: '1' }] };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /must not authorize native value transfer/);
});

test('GP-17.7 rejects wildcard or wallet-global session authority', () => {
  const plan = authority();
  plan.sessionPolicy = { ...plan.sessionPolicy, calls: [{ ...plan.sessionPolicy.calls[0], action: 'wallet-wide:*' }] };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), GamingAuthorityOnboardingError420);
});

test('GP-17.7 rejects session actions not declared during capability onboarding', () => {
  const plan = authority();
  plan.sessionPolicy = { ...plan.sessionPolicy, calls: [{ ...plan.sessionPolicy.calls[0], action: 'claim:read' }] };
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /not declared during capability onboarding/);
});

test('GP-17.7 binds authority plan to canonical game identity', () => {
  const plan = authority({ gameId: '420/GAMING/GAME/OTHER/V1' });
  assert.throws(() => createGamingAuthorityOnboardingPlan420({ onboardingManifest: onboarding(), registrationProfile: registration(), authorityPlan: plan }), /gameId must match (authority plan|onboarding manifest)/);
});
