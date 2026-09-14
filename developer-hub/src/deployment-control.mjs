const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SHA256_RE = /^[0-9a-fA-F]{64}$/;
const PROJECT_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const EXECUTORS = new Set(['420-wallet', 'project-adapter']);

export class DeploymentControlError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'DeploymentControlError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new DeploymentControlError420(message);
}

function object420(value, path) {
  assert420(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value;
}

function string420(value, path) {
  assert420(typeof value === 'string' && value.length > 0, `${path} must be a non-empty string`);
  return value;
}

function onlyKeys420(value, allowed, path) {
  for (const key of Object.keys(value)) assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);
}

function relativePath420(value, path) {
  const raw = string420(value, path);
  assert420(!raw.startsWith('/') && !raw.startsWith('\\'), `${path} must be repository-relative`);
  const pieces = raw.replaceAll('\\', '/').split('/');
  assert420(!pieces.includes('..') && !pieces.includes(''), `${path} contains an unsafe path segment`);
  return raw;
}

function normalizeRequest420(input) {
  const request = object420(input, 'deployment request');
  onlyKeys420(request, new Set(['schemaVersion', 'project', 'chainId', 'artifact', 'deployer', 'executor', 'constructorArgs', 'requestVerification', 'requestRegistration']), 'deployment request');
  assert420(request.schemaVersion === '1.0.0', 'unsupported deployment request schemaVersion');
  assert420(typeof request.project === 'string' && PROJECT_RE.test(request.project), 'deployment request project is invalid');
  assert420(typeof request.chainId === 'string' && /^[1-9][0-9]*$/.test(request.chainId), 'deployment request chainId must be a positive decimal string');
  assert420(ADDRESS_RE.test(request.deployer), 'deployment request deployer is invalid');
  assert420(EXECUTORS.has(request.executor), 'deployment request executor is unsupported');
  assert420(Array.isArray(request.constructorArgs ?? []), 'deployment request constructorArgs must be an array');
  assert420(request.requestVerification === undefined || typeof request.requestVerification === 'boolean', 'requestVerification must be boolean');
  assert420(request.requestRegistration === undefined || typeof request.requestRegistration === 'boolean', 'requestRegistration must be boolean');

  const artifact = object420(request.artifact, 'artifact');
  onlyKeys420(artifact, new Set(['contract', 'path', 'sha256']), 'artifact');
  string420(artifact.contract, 'artifact.contract');
  relativePath420(artifact.path, 'artifact.path');
  assert420(typeof artifact.sha256 === 'string' && SHA256_RE.test(artifact.sha256), 'artifact.sha256 must be a 64-character hex SHA-256');
  assert420(!/^0+$/.test(artifact.sha256), 'artifact.sha256 must not be all zeroes');

  return Object.freeze({
    schemaVersion: request.schemaVersion,
    project: request.project,
    chainId: request.chainId,
    artifact: Object.freeze({ ...artifact, sha256: artifact.sha256.toLowerCase() }),
    deployer: request.deployer.toLowerCase(),
    executor: request.executor,
    constructorArgs: Object.freeze(structuredClone(request.constructorArgs ?? [])),
    requestVerification: request.requestVerification ?? true,
    requestRegistration: request.requestRegistration ?? false
  });
}

export function validateDeploymentRequest420(input) {
  return normalizeRequest420(input);
}

export function createDeploymentPlan420({ network, request: requestInput }) {
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(typeof network.chainIdDecimal === 'string', 'discovered network chainId is required');
  assert420(Array.isArray(network.rpc?.http) && network.rpc.http.length > 0, 'selected network has no canonical HTTP RPC endpoint');
  assert420(typeof network.service === 'function', 'discovered network service resolver is required');
  assert420(network.environment !== 'mainnet', 'DEVHUB-9 mainnet deployment is disabled until production-launch qualification');

  const request = normalizeRequest420(requestInput);
  assert420(request.chainId === network.chainIdDecimal, `deployment request chainId ${request.chainId} does not match selected network ${network.chainIdDecimal}`);

  const verifyUrl = network.service('verify');
  if (request.requestVerification) assert420(typeof verifyUrl === 'string' && verifyUrl.length > 0, 'verification requested but selected network exposes no 420Verify service');

  const stages = [
    Object.freeze({ id: 'preflight', status: 'ready', authority: 'developer-hub', requiresExternalSignature: false }),
    Object.freeze({ id: 'deploy', status: 'ready', authority: request.executor, requiresExternalSignature: true }),
    Object.freeze({ id: 'receipt', status: 'blocked', authority: '420-chain-rpc', requiresExternalSignature: false }),
    Object.freeze({ id: 'verify', status: request.requestVerification ? 'blocked' : 'skipped', authority: '420Verify', requiresExternalSignature: false }),
    Object.freeze({ id: 'register', status: request.requestRegistration ? 'blocked' : 'skipped', authority: '420Registry/420AppStore', requiresExternalSignature: request.requestRegistration })
  ];

  return Object.freeze({
    schemaVersion: '1.0.0',
    project: request.project,
    status: 'READY_FOR_EXTERNAL_SIGNER',
    network: Object.freeze({ name: network.name, environment: network.environment, chainId: network.chainIdDecimal, rpc: network.rpc.http[0] }),
    artifact: request.artifact,
    deployer: request.deployer,
    executor: request.executor,
    constructorArgs: request.constructorArgs,
    verification: Object.freeze({ requested: request.requestVerification, service: request.requestVerification ? verifyUrl : null }),
    registration: Object.freeze({ requested: request.requestRegistration }),
    stages: Object.freeze(stages),
    canonicalDeploymentProof: false,
    secretMaterialManaged: false
  });
}

export function recordDeploymentReceipt420(planInput, receiptInput) {
  const plan = object420(planInput, 'deployment plan');
  assert420(plan.status === 'READY_FOR_EXTERNAL_SIGNER', 'deployment plan is not awaiting an external signer');
  const receipt = object420(receiptInput, 'deployment receipt');
  onlyKeys420(receipt, new Set(['transactionHash', 'contractAddress', 'chainId']), 'deployment receipt');
  assert420(typeof receipt.transactionHash === 'string' && HASH_RE.test(receipt.transactionHash), 'deployment receipt transactionHash is invalid');
  assert420(typeof receipt.contractAddress === 'string' && ADDRESS_RE.test(receipt.contractAddress), 'deployment receipt contractAddress is invalid');
  assert420(receipt.chainId === plan.network.chainId, 'deployment receipt chainId does not match deployment plan');

  return Object.freeze({
    ...structuredClone(plan),
    status: 'RECEIPT_RECORDED_REQUIRES_RPC_CONFIRMATION',
    receipt: Object.freeze({
      transactionHash: receipt.transactionHash.toLowerCase(),
      contractAddress: receipt.contractAddress.toLowerCase(),
      chainId: receipt.chainId
    }),
    canonicalDeploymentProof: false,
    requiresRpcConfirmation: true
  });
}

export function createDeploymentControlView420(planInput) {
  const plan = object420(planInput, 'deployment plan');
  assert420(Array.isArray(plan.stages), 'deployment plan stages are required');
  return Object.freeze({
    title: `Deploy ${plan.artifact?.contract ?? 'contract'}`,
    project: plan.project,
    network: plan.network,
    status: plan.status,
    signerBoundary: plan.executor,
    secretMaterialManaged: false,
    canonicalDeploymentProof: plan.canonicalDeploymentProof === true,
    stages: Object.freeze(plan.stages.map((stage) => Object.freeze({ ...stage }))),
    nextAction: plan.status === 'READY_FOR_EXTERNAL_SIGNER'
      ? 'HAND_OFF_TO_EXTERNAL_SIGNER'
      : plan.status === 'RECEIPT_RECORDED_REQUIRES_RPC_CONFIRMATION'
        ? 'CONFIRM_RECEIPT_FROM_CANONICAL_RPC'
        : 'NONE'
  });
}
