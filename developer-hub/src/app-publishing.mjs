const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const HASH_RE = /^0x[0-9a-fA-F]{64}$/;
const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCHEMA_VERSION = '1.0.0';

export class AppPublishingError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppPublishingError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new AppPublishingError420(message);
}

function object420(value, name) {
  assert420(value !== null && typeof value === 'object' && !Array.isArray(value), `${name} must be an object`);
  return value;
}

function exactKeys420(value, allowed, name) {
  for (const key of Object.keys(value)) assert420(allowed.has(key), `${name} contains unsupported field: ${key}`);
}

function nonEmpty420(value, name, max = 256) {
  assert420(typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max, `${name} is invalid`);
  return value.trim();
}

function address420(value, name) {
  assert420(typeof value === 'string' && ADDRESS_RE.test(value) && !/^0x0{40}$/i.test(value), `${name} is invalid`);
  return value.toLowerCase();
}

function hash420(value, name, { allowZero = false } = {}) {
  assert420(typeof value === 'string' && HASH_RE.test(value), `${name} is invalid`);
  const normalized = value.toLowerCase();
  if (!allowZero) assert420(!/^0x0{64}$/.test(normalized), `${name} must be non-zero`);
  return normalized;
}

function httpsUrl420(value, name) {
  const text = nonEmpty420(value, name, 2048);
  let url;
  try { url = new URL(text); } catch { throw new AppPublishingError420(`${name} is invalid`); }
  assert420(url.protocol === 'https:', `${name} must use HTTPS`);
  assert420(!url.username && !url.password, `${name} must not embed credentials`);
  return url.toString();
}

export function validateApplicationRelease420(input) {
  const release = object420(input, 'application release');
  exactKeys420(release, new Set([
    'schemaVersion','applicationId','chainId','serviceId','version','implementation','runtimeCodeHash',
    'metadataHash','registrationProfile','publisher','walletScopes','appStore'
  ]), 'application release');
  assert420(release.schemaVersion === SCHEMA_VERSION, 'unsupported application release schemaVersion');

  const applicationId = nonEmpty420(release.applicationId, 'applicationId', 64);
  assert420(ID_RE.test(applicationId), 'applicationId is invalid');
  assert420(typeof release.chainId === 'string' && /^[1-9][0-9]*$/.test(release.chainId), 'chainId must be a positive decimal string');
  assert420(Number.isInteger(release.version) && release.version >= 1 && release.version <= 0xffffffff, 'version must be a uint32 integer');

  const profile = object420(release.registrationProfile, 'registrationProfile');
  exactKeys420(profile, new Set(['componentType','manifestHash','dependencyRoot','interfaceHash']), 'registrationProfile');
  assert420(profile.componentType === 'APPLICATION', 'registrationProfile.componentType must be APPLICATION');

  const publisher = object420(release.publisher, 'publisher');
  exactKeys420(publisher, new Set(['address','identity']), 'publisher');

  const appStore = object420(release.appStore, 'appStore');
  exactKeys420(appStore, new Set(['title','summary','launchUrl','categories']), 'appStore');
  assert420(Array.isArray(appStore.categories) && appStore.categories.length >= 1 && appStore.categories.length <= 8, 'appStore.categories must contain 1 to 8 entries');
  const categories = appStore.categories.map((item, index) => nonEmpty420(item, `appStore.categories[${index}]`, 48));
  assert420(new Set(categories).size === categories.length, 'appStore.categories must be unique');

  assert420(Array.isArray(release.walletScopes) && release.walletScopes.length <= 32, 'walletScopes must be an array with at most 32 entries');
  const walletScopes = release.walletScopes.map((item, index) => nonEmpty420(item, `walletScopes[${index}]`, 128));
  assert420(new Set(walletScopes).size === walletScopes.length, 'walletScopes must be unique');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    applicationId,
    chainId: release.chainId,
    serviceId: hash420(release.serviceId, 'serviceId'),
    version: release.version,
    implementation: address420(release.implementation, 'implementation'),
    runtimeCodeHash: hash420(release.runtimeCodeHash, 'runtimeCodeHash'),
    metadataHash: hash420(release.metadataHash, 'metadataHash'),
    registrationProfile: Object.freeze({
      componentType: 'APPLICATION',
      manifestHash: hash420(profile.manifestHash, 'registrationProfile.manifestHash'),
      dependencyRoot: hash420(profile.dependencyRoot, 'registrationProfile.dependencyRoot', { allowZero: true }),
      interfaceHash: hash420(profile.interfaceHash, 'registrationProfile.interfaceHash')
    }),
    publisher: Object.freeze({
      address: address420(publisher.address, 'publisher.address'),
      identity: publisher.identity === undefined ? null : nonEmpty420(publisher.identity, 'publisher.identity', 256)
    }),
    walletScopes: Object.freeze(walletScopes),
    appStore: Object.freeze({
      title: nonEmpty420(appStore.title, 'appStore.title', 120),
      summary: nonEmpty420(appStore.summary, 'appStore.summary', 600),
      launchUrl: httpsUrl420(appStore.launchUrl, 'appStore.launchUrl'),
      categories: Object.freeze(categories)
    })
  });
}

export function createApplicationPublishingPlan420({ network, release }) {
  const normalized = validateApplicationRelease420(release);
  assert420(network && typeof network === 'object', 'discovered network is required');
  assert420(typeof network.chainIdDecimal === 'string', 'discovered network chainId is invalid');
  assert420(normalized.chainId === network.chainIdDecimal, 'application release chainId does not match selected network');

  return Object.freeze({
    schemaVersion: SCHEMA_VERSION,
    applicationId: normalized.applicationId,
    status: 'READY_FOR_CANONICAL_PREFLIGHT',
    network: Object.freeze({ name: network.name ?? null, environment: network.environment ?? null, chainId: network.chainIdDecimal }),
    release: normalized,
    canonicalRegistration: false,
    appStoreListingCanonical: false,
    developerHubAuthority: false,
    registryAuthority: '420Registry/ProtocolRegistry governance',
    appStoreAuthority: '420AppStore catalogue projection',
    registryCall: Object.freeze({
      method: 'publishRegisteredService',
      serviceId: normalized.serviceId,
      args: Object.freeze([
        normalized.serviceId,
        normalized.implementation,
        normalized.metadataHash,
        normalized.version,
        true,
        'APPLICATION',
        normalized.registrationProfile.manifestHash,
        normalized.registrationProfile.dependencyRoot,
        normalized.registrationProfile.interfaceHash
      ]),
      expectedRuntimeCodeHash: normalized.runtimeCodeHash,
      requiresGovernanceAuthorization: true
    }),
    stages: Object.freeze([
      Object.freeze({ id: 'validate-release', status: 'ready', authority: 'developer-hub', canonical: false }),
      Object.freeze({ id: 'confirm-runtime-code', status: 'ready', authority: '420-chain-rpc', canonical: true }),
      Object.freeze({ id: 'confirm-service-id-approval', status: 'ready', authority: '420Registry', canonical: true }),
      Object.freeze({ id: 'submit-registry', status: 'blocked', authority: '420Registry/governance', canonical: true, requiresExternalSignature: true }),
      Object.freeze({ id: 'confirm-registration', status: 'blocked', authority: '420Registry/chain-state', canonical: true }),
      Object.freeze({ id: 'project-appstore-listing', status: 'blocked', authority: '420AppStore', canonical: false })
    ])
  });
}

export function createApplicationPublishingView420(plan) {
  assert420(plan && plan.schemaVersion === SCHEMA_VERSION && Array.isArray(plan.stages), 'DEVHUB-13 publishing plan is required');
  return Object.freeze({
    title: '420 application registration and publication',
    applicationId: plan.applicationId,
    chainId: plan.network.chainId,
    version: plan.release.version,
    serviceId: plan.release.serviceId,
    implementation: plan.release.implementation,
    publisher: plan.release.publisher,
    walletScopes: plan.release.walletScopes,
    status: plan.status,
    canonicalRegistration: false,
    appStoreListingCanonical: false,
    nextAction: 'CONFIRM_RUNTIME_CODE_AND_SERVICE_ID_APPROVAL',
    governanceRequired: true,
    registryAuthority: plan.registryAuthority,
    appStoreAuthority: plan.appStoreAuthority,
    stages: plan.stages
  });
}
