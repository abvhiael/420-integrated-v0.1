import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';

const SCHEMA_VERSION = '1.0.0';

export class GamingProgressiveAccessQualificationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'GamingProgressiveAccessQualificationError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new GamingProgressiveAccessQualificationError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function featureList420(value, name) {
  assert420(Array.isArray(value), `${name} must be an array`);
  return value.map((raw, index) => {
    const feature = object420(raw, `${name}[${index}]`);
    for (const key of Object.keys(feature)) assert420(new Set(['id','requiresRegistration','requiresWallet','coreProgression','grantsCompetitiveAdvantage']).has(key), `${name}[${index}] contains unsupported field: ${key}`);
    assert420(typeof feature.id === 'string' && feature.id.trim().length > 0, `${name}[${index}].id is invalid`);
    assert420(typeof feature.requiresRegistration === 'boolean', `${name}[${index}].requiresRegistration must be boolean`);
    assert420(typeof feature.requiresWallet === 'boolean', `${name}[${index}].requiresWallet must be boolean`);
    assert420(typeof feature.coreProgression === 'boolean', `${name}[${index}].coreProgression must be boolean`);
    assert420(typeof feature.grantsCompetitiveAdvantage === 'boolean', `${name}[${index}].grantsCompetitiveAdvantage must be boolean`);
    assert420(!(feature.requiresWallet && feature.coreProgression), `wallet-required core progression is forbidden: ${feature.id}`);
    assert420(!(feature.requiresWallet && feature.grantsCompetitiveAdvantage), `wallet-linked pay-to-win capability is forbidden: ${feature.id}`);
    return Object.freeze({ ...feature, id: feature.id.trim() });
  });
}

export function qualifyGamingProgressiveAccess420({ onboardingManifest, policy }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const input = object420(policy, 'progressive access qualification policy');
  for (const key of Object.keys(input)) assert420(new Set(['schemaVersion','gameId','features']).has(key), `progressive access qualification policy contains unsupported field: ${key}`);
  assert420(input.schemaVersion === SCHEMA_VERSION, 'unsupported progressive access qualification schemaVersion');
  assert420(input.gameId === onboarding.gameId, 'progressive access qualification gameId must match onboarding manifest');

  const features = featureList420(input.features, 'features');
  assert420(features.length >= 1, 'features must contain at least one declaration');
  assert420(new Set(features.map((feature) => feature.id)).size === features.length, 'feature ids must be unique');

  const core = features.filter((feature) => feature.coreProgression);
  assert420(core.length >= 1, 'at least one core progression feature is required');
  assert420(core.every((feature) => feature.requiresWallet === false), 'core progression must remain wallet-free');

  const walletFeatures = features.filter((feature) => feature.requiresWallet);
  assert420(walletFeatures.every((feature) => feature.coreProgression === false), 'wallet features must remain optional');
  assert420(walletFeatures.every((feature) => feature.grantsCompetitiveAdvantage === false), 'wallet features must not grant competitive advantage');

  const guestAvailableCore = core.some((feature) => feature.requiresRegistration === false && feature.requiresWallet === false);
  const registeredContinuity = core.every((feature) => feature.requiresWallet === false);
  assert420(guestAvailableCore, 'at least one core progression feature must be available to guests');
  assert420(registeredContinuity, 'registered players must retain wallet-free core progression');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    status: 'PASS',
    gameId: onboarding.gameId,
    checks: Object.freeze({
      guestCoreGameplay: true,
      registeredContinuity: true,
      walletLinkedOptional: true,
      noWalletRequiredCoreProgression: true,
      noWalletLinkedPayToWin: true
    }),
    counts: Object.freeze({ totalFeatures: features.length, coreFeatures: core.length, walletFeatures: walletFeatures.length }),
    developerHubAuthority: false,
    canonicalAuthorityChanged: false
  });
}
