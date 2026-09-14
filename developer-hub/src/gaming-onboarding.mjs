import { createApplicationPublishingPlan420 } from './app-publishing.mjs';

const GAME_ID_RE = /^420\/GAMING\/GAME\/[A-Z0-9_]+\/V1$/;
const ACCESS_STATES = Object.freeze(['guest', 'registered', 'wallet-linked']);
const ALLOWED_PROTOCOLS = new Set(['identity', 'entitlements', 'claims', 'attestations', 'migration', 'smart-account']);

export class GamingOnboardingError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingOnboardingError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingOnboardingError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function text420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

export function validateGamingOnboardingManifest420(input) {
  const manifest = object420(input, 'gaming onboarding manifest');
  const allowed = new Set(['schemaVersion','gameId','displayName','applicationRelease','progressiveAccess','protocols']);
  for (const key of Object.keys(manifest)) assert420(allowed.has(key), `gaming onboarding manifest contains unsupported field: ${key}`);
  assert420(manifest.schemaVersion === '1.0.0', 'unsupported gaming onboarding schemaVersion');

  const gameId = text420(manifest.gameId, 'gameId', 128);
  assert420(GAME_ID_RE.test(gameId), 'gameId must use canonical 420/GAMING/GAME/<NAME>/V1 format');
  const displayName = text420(manifest.displayName, 'displayName', 120);

  const access = object420(manifest.progressiveAccess, 'progressiveAccess');
  const accessAllowed = new Set(['coreGameplayWalletFree','states','walletFeaturesOptional']);
  for (const key of Object.keys(access)) assert420(accessAllowed.has(key), `progressiveAccess contains unsupported field: ${key}`);
  assert420(access.coreGameplayWalletFree === true, 'core gameplay must remain wallet-free');
  assert420(access.walletFeaturesOptional === true, 'wallet-linked features must remain optional');
  assert420(Array.isArray(access.states), 'progressiveAccess.states must be an array');
  assert420(access.states.length === ACCESS_STATES.length && ACCESS_STATES.every((state, i) => access.states[i] === state), 'progressiveAccess.states must be guest -> registered -> wallet-linked');

  assert420(Array.isArray(manifest.protocols) && manifest.protocols.length >= 1, 'protocols must contain at least one protocol');
  const protocols = manifest.protocols.map((value, index) => text420(value, `protocols[${index}]`, 64));
  assert420(new Set(protocols).size === protocols.length, 'protocols must be unique');
  for (const protocol of protocols) assert420(ALLOWED_PROTOCOLS.has(protocol), `unsupported gaming protocol: ${protocol}`);

  const release = object420(manifest.applicationRelease, 'applicationRelease');
  assert420(release.applicationId === gameId.toLowerCase().replaceAll('/', '-'), 'applicationRelease.applicationId must derive from canonical gameId');

  return Object.freeze({
    schemaVersion: '1.0.0',
    gameId,
    displayName,
    applicationRelease: release,
    progressiveAccess: Object.freeze({
      coreGameplayWalletFree: true,
      states: ACCESS_STATES,
      walletFeaturesOptional: true
    }),
    protocols: Object.freeze(protocols)
  });
}

export function createGamingOnboardingPlan420({ network, manifest }) {
  const normalized = validateGamingOnboardingManifest420(manifest);
  const publishingPlan = createApplicationPublishingPlan420({ network, release: normalized.applicationRelease });

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'READY_FOR_GAMING_PREFLIGHT',
    gameId: normalized.gameId,
    displayName: normalized.displayName,
    progressiveAccess: normalized.progressiveAccess,
    protocols: normalized.protocols,
    publishingPlan,
    developerHubAuthority: false,
    gamingRegistryAuthority: '420 Gaming Protocol / canonical game registration authority',
    nextActions: Object.freeze([
      'VERIFY_CANONICAL_GAME_ID',
      'VERIFY_PROGRESSIVE_ACCESS_POLICY',
      'VERIFY_PROTOCOL_SCOPES',
      'RUN_APPLICATION_CANONICAL_PREFLIGHT'
    ])
  });
}
