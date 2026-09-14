import { validateGamingOnboardingManifest420 } from './gaming-onboarding.mjs';

const TYPES = new Set(['entitlement','claim','attestation']);
const FINALITY = new Set(['finalized']);

export class GamingHighRiskOnboardingError420 extends Error {
  constructor(message) { super(message); this.name = 'GamingHighRiskOnboardingError420'; }
}

function assert420(condition, message) {
  if (!condition) throw new GamingHighRiskOnboardingError420(message);
}

function object420(value, name) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function text420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

export function validateGamingHighRiskPlan420({ onboardingManifest, highRisk }) {
  const onboarding = validateGamingOnboardingManifest420(onboardingManifest);
  const plan = object420(highRisk, 'highRisk');
  assert420(plan.gameId === onboarding.gameId, 'highRisk.gameId must match onboarding gameId');
  assert420(Array.isArray(plan.integrations) && plan.integrations.length >= 1, 'highRisk.integrations must contain at least one integration');

  const seen = new Set();
  const integrations = plan.integrations.map((raw, index) => {
    const item = object420(raw, `highRisk.integrations[${index}]`);
    const type = text420(item.type, `highRisk.integrations[${index}].type`, 32);
    assert420(TYPES.has(type), `unsupported high-risk integration type: ${type}`);
    assert420(!seen.has(type), `duplicate high-risk integration type: ${type}`);
    seen.add(type);
    assert420(item.scope === 'game', `highRisk.integrations[${index}].scope must be game`);
    assert420(item.finality === 'finalized' && FINALITY.has(item.finality), `highRisk.integrations[${index}].finality must be finalized`);
    assert420(item.reorgPolicy === 'fail-closed', `highRisk.integrations[${index}].reorgPolicy must be fail-closed`);
    assert420(item.rpcFailurePolicy === 'fail-closed', `highRisk.integrations[${index}].rpcFailurePolicy must be fail-closed`);
    assert420(item.canonicalRpcRequired === true, `highRisk.integrations[${index}].canonicalRpcRequired must be true`);
    assert420(item.walletWideEnumeration !== true, `highRisk.integrations[${index}] cannot enable wallet-wide enumeration`);
    if (type === 'attestation') {
      assert420(item.crossGameScope === 'explicit', 'attestation crossGameScope must be explicit');
    }
    return Object.freeze({
      type,
      scope: 'game',
      finality: 'finalized',
      reorgPolicy: 'fail-closed',
      rpcFailurePolicy: 'fail-closed',
      canonicalRpcRequired: true,
      crossGameScope: type === 'attestation' ? 'explicit' : null,
      walletWideEnumeration: false
    });
  });

  const requiredProtocols = new Set(onboarding.protocols);
  for (const type of seen) {
    const protocol = type === 'entitlement' ? 'entitlements' : type === 'attestation' ? 'attestations' : 'claims';
    assert420(requiredProtocols.has(protocol), `${protocol} protocol must be declared during onboarding`);
  }

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'READY_FOR_HIGH_RISK_PREFLIGHT',
    gameId: onboarding.gameId,
    integrations: Object.freeze(integrations),
    finalityModel: 'GP-16',
    canonicalStateRequired: true,
    developerHubAuthority: false,
    nextActions: Object.freeze([
      'VERIFY_FINALIZED_CANONICAL_STATE',
      'VERIFY_REORG_FAIL_CLOSED',
      'VERIFY_RPC_FAILURE_FAIL_CLOSED',
      'VERIFY_GAME_SCOPES',
      'VERIFY_EXPLICIT_CROSS_GAME_ATTESTATION_SCOPE'
    ])
  });
}
