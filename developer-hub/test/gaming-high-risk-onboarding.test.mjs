import test from 'node:test';
import assert from 'node:assert/strict';
import { validateGamingHighRiskPlan420, GamingHighRiskOnboardingError420 } from '../src/gaming-high-risk-onboarding.mjs';

const hash = c => `0x${c.repeat(64)}`;
const address = `0x${'1'.repeat(40)}`;
const gameId = '420/GAMING/GAME/HIGH_COUNTRY/V1';

const onboardingManifest = {
  schemaVersion: '1.0.0',
  gameId,
  displayName: 'High Country',
  applicationRelease: {
    schemaVersion: '1.0.0', applicationId: '420-gaming-game-high_country-v1', chainId: '420', serviceId: hash('1'), version: 1,
    implementation: address, runtimeCodeHash: hash('2'), metadataHash: hash('3'),
    registrationProfile: { componentType: 'APPLICATION', manifestHash: hash('4'), dependencyRoot: hash('0'), interfaceHash: hash('5') },
    publisher: { address }, walletScopes: [],
    appStore: { title: 'High Country', summary: 'Reference game', launchUrl: 'https://example.com/high-country', categories: ['games'] }
  },
  progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
  protocols: ['identity','entitlements','claims','attestations','migration','smart-account']
};

function highRisk(overrides = {}) {
  return {
    gameId,
    integrations: [
      { type:'entitlement', scope:'game', finality:'finalized', reorgPolicy:'fail-closed', rpcFailurePolicy:'fail-closed', canonicalRpcRequired:true, walletWideEnumeration:false },
      { type:'claim', scope:'game', finality:'finalized', reorgPolicy:'fail-closed', rpcFailurePolicy:'fail-closed', canonicalRpcRequired:true, walletWideEnumeration:false },
      { type:'attestation', scope:'game', finality:'finalized', reorgPolicy:'fail-closed', rpcFailurePolicy:'fail-closed', canonicalRpcRequired:true, crossGameScope:'explicit', walletWideEnumeration:false }
    ],
    ...overrides
  };
}

test('GP-17.5 accepts finalized canonical game-scoped high-risk integrations', () => {
  const result = validateGamingHighRiskPlan420({ onboardingManifest, highRisk: highRisk() });
  assert.equal(result.status, 'READY_FOR_HIGH_RISK_PREFLIGHT');
  assert.equal(result.finalityModel, 'GP-16');
  assert.equal(result.canonicalStateRequired, true);
  assert.equal(result.developerHubAuthority, false);
});

test('GP-17.5 rejects optimistic or insufficient finality', () => {
  const value = highRisk();
  value.integrations[0].finality = 'pending';
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: value }), /finality must be finalized/);
});

test('GP-17.5 rejects non-fail-closed reorg policy', () => {
  const value = highRisk();
  value.integrations[1].reorgPolicy = 'accept';
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: value }), /reorgPolicy must be fail-closed/);
});

test('GP-17.5 rejects RPC failure fail-open behavior', () => {
  const value = highRisk();
  value.integrations[1].rpcFailurePolicy = 'allow';
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: value }), /rpcFailurePolicy must be fail-closed/);
});

test('GP-17.5 rejects wallet-wide enumeration', () => {
  const value = highRisk();
  value.integrations[0].walletWideEnumeration = true;
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: value }), GamingHighRiskOnboardingError420);
});

test('GP-17.5 requires explicit cross-game attestation scope', () => {
  const value = highRisk();
  value.integrations[2].crossGameScope = 'wallet-wide';
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: value }), /crossGameScope must be explicit/);
});

test('GP-17.5 binds high-risk plan to canonical game identity', () => {
  assert.throws(() => validateGamingHighRiskPlan420({ onboardingManifest, highRisk: highRisk({ gameId:'420/GAMING/GAME/OTHER/V1' }) }), /must match onboarding gameId/);
});
