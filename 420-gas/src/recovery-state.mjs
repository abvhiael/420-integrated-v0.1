export class GasRecoveryError420 extends Error {
  constructor(code) {
    super(code);
    this.name = 'GasRecoveryError420';
    this.code = code;
  }
}

function fail420(code) {
  throw new GasRecoveryError420(code);
}

function time420(value, code = 'GAS10_RECOVERY_TIME_INVALID') {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) fail420(code);
  return new Date(parsed).toISOString();
}

function boundedCode420(value, code) {
  if (typeof value !== 'string' || !/^[a-z0-9._-]{1,48}$/.test(value)) fail420(code);
  return value;
}

const COMPONENTS_420 = Object.freeze(['signer', 'funding', 'settlement-observer']);
const COMPONENT_SET_420 = new Set(COMPONENTS_420);
const STATES_420 = new Set(['healthy', 'degraded', 'unavailable', 'recovering']);

function component420(value) {
  if (!COMPONENT_SET_420.has(value)) fail420('GAS10_RECOVERY_COMPONENT_INVALID');
  return value;
}

function state420(value) {
  if (!STATES_420.has(value)) fail420('GAS10_RECOVERY_STATE_INVALID');
  return value;
}

function record420({ component, state, reasonCode, observedAt, generation }) {
  return Object.freeze({
    component,
    state,
    reasonCode,
    observedAt,
    generation,
  });
}

export class GasRecoveryState420 {
  constructor({ maxTransitions = 256 } = {}) {
    if (!Number.isSafeInteger(maxTransitions) || maxTransitions < 1 || maxTransitions > 10_000) fail420('GAS10_RECOVERY_MAX_TRANSITIONS_INVALID');
    this.maxTransitions = maxTransitions;
    this.transitions = [];
    this.current = new Map();
    this.nextGeneration = 1;
  }

  transition({ component, state, reasonCode, observedAt }) {
    const target = component420(component);
    const nextState = state420(state);
    const reason = boundedCode420(reasonCode, 'GAS10_RECOVERY_REASON_INVALID');
    const time = time420(observedAt);
    const previous = this.current.get(target) ?? null;

    if (previous && previous.state === nextState && previous.reasonCode === reason) {
      return Object.freeze({ changed: false, record: previous });
    }

    if (!Number.isSafeInteger(this.nextGeneration) || this.nextGeneration < 1) fail420('GAS10_RECOVERY_GENERATION_EXHAUSTED');
    const entry = record420({
      component: target,
      state: nextState,
      reasonCode: reason,
      observedAt: time,
      generation: this.nextGeneration,
    });
    this.nextGeneration += 1;
    this.current.set(target, entry);
    this.transitions.push(entry);
    if (this.transitions.length > this.maxTransitions) this.transitions.shift();
    return Object.freeze({ changed: true, record: entry });
  }

  markHealthy(component, observedAt) {
    return this.transition({ component, state: 'healthy', reasonCode: 'healthy', observedAt });
  }

  snapshot() {
    const components = {};
    for (const name of COMPONENTS_420) components[name] = this.current.get(name) ?? null;

    const states = Object.values(components).filter(Boolean).map((entry) => entry.state);
    let state = 'healthy';
    let sponsorshipAvailable = true;
    if (states.includes('unavailable')) {
      state = 'unavailable';
      sponsorshipAvailable = false;
    } else if (states.includes('recovering')) {
      state = 'recovering';
      sponsorshipAvailable = false;
    } else if (states.includes('degraded')) {
      state = 'degraded';
    }

    return Object.freeze({
      schemaVersion: '1.0.0',
      state,
      sponsorshipAvailable,
      components: Object.freeze(components),
      retainedTransitions: this.transitions.length,
      authority: 'operational-guidance-only',
      executionAuthorization: false,
      sponsorshipAuthorization: false,
      settlementAuthority: false,
      accountingAuthority: false,
      canonicalProtocolAuthority: false,
    });
  }

  history() {
    return Object.freeze(this.transitions.map((entry) => entry));
  }
}
