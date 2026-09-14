import test from 'node:test';
import assert from 'node:assert/strict';
import { createApplicationPublishingPlan420, createApplicationPublishingView420, validateApplicationRelease420 } from '../src/app-publishing.mjs';

function network420(overrides = {}) {
  return { name: 'local-420', environment: 'local', chainIdDecimal: '420', ...overrides };
}

function release420(overrides = {}) {
  return {
    schemaVersion: '1.0.0',
    applicationId: 'example-app',
    chainId: '420',
    serviceId: `0x${'11'.repeat(32)}`,
    version: 1,
    implementation: '0x1111111111111111111111111111111111111111',
    runtimeCodeHash: `0x${'22'.repeat(32)}`,
    metadataHash: `0x${'33'.repeat(32)}`,
    registrationProfile: {
      componentType: 'APPLICATION',
      manifestHash: `0x${'44'.repeat(32)}`,
      dependencyRoot: `0x${'00'.repeat(32)}`,
      interfaceHash: `0x${'55'.repeat(32)}`
    },
    publisher: { address: '0x2222222222222222222222222222222222222222', identity: 'publisher:example' },
    walletScopes: ['wallet:connect'],
    appStore: { title: 'Example App', summary: 'Example application release.', launchUrl: 'https://example.invalid/app', categories: ['tools'] },
    ...overrides
  };
}

test('valid application release normalizes public publisher and app metadata', () => {
  const release = validateApplicationRelease420(release420());
  assert.equal(release.applicationId, 'example-app');
  assert.equal(release.publisher.address, '0x2222222222222222222222222222222222222222');
  assert.equal(release.registrationProfile.componentType, 'APPLICATION');
  assert.deepEqual(release.walletScopes, ['wallet:connect']);
});

test('unsupported secret or authority fields fail closed', () => {
  assert.throws(() => validateApplicationRelease420({ ...release420(), privateKey: '0xdead' }), /unsupported field: privateKey/);
  assert.throws(() => validateApplicationRelease420({ ...release420(), registered: true }), /unsupported field: registered/);
});

test('release is bound to selected network chain id', () => {
  assert.throws(() => createApplicationPublishingPlan420({ network: network420({ chainIdDecimal: '421' }), release: release420() }), /chainId does not match/);
});

test('ProtocolRegistry governance remains canonical registration authority', () => {
  const plan = createApplicationPublishingPlan420({ network: network420(), release: release420() });
  assert.equal(plan.status, 'READY_FOR_CANONICAL_PREFLIGHT');
  assert.equal(plan.registryCall.method, 'publishRegisteredService');
  assert.equal(plan.registryCall.requiresGovernanceAuthorization, true);
  assert.equal(plan.registryCall.expectedRuntimeCodeHash, `0x${'22'.repeat(32)}`);
  assert.equal(plan.registryCall.args[5], 'APPLICATION');
  assert.equal(plan.canonicalRegistration, false);
  assert.equal(plan.developerHubAuthority, false);
});

test('AppStore remains non-canonical catalogue projection', () => {
  const plan = createApplicationPublishingPlan420({ network: network420(), release: release420() });
  const stage = plan.stages.find((item) => item.id === 'project-appstore-listing');
  assert.equal(stage.canonical, false);
  assert.equal(plan.appStoreListingCanonical, false);
  assert.match(plan.appStoreAuthority, /catalogue projection/);
});

test('view makes preflight and governance handoff explicit', () => {
  const view = createApplicationPublishingView420(createApplicationPublishingPlan420({ network: network420(), release: release420() }));
  assert.equal(view.nextAction, 'CONFIRM_RUNTIME_CODE_AND_SERVICE_ID_APPROVAL');
  assert.equal(view.governanceRequired, true);
  assert.equal(view.canonicalRegistration, false);
  assert.equal(view.appStoreListingCanonical, false);
});

test('registration profile cannot masquerade as another component type', () => {
  const release = release420();
  release.registrationProfile.componentType = 'PROTOCOL';
  assert.throws(() => validateApplicationRelease420(release), /must be APPLICATION/);
});

test('unsafe launch URLs and duplicate scopes/categories fail closed', () => {
  const httpRelease = release420();
  httpRelease.appStore.launchUrl = 'http://example.invalid';
  assert.throws(() => validateApplicationRelease420(httpRelease), /must use HTTPS/);

  const duplicateScopes = release420();
  duplicateScopes.walletScopes = ['wallet:connect', 'wallet:connect'];
  assert.throws(() => validateApplicationRelease420(duplicateScopes), /walletScopes must be unique/);

  const duplicateCategories = release420();
  duplicateCategories.appStore.categories = ['tools', 'tools'];
  assert.throws(() => validateApplicationRelease420(duplicateCategories), /categories must be unique/);
});

test('zero critical hashes and zero implementation are rejected', () => {
  assert.throws(() => validateApplicationRelease420({ ...release420(), serviceId: `0x${'00'.repeat(32)}` }), /serviceId must be non-zero/);
  assert.throws(() => validateApplicationRelease420({ ...release420(), implementation: '0x0000000000000000000000000000000000000000' }), /implementation is invalid/);
});
