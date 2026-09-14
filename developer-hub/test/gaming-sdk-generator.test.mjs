import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamingSdkIntegration420 } from '../src/gaming-sdk-generator.mjs';

const hash = (c) => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId = '420-gaming-game-high_country-v1';

function onboarding() {
  return {
    schemaVersion: '1.0.0',
    gameId,
    displayName: 'High Country',
    applicationRelease: {
      schemaVersion: '1.0.0', applicationId, chainId: '420', serviceId: hash('1'), version: 1,
      implementation: address, runtimeCodeHash: hash('2'), metadataHash: hash('3'),
      registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
      publisher: { address }, walletScopes: ['gaming:entitlements:read'],
      appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
    },
    progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
    protocols: ['identity','entitlements','claims']
  };
}

function profile(overrides = {}) {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    capabilities: [
      { protocol: 'identity', scope: 'game', actions: ['profile:read'] },
      { protocol: 'entitlements', scope: 'game', actions: ['entitlement:read'] }
    ],
    compatibility: { gamingProtocol: '420GP/V1', sdkPackage: '@420/gaming-sdk', minimumSdkVersion: '0.1.0', finalityModel: 'GP-16' },
    ...overrides
  };
}

test('GP-17.3 emits deterministic game-scoped SDK integration', () => {
  const a = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  const b = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  assert.deepEqual(a, b);
  assert.equal(a.status, 'READY_FOR_SDK_INTEGRATION');
  assert.equal(a.gameId, gameId);
  assert.match(a.files['src/420-gaming-client.mjs'], /gameId: GAME_ID/);
});

test('GP-17.3 preserves protocol subset and game scope', () => {
  const result = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  assert.deepEqual(result.config.protocolClients.map((x) => x.protocol), ['identity','entitlements']);
  assert.ok(result.config.protocolClients.every((x) => x.scope === 'game' && x.gameId === gameId));
});

test('GP-17.3 carries GP-16 finality and SDK compatibility', () => {
  const result = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  assert.equal(result.config.sdk.package, '@420/gaming-sdk');
  assert.equal(result.config.sdk.finalityModel, 'GP-16');
});

test('GP-17.3 never creates canonical authority', () => {
  const result = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  assert.equal(result.developerHubAuthority, false);
  assert.equal(result.canonicalGrantCreated, false);
  assert.equal(result.config.authority.source, 'CapabilityRegistry420');
});

test('GP-17.3 rejects mismatched game identity', () => {
  assert.throws(() => createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile({ gameId: '420/GAMING/GAME/BUDTENDER/V1' }) }), /gameId must match/);
});

test('GP-17.3 rejects capability protocols omitted from onboarding', () => {
  const bad = profile({ capabilities: [{ protocol: 'attestations', scope: 'game', actions: ['attestation:read'] }] });
  assert.throws(() => createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: bad }), /not declared during onboarding/);
});

test('GP-17.3 generated config forbids wallet-global enumeration surfaces', () => {
  const result = createGamingSdkIntegration420({ onboardingManifest: onboarding(), registrationProfile: profile() });
  assert.ok(result.config.forbiddenSurfaces.includes('wallet-wide-game-history'));
  assert.ok(result.config.forbiddenSurfaces.includes('enumerate-all-entitlements-for-wallet'));
});
