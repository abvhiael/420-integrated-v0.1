import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';

const SCHEMA_VERSION = '1.0.0';
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class GamingMigrationWalletLinkError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingMigrationWalletLinkError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingMigrationWalletLinkError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function text420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

function exactKeys420(value, allowed, name) {
  for (const key of Object.keys(value)) assert420(allowed.has(key), `${name} contains unsupported field: ${key}`);
}

export function validateGamingMigrationWalletLinkProfile420(input) {
  const profile = object420(input, 'migration wallet-link profile');
  exactKeys420(profile, new Set([
    'schemaVersion','gameId','applicationId','walletLink','migration','finality'
  ]), 'migration wallet-link profile');
  assert420(profile.schemaVersion === SCHEMA_VERSION, 'unsupported migration wallet-link schemaVersion');

  const gameId = text420(profile.gameId, 'gameId', 128);
  const applicationId = text420(profile.applicationId, 'applicationId', 128);

  const walletLink = object420(profile.walletLink, 'walletLink');
  exactKeys420(walletLink, new Set([
    'explicitConsent','optionalForCoreGameplay','displayTargetBeforeAuthorization','targetAccount'
  ]), 'walletLink');
  assert420(walletLink.explicitConsent === true, 'wallet link requires explicit consent');
  assert420(walletLink.optionalForCoreGameplay === true, 'wallet link must remain optional for core gameplay');
  assert420(walletLink.displayTargetBeforeAuthorization === true, 'wallet-link target must be shown before authorization');
  assert420(typeof walletLink.targetAccount === 'string' && ADDRESS_RE.test(walletLink.targetAccount) && !/^0x0{40}$/i.test(walletLink.targetAccount), 'walletLink.targetAccount is invalid');

  const migration = object420(profile.migration, 'migration');
  exactKeys420(migration, new Set([
    'source','targetBound','gameScoped','commitmentOnly','expiryRequired','singleConsumption',
    'idempotentPreparation','canonicalStateBeforeRetry','rawPayloadOnchain','reconcileAfterFinality'
  ]), 'migration');
  assert420(['guest','registered'].includes(migration.source), 'migration.source must be guest or registered');
  assert420(migration.targetBound === true, 'migration claim must be target-bound');
  assert420(migration.gameScoped === true, 'migration claim must be game-scoped');
  assert420(migration.commitmentOnly === true, 'migration must use commitment-only canonical payloads');
  assert420(migration.expiryRequired === true, 'migration claim expiry is required');
  assert420(migration.singleConsumption === true, 'migration claim must be single-consumption');
  assert420(migration.idempotentPreparation === true, 'migration preparation must be idempotent');
  assert420(migration.canonicalStateBeforeRetry === true, 'canonical state must be checked before retry');
  assert420(migration.rawPayloadOnchain === false, 'raw migration payload must not be stored onchain');
  assert420(migration.reconcileAfterFinality === true, 'off-chain reconciliation must wait for finalized canonical completion');

  const finality = object420(profile.finality, 'finality');
  exactKeys420(finality, new Set(['model','requireFinalized','reorgFailClosed','rpcFailureFailClosed']), 'finality');
  assert420(finality.model === 'GP-16', 'finality.model must be GP-16');
  assert420(finality.requireFinalized === true, 'migration completion must require finalized state');
  assert420(finality.reorgFailClosed === true, 'migration must fail closed on reorg');
  assert420(finality.rpcFailureFailClosed === true, 'migration must fail closed on RPC failure');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    gameId,
    applicationId,
    walletLink: Object.freeze({
      explicitConsent: true,
      optionalForCoreGameplay: true,
      displayTargetBeforeAuthorization: true,
      targetAccount: walletLink.targetAccount.toLowerCase()
    }),
    migration: Object.freeze({
      source: migration.source,
      targetBound: true,
      gameScoped: true,
      commitmentOnly: true,
      expiryRequired: true,
      singleConsumption: true,
      idempotentPreparation: true,
      canonicalStateBeforeRetry: true,
      rawPayloadOnchain: false,
      reconcileAfterFinality: true
    }),
    finality: Object.freeze({
      model: 'GP-16',
      requireFinalized: true,
      reorgFailClosed: true,
      rpcFailureFailClosed: true
    })
  });
}

export function createGamingMigrationWalletLinkPlan420({ onboardingManifest, migrationProfile }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const profile = validateGamingMigrationWalletLinkProfile420(migrationProfile);
  const expectedApplicationId = onboarding.gameId.toLowerCase().replaceAll('/', '-');

  assert420(onboarding.protocols.includes('migration'), 'migration protocol was not declared during onboarding');
  assert420(profile.gameId === onboarding.gameId, 'migration profile gameId must match onboarding manifest');
  assert420(profile.applicationId === expectedApplicationId, 'migration profile applicationId must match onboarding application identity');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'READY_FOR_MIGRATION_PREFLIGHT',
    gameId: profile.gameId,
    applicationId: profile.applicationId,
    walletLink: profile.walletLink,
    migration: profile.migration,
    finality: profile.finality,
    canonicalClaimCreated: false,
    walletLinked: false,
    migrationCompleted: false,
    developerHubAuthority: false,
    authorityBoundary: 'GameClaims420 + Wallet/SmartAccount420 + canonical game operator authority',
    nextActions: Object.freeze([
      'AUTHENTICATE_SOURCE_OFFCHAIN',
      'CONFIRM_EXPLICIT_WALLET_LINK_CONSENT',
      'PREPARE_IDEMPOTENT_COMMITMENT',
      'ISSUE_TARGET_BOUND_GAME_SCOPED_CLAIM',
      'CONSUME_ONCE_THROUGH_TARGET_ACCOUNT',
      'WAIT_FOR_FINALIZED_CANONICAL_CONSUMPTION',
      'RECONCILE_OFFCHAIN_STATE'
    ])
  });
}
