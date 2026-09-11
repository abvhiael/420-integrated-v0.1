const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const CODE_HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const SHA256_RE = /^[0-9a-fA-F]{64}$/;
const HEX_DATA_RE = /^0x(?:[0-9a-fA-F]{2})*$/;
const RESULT_CLASSES = Object.freeze(['FULL_MATCH', 'PARTIAL_MATCH', 'MISMATCH', 'UNVERIFIABLE']);
const RESULT_SET = new Set(RESULT_CLASSES);
const SOURCE_FORMATS = new Set(['solidity-standard-json', 'multi-file-bundle', 'flattened-source']);
const METADATA_MODES = new Set(['ipfs', 'bzzr1', 'none']);
const PROXY_ROLES = new Set(['none', 'proxy', 'implementation']);

export class VerificationControlError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'VerificationControlError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new VerificationControlError420(message);
}

function object420(value, path) {
  assert420(value !== null && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value;
}

function onlyKeys420(value, allowed, path) {
  for (const key of Object.keys(value)) assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);
}

function string420(value, path) {
  assert420(typeof value === 'string' && value.length > 0, `${path} must be a non-empty string`);
  return value;
}

function relativePath420(value, path) {
  const raw = string420(value, path);
  assert420(!raw.startsWith('/') && !raw.startsWith('\\'), `${path} must be repository-relative`);
  const pieces = raw.replaceAll('\\', '/').split('/');
  assert420(!pieces.includes('..') && !pieces.includes(''), `${path} contains an unsafe path segment`);
  return raw;
}

function normalizeLibraries420(value) {
  const libraries = value ?? {};
  object420(libraries, 'libraries');
  const normalized = {};
  for (const [name, address] of Object.entries(libraries)) {
    assert420(name.length > 0 && name.length <= 128, 'library name is invalid');
    assert420(typeof address === 'string' && ADDRESS_RE.test(address), `library address is invalid: ${name}`);
    normalized[name] = address.toLowerCase();
  }
  return Object.freeze(normalized);
}

function normalizeEvidence420(input) {
  const evidence = object420(input, 'verification evidence');
  onlyKeys420(evidence, new Set([
    'schemaVersion', 'chainId', 'address', 'runtimeCodeHash', 'creationBytecodeHash',
    'sourceBundle', 'compiler', 'constructorArgs', 'libraries', 'proxy'
  ]), 'verification evidence');
  assert420(evidence.schemaVersion === '1.0.0', 'unsupported verification evidence schemaVersion');
  assert420(typeof evidence.chainId === 'string' && /^[1-9][0-9]*$/.test(evidence.chainId), 'verification evidence chainId must be a positive decimal string');
  assert420(typeof evidence.address === 'string' && ADDRESS_RE.test(evidence.address), 'verification evidence address is invalid');
  assert420(typeof evidence.runtimeCodeHash === 'string' && CODE_HASH_RE.test(evidence.runtimeCodeHash), 'verification evidence runtimeCodeHash is invalid');
  assert420(!/^0x0+$/.test(evidence.runtimeCodeHash), 'verification evidence runtimeCodeHash must not be zero');
  if (evidence.creationBytecodeHash !== undefined && evidence.creationBytecodeHash !== null) {
    assert420(typeof evidence.creationBytecodeHash === 'string' && CODE_HASH_RE.test(evidence.creationBytecodeHash), 'creationBytecodeHash is invalid');
  }

  const sourceBundle = object420(evidence.sourceBundle, 'sourceBundle');
  onlyKeys420(sourceBundle, new Set(['format', 'path', 'sha256']), 'sourceBundle');
  assert420(SOURCE_FORMATS.has(sourceBundle.format), 'sourceBundle.format is unsupported');
  relativePath420(sourceBundle.path, 'sourceBundle.path');
  assert420(typeof sourceBundle.sha256 === 'string' && SHA256_RE.test(sourceBundle.sha256), 'sourceBundle.sha256 must be a 64-character hex SHA-256');
  assert420(!/^0+$/.test(sourceBundle.sha256), 'sourceBundle.sha256 must not be all zeroes');

  const compiler = object420(evidence.compiler, 'compiler');
  onlyKeys420(compiler, new Set(['version', 'optimizer', 'evmVersion', 'viaIR', 'metadataHashMode']), 'compiler');
  string420(compiler.version, 'compiler.version');
  string420(compiler.evmVersion, 'compiler.evmVersion');
  assert420(typeof compiler.viaIR === 'boolean', 'compiler.viaIR must be boolean');
  assert420(METADATA_MODES.has(compiler.metadataHashMode), 'compiler.metadataHashMode is unsupported');
  const optimizer = object420(compiler.optimizer, 'compiler.optimizer');
  onlyKeys420(optimizer, new Set(['enabled', 'runs']), 'compiler.optimizer');
  assert420(typeof optimizer.enabled === 'boolean', 'compiler.optimizer.enabled must be boolean');
  assert420(Number.isSafeInteger(optimizer.runs) && optimizer.runs >= 0, 'compiler.optimizer.runs must be a nonnegative integer');

  const constructorArgs = evidence.constructorArgs ?? 'UNKNOWN';
  assert420(constructorArgs === 'UNKNOWN' || (typeof constructorArgs === 'string' && HEX_DATA_RE.test(constructorArgs)), 'constructorArgs must be hex data or UNKNOWN');
  const libraries = normalizeLibraries420(evidence.libraries);

  const proxy = evidence.proxy ?? { role: 'none', relatedAddress: null };
  object420(proxy, 'proxy');
  onlyKeys420(proxy, new Set(['role', 'relatedAddress']), 'proxy');
  assert420(PROXY_ROLES.has(proxy.role), 'proxy.role is unsupported');
  const relatedAddress = proxy.relatedAddress ?? null;
  if (relatedAddress !== null) assert420(typeof relatedAddress === 'string' && ADDRESS_RE.test(relatedAddress), 'proxy.relatedAddress is invalid');
  assert420(proxy.role !== 'none' || relatedAddress === null, 'proxy.relatedAddress is not allowed when proxy.role is none');

  return Object.freeze({
    schemaVersion: evidence.schemaVersion,
    chainId: evidence.chainId,
    address: evidence.address.toLowerCase(),
    runtimeCodeHash: evidence.runtimeCodeHash.toLowerCase(),
    creationBytecodeHash: evidence.creationBytecodeHash?.toLowerCase() ?? null,
    sourceBundle: Object.freeze({
      format: sourceBundle.format,
      path: sourceBundle.path,
      sha256: sourceBundle.sha256.toLowerCase()
    }),
    compiler: Object.freeze({
      version: compiler.version,
      optimizer: Object.freeze({ enabled: optimizer.enabled, runs: optimizer.runs }),
      evmVersion: compiler.evmVersion,
      viaIR: compiler.viaIR,
      metadataHashMode: compiler.metadataHashMode
    }),
    constructorArgs,
    libraries,
    proxy: Object.freeze({ role: proxy.role, relatedAddress: relatedAddress?.toLowerCase() ?? null })
  });
}

function verifyEndpoint420(network) {
  assert420(typeof network.service === 'function', 'discovered network service resolver is required');
  const endpoint = network.service('verify');
  assert420(typeof endpoint === 'string' && endpoint.length > 0, 'selected network exposes no 420Verify service');
  let parsed;
  try { parsed = new URL(endpoint); } catch { throw new VerificationControlError420('420Verify service endpoint is invalid'); }
  assert420(parsed.protocol === 'http:' || parsed.protocol === 'https:', '420Verify service endpoint must use HTTP(S)');
  return endpoint;
}

export function validateVerificationEvidence420(input) {
  return normalizeEvidence420(input);
}

export function createVerificationPlan420({ network, evidence: evidenceInput }) {
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(typeof network.chainIdDecimal === 'string', 'discovered network chainId is required');
  const evidence = normalizeEvidence420(evidenceInput);
  assert420(evidence.chainId === network.chainIdDecimal, `verification evidence chainId ${evidence.chainId} does not match selected network ${network.chainIdDecimal}`);
  const endpoint = verifyEndpoint420(network);

  return Object.freeze({
    schemaVersion: '1.0.0',
    status: 'READY_FOR_420VERIFY_SUBMISSION',
    verificationAuthority: '420Verify',
    service: endpoint,
    network: Object.freeze({ name: network.name, environment: network.environment, chainId: network.chainIdDecimal }),
    subject: Object.freeze({
      chainId: evidence.chainId,
      address: evidence.address,
      runtimeCodeHash: evidence.runtimeCodeHash,
      creationBytecodeHash: evidence.creationBytecodeHash
    }),
    evidence,
    resultClasses: RESULT_CLASSES,
    canonicalProtocolState: false,
    verificationIsAudit: false,
    verificationIsOfficialRegistration: false,
    verificationGrantsWalletAuthority: false,
    secretMaterialManaged: false
  });
}

export function recordVerificationResult420(planInput, resultInput) {
  const plan = object420(planInput, 'verification plan');
  assert420(plan.status === 'READY_FOR_420VERIFY_SUBMISSION', 'verification plan is not awaiting 420Verify');
  const result = object420(resultInput, 'verification result');
  onlyKeys420(result, new Set(['status', 'chainId', 'address', 'runtimeCodeHash', 'reason', 'verificationId']), 'verification result');
  assert420(RESULT_SET.has(result.status), 'verification result status is unsupported');
  assert420(result.chainId === plan.subject.chainId, 'verification result chainId does not match verification plan');
  assert420(typeof result.address === 'string' && result.address.toLowerCase() === plan.subject.address, 'verification result address does not match verification plan');
  assert420(typeof result.runtimeCodeHash === 'string' && result.runtimeCodeHash.toLowerCase() === plan.subject.runtimeCodeHash, 'verification result runtimeCodeHash does not match verification plan');
  if (result.status !== 'FULL_MATCH') assert420(typeof result.reason === 'string' && result.reason.length > 0, `${result.status} verification result requires a diagnostic reason`);
  if (result.verificationId !== undefined) string420(result.verificationId, 'verificationId');

  return Object.freeze({
    ...structuredClone(plan),
    status: 'VERIFICATION_RESULT_RECORDED',
    result: Object.freeze({
      status: result.status,
      chainId: result.chainId,
      address: result.address.toLowerCase(),
      runtimeCodeHash: result.runtimeCodeHash.toLowerCase(),
      reason: result.reason ?? null,
      verificationId: result.verificationId ?? null
    }),
    canonicalProtocolState: false,
    verificationIsAudit: false,
    verificationIsOfficialRegistration: false,
    verificationGrantsWalletAuthority: false
  });
}

export async function submitVerification420({ plan, transport }) {
  assert420(plan && typeof plan === 'object', 'verification plan is required');
  assert420(plan.status === 'READY_FOR_420VERIFY_SUBMISSION', 'verification plan is not ready for submission');
  assert420(transport && typeof transport.request === 'function', 'verification transport is required');
  const response = await transport.request(plan.service, Object.freeze({
    schemaVersion: '1.0.0',
    subject: structuredClone(plan.subject),
    evidence: structuredClone(plan.evidence)
  }));
  return recordVerificationResult420(plan, response);
}

export function createVerificationControlView420(stateInput) {
  const state = object420(stateInput, 'verification state');
  return Object.freeze({
    title: `Verify ${state.subject?.address ?? 'contract'}`,
    network: state.network,
    status: state.status,
    verificationAuthority: '420Verify',
    subject: state.subject,
    result: state.result ?? null,
    resultClasses: RESULT_CLASSES,
    canonicalProtocolState: false,
    verificationIsAudit: false,
    verificationIsOfficialRegistration: false,
    verificationGrantsWalletAuthority: false,
    secretMaterialManaged: false,
    nextAction: state.status === 'READY_FOR_420VERIFY_SUBMISSION'
      ? 'SUBMIT_TO_420VERIFY'
      : state.status === 'VERIFICATION_RESULT_RECORDED'
        ? 'REVIEW_AND_OPTIONALLY_PUBLISH_EVIDENCE'
        : 'NONE'
  });
}
