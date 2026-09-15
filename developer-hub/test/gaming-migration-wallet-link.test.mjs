import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GamingMigrationWalletLinkError420,
  createGamingMigrationWalletLinkPlan420,
  validateGamingMigrationWalletLinkProfile420
} from '../src/gaming-migration-wallet-link.mjs';

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
    publisher: { address }, walletScopes: ['gaming:migration'],
    appStore: { title: 'High Country', summary: 'Reference game.', launchUrl: 'https://example.com/high-country', categories: ['games'] }
  };
}

function onboarding(overrides = {}) {
  return {
    schemaVersion: '1.0.0', gameId, displayName: 'High Country', applicationRelease: release(),
    progressiveAccess: { coreGameplayWalletFree: true, states: ['guest','registered','wallet-linked'], walletFeaturesOptional: true },
    protocols: ['identity','migration','smart-account'], ...overrides
  };
}

function profile(overrides = {}) {
  return {
    schemaVersion: '1.0.0', gameId, applicationId,
    walletLink: { explicitConsent: true, optionalForCoreGameplay: true, displayTargetBeforeAuthorization: true, targetAccount: target },
    migration: {
      source: 'registered', targetBound: true, gameScoped: true, commitmentOnly: true,
      expiryRequired: true, singleConsumption: true, idempotentPreparation: true,
      canonicalStateBeforeRetry: true, rawPayloadOnchain: false, reconcileAfterFinality: true
    },
    finality: { model: 'GP-16', requireFinalized: true, reorgFailClosed: true, rpcFailureFailClosed: true },
    ...overrides
  };
}

test('GP-17.6 accepts target-bound consent-driven migration profile', () => {
  const result = validateGamingMigrationWalletLinkProfile420(profile());
  assert.equal(result.walletLink.targetAccount, target);
  assert.equal(result.migration.singleConsumption, true);
  assert.equal(result.finality.model, 'GP-16');
});

test('GP-17.6 requires explicit wallet-link consent', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ walletLink: {
    explicitConsent: false, optionalForCoreGameplay: true, displayTargetBeforeAuthorization: true, targetAccount: target
  } })), /explicit consent/);
});

test('GP-17.6 keeps wallet link optional for core gameplay', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ walletLink: {
    explicitConsent: true, optionalForCoreGameplay: false, displayTargetBeforeAuthorization: true, targetAccount: target
  } })), /optional for core gameplay/);
});

test('GP-17.6 rejects raw save payloads in canonical migration state', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ migration: {
    ...profile().migration, rawPayloadOnchain: true
  } })), /raw migration payload/);
});

test('GP-17.6 requires replay-safe single consumption and idempotent preparation', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ migration: {
    ...profile().migration, singleConsumption: false
  } })), /single-consumption/);
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ migration: {
    ...profile().migration, idempotentPreparation: false
  } })), /idempotent/);
});

test('GP-17.6 requires canonical state check before retry', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ migration: {
    ...profile().migration, canonicalStateBeforeRetry: false
  } })), /canonical state/);
});

test('GP-17.6 requires finalized reorg/RPC fail-closed completion', () => {
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ finality: {
    model: 'GP-16', requireFinalized: false, reorgFailClosed: true, rpcFailureFailClosed: true
  } })), /finalized/);
  assert.throws(() => validateGamingMigrationWalletLinkProfile420(profile({ finality: {
    model: 'GP-16', requireFinalized: true, reorgFailClosed: false, rpcFailureFailClosed: true
  } })), /reorg/);
});

test('GP-17.6 binds migration to exact onboarding game/application identity', () => {
  assert.throws(() => createGamingMigrationWalletLinkPlan420({ onboardingManifest: onboarding(), migrationProfile: profile({ gameId: '420/GAMING/GAME/BUDTENDER/V1' }) }), /gameId must match/);
});

test('GP-17.6 requires migration protocol declaration during onboarding', () => {
  assert.throws(() => createGamingMigrationWalletLinkPlan420({ onboardingManifest: onboarding({ protocols: ['identity','smart-account'] }), migrationProfile: profile() }), /migration protocol/);
});

test('GP-17.6 emits only a noncanonical handoff plan', () => {
  const plan = createGamingMigrationWalletLinkPlan420({ onboardingManifest: onboarding(), migrationProfile: profile() });
  assert.equal(plan.status, 'READY_FOR_MIGRATION_PREFLIGHT');
  assert.equal(plan.canonicalClaimCreated, false);
  assert.equal(plan.walletLinked, false);
  assert.equal(plan.migrationCompleted, false);
  assert.equal(plan.developerHubAuthority, false);
  assert.equal(plan.nextActions.at(-1), 'RECONCILE_OFFCHAIN_STATE');
});
