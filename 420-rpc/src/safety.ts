import type { RpcRoutingProvider420, RpcRequestTransport420, RpcRouteDecision420 } from './routing.js';
import { routeCandidates420 } from './routing.js';

export interface RpcCheckpoint420 {
  number: bigint;
  hash: string;
}

export interface RpcChainObservation420 {
  id: string;
  chainId: bigint;
  head: RpcCheckpoint420;
  safe: RpcCheckpoint420 | null;
  finalized: RpcCheckpoint420 | null;
  observedAt: number;
}

export interface RpcChainSafetyPolicy420 {
  expectedChainId: bigint;
  maxHeadLagBlocks: bigint;
  maxObservationAgeMs: number;
  requireSafeCheckpoint: boolean;
  requireFinalizedCheckpoint: boolean;
}

export interface RpcProviderSafety420 {
  id: string;
  safe: boolean;
  reasons: readonly string[];
  observation: RpcChainObservation420 | null;
}

export interface RpcFleetSafety420 {
  safe: boolean;
  referenceHead: bigint | null;
  providers: readonly RpcProviderSafety420[];
  reasons: readonly string[];
}

export const DEFAULT_RPC4_SAFETY_POLICY_420: RpcChainSafetyPolicy420 = {
  expectedChainId: 420n,
  maxHeadLagBlocks: 8n,
  maxObservationAgeMs: 15_000,
  requireSafeCheckpoint: true,
  requireFinalizedCheckpoint: true,
};

const HASH_RE = /^0x[0-9a-fA-F]{64}$/;

function validateCheckpoint420(name: string, checkpoint: RpcCheckpoint420 | null): string[] {
  if (checkpoint === null) return [];
  const errors: string[] = [];
  if (checkpoint.number < 0n) errors.push(`${name} block number must be non-negative`);
  if (!HASH_RE.test(checkpoint.hash)) errors.push(`${name} block hash must be a 32-byte hex value`);
  return errors;
}

export function validateChainSafetyPolicy420(policy: RpcChainSafetyPolicy420): string[] {
  const errors: string[] = [];
  if (policy.expectedChainId <= 0n) errors.push('expectedChainId must be positive');
  if (policy.maxHeadLagBlocks < 0n) errors.push('maxHeadLagBlocks must be non-negative');
  if (!Number.isInteger(policy.maxObservationAgeMs) || policy.maxObservationAgeMs < 1) errors.push('maxObservationAgeMs must be a positive integer');
  return errors;
}

export function validateChainObservation420(observation: RpcChainObservation420): string[] {
  const errors = [
    ...validateCheckpoint420('head', observation.head),
    ...validateCheckpoint420('safe', observation.safe),
    ...validateCheckpoint420('finalized', observation.finalized),
  ];
  if (!observation.id.trim()) errors.push('observation ID must be non-empty');
  if (observation.chainId <= 0n) errors.push(`observation ${observation.id} chain ID must be positive`);
  if (!Number.isFinite(observation.observedAt) || observation.observedAt < 0) errors.push(`observation ${observation.id} observedAt must be non-negative`);
  if (observation.safe && observation.safe.number > observation.head.number) errors.push(`observation ${observation.id} safe checkpoint is ahead of head`);
  if (observation.finalized && observation.finalized.number > observation.head.number) errors.push(`observation ${observation.id} finalized checkpoint is ahead of head`);
  if (observation.safe && observation.finalized && observation.finalized.number > observation.safe.number) {
    errors.push(`observation ${observation.id} finalized checkpoint is ahead of safe checkpoint`);
  }
  return errors;
}

function sameHeightConflicts420(observations: readonly RpcChainObservation420[], kind: 'safe' | 'finalized'): string[] {
  const byHeight = new Map<bigint, Map<string, string[]>>();
  for (const observation of observations) {
    const checkpoint = observation[kind];
    if (!checkpoint) continue;
    const hashes = byHeight.get(checkpoint.number) ?? new Map<string, string[]>();
    const providers = hashes.get(checkpoint.hash.toLowerCase()) ?? [];
    providers.push(observation.id);
    hashes.set(checkpoint.hash.toLowerCase(), providers);
    byHeight.set(checkpoint.number, hashes);
  }

  const reasons: string[] = [];
  for (const [height, hashes] of byHeight) {
    if (hashes.size > 1) reasons.push(`${kind} checkpoint disagreement at block ${height}`);
  }
  return reasons;
}

export function evaluateFleetSafety420(
  routingProviders: readonly RpcRoutingProvider420[],
  observations: readonly RpcChainObservation420[],
  policy: RpcChainSafetyPolicy420 = DEFAULT_RPC4_SAFETY_POLICY_420,
  now = Date.now(),
): RpcFleetSafety420 {
  const policyErrors = validateChainSafetyPolicy420(policy);
  if (policyErrors.length > 0) return { safe: false, referenceHead: null, providers: [], reasons: policyErrors };

  const observationById = new Map(observations.map((observation) => [observation.id, observation] as const));
  const eligibleIds = new Set(routingProviders.filter((provider) => provider.discovery.eligible && provider.descriptor.enabled).map((provider) => provider.descriptor.id));
  const eligibleObservations = observations.filter((observation) => eligibleIds.has(observation.id));
  const validHeads = eligibleObservations
    .filter((observation) => validateChainObservation420(observation).length === 0 && observation.chainId === policy.expectedChainId)
    .map((observation) => observation.head.number);
  const referenceHead = validHeads.length > 0 ? validHeads.reduce((a, b) => (a > b ? a : b)) : null;

  const fleetReasons = [
    ...sameHeightConflicts420(eligibleObservations, 'safe'),
    ...sameHeightConflicts420(eligibleObservations, 'finalized'),
  ];

  const providers: RpcProviderSafety420[] = routingProviders.map((provider) => {
    const id = provider.descriptor.id;
    const observation = observationById.get(id) ?? null;
    const reasons: string[] = [];
    if (!provider.discovery.eligible) reasons.push(`provider ${id} is not RPC-1 eligible`);
    if (!provider.descriptor.enabled) reasons.push(`provider ${id} is disabled`);
    if (!observation) reasons.push(`provider ${id} has no RPC-4 chain observation`);
    if (observation) {
      reasons.push(...validateChainObservation420(observation));
      if (observation.id !== id) reasons.push(`provider ${id} observation ID mismatch`);
      if (observation.chainId !== policy.expectedChainId) reasons.push(`provider ${id} reported wrong chain ID ${observation.chainId}`);
      if (provider.discovery.observedChainId !== null && observation.chainId !== provider.discovery.observedChainId) {
        reasons.push(`provider ${id} chain identity changed after RPC-1 discovery`);
      }
      if (now - observation.observedAt > policy.maxObservationAgeMs) reasons.push(`provider ${id} chain observation is stale`);
      if (observation.observedAt > now) reasons.push(`provider ${id} chain observation is from the future`);
      if (referenceHead !== null && referenceHead - observation.head.number > policy.maxHeadLagBlocks) reasons.push(`provider ${id} head is too far behind the fleet reference head`);
      if (policy.requireSafeCheckpoint && observation.safe === null) reasons.push(`provider ${id} has no safe checkpoint`);
      if (policy.requireFinalizedCheckpoint && observation.finalized === null) reasons.push(`provider ${id} has no finalized checkpoint`);
    }
    return { id, safe: reasons.length === 0 && fleetReasons.length === 0, reasons: [...reasons, ...fleetReasons], observation };
  });

  if (referenceHead === null) fleetReasons.push('no valid eligible execution head is available');
  if (providers.length === 0) fleetReasons.push('no routing providers are configured');
  return { safe: fleetReasons.length === 0 && providers.some((provider) => provider.safe), referenceHead, providers, reasons: fleetReasons };
}

export function safeRouteCandidates420(
  method: string,
  requestTransport: RpcRequestTransport420,
  routingProviders: readonly RpcRoutingProvider420[],
  observations: readonly RpcChainObservation420[],
  policy: RpcChainSafetyPolicy420 = DEFAULT_RPC4_SAFETY_POLICY_420,
  now = Date.now(),
): RpcRouteDecision420 {
  const fleet = evaluateFleetSafety420(routingProviders, observations, policy, now);
  const safeIds = new Set(fleet.providers.filter((provider) => provider.safe).map((provider) => provider.id));
  const decision = routeCandidates420(method, requestTransport, routingProviders.filter((provider) => safeIds.has(provider.descriptor.id)));
  if (decision.selected !== null) return decision;
  const safetyReason = fleet.reasons.length > 0 ? fleet.reasons.join('; ') : 'no RPC-4-safe upstream is available';
  return { ...decision, reason: `${decision.reason ?? `no upstream can serve ${method}`}; ${safetyReason}` };
}
