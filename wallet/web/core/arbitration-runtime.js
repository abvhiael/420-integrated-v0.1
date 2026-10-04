export const ARBITRATION_SERVICE_ID = '420/service/arbitration/v1';

function isAddress(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/.test(value);
}

function isHash(value) {
  return typeof value === 'string' && /^0x[0-9a-fA-F]{64}$/.test(value) && !/^0x0{64}$/.test(value);
}

export function validateArbitrationRuntime(binding) {
  if (!binding || binding.serviceId !== ARBITRATION_SERVICE_ID) throw new Error('arbitration service id mismatch');
  if (!Number.isInteger(binding.chainId) || binding.chainId <= 0) throw new Error('invalid arbitration chain id');
  if (!Number.isInteger(binding.version) || binding.version <= 0) throw new Error('invalid arbitration service version');
  if (!isAddress(binding.router) || !isHash(binding.routerCodeHash)) throw new Error('unverified arbitration router');

  const deps = binding.dependencies || {};
  for (const key of ['policies', 'cases', 'rulings']) {
    const item = deps[key];
    if (!item || !isAddress(item.address) || !isHash(item.codeHash)) throw new Error(`unverified arbitration dependency: ${key}`);
  }

  if (new Set([binding.router, deps.policies.address, deps.cases.address, deps.rulings.address].map((x) => x.toLowerCase())).size !== 4) {
    throw new Error('arbitration dependency alias');
  }

  return Object.freeze({
    serviceId: binding.serviceId,
    chainId: binding.chainId,
    version: binding.version,
    router: binding.router,
    routerCodeHash: binding.routerCodeHash,
    dependencies: Object.freeze({
      policies: Object.freeze({...deps.policies}),
      cases: Object.freeze({...deps.cases}),
      rulings: Object.freeze({...deps.rulings}),
    }),
  });
}

export function arbitrationActionTarget(runtime, action) {
  const verified = validateArbitrationRuntime(runtime);
  const targets = {
    openCase: verified.dependencies.cases.address,
    submitEvidence: verified.dependencies.cases.address,
    appeal: verified.dependencies.cases.address,
    submitRuling: verified.dependencies.rulings.address,
    finalizeRuling: verified.dependencies.rulings.address,
  };
  if (!(action in targets)) throw new Error('unsupported arbitration action');
  return targets[action];
}
