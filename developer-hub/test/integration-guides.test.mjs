import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import {
  createIntegrationGuideView420,
  getIntegrationGuide420,
  IntegrationGuideError420,
  listIntegrationGuides420,
  loadIntegrationGuideRegistry420,
  validateIntegrationGuideRegistry420
} from '../src/integration-guides.mjs';

const registryPath = resolve(import.meta.dirname, '../guides/registry.json');

function registry420() {
  return {
    schemaVersion: '1.0.0',
    guides: [
      {
        id: 'example-guide',
        title: 'Example guide',
        summary: 'Example integration workflow.',
        document: 'docs/developer-hub/guides/example-guide.md',
        steps: [
          { id: 'projection', component: '420Indexer', authority: '420Indexer', canonical: false, action: 'Read a projection.' },
          { id: 'confirm', component: '420-chain-rpc', authority: '420-chain-rpc', canonical: true, action: 'Confirm canonical state.' }
        ]
      }
    ]
  };
}

test('checked-in guide registry loads and exposes all DEVHUB-12 workflows', async () => {
  const registry = await loadIntegrationGuideRegistry420(registryPath);
  assert.equal(registry.schemaVersion, '1.0.0');
  assert.deepEqual(registry.guides.map((guide) => guide.id), [
    'read-only-protocol-client',
    'wallet-aware-transaction',
    'deploy-and-verify',
    'indexer-diagnostics',
    'end-to-end-dapp'
  ]);
});

test('guide view separates canonical and projection steps', () => {
  const registry = validateIntegrationGuideRegistry420(registry420());
  const guide = getIntegrationGuide420(registry, 'example-guide');
  const view = createIntegrationGuideView420(guide);
  assert.equal(view.authorityBoundaryPreserved, true);
  assert.deepEqual(view.projectionSteps, ['projection']);
  assert.deepEqual(view.canonicalSteps, ['confirm']);
});

test('listing exposes stable guide metadata without mutating workflows', () => {
  const list = listIntegrationGuides420(registry420());
  assert.equal(list.length, 1);
  assert.equal(list[0].id, 'example-guide');
  assert.equal(list[0].document, 'docs/developer-hub/guides/example-guide.md');
  assert.equal(Object.prototype.hasOwnProperty.call(list[0], 'steps'), false);
});

test('registry rejects unsupported schema versions and fields', () => {
  assert.throws(() => validateIntegrationGuideRegistry420({ ...registry420(), schemaVersion: '2.0.0' }), /unsupported integration guide registry schemaVersion/);
  assert.throws(() => validateIntegrationGuideRegistry420({ ...registry420(), hiddenAuthority: true }), /unsupported field: hiddenAuthority/);
});

test('guide and step identifiers must be unique and safe', () => {
  const duplicateGuide = registry420();
  duplicateGuide.guides.push(structuredClone(duplicateGuide.guides[0]));
  assert.throws(() => validateIntegrationGuideRegistry420(duplicateGuide), /duplicate integration guide id/);

  const duplicateStep = registry420();
  duplicateStep.guides[0].steps[1].id = 'projection';
  assert.throws(() => validateIntegrationGuideRegistry420(duplicateStep), /duplicate step id/);

  const unsafe = registry420();
  unsafe.guides[0].id = '../escape';
  assert.throws(() => validateIntegrationGuideRegistry420(unsafe), IntegrationGuideError420);
});

test('guide documents must remain inside docs namespace', () => {
  const registry = registry420();
  registry.guides[0].document = '../README.md';
  assert.throws(() => validateIntegrationGuideRegistry420(registry), /safe docs path/);
});

test('every guide must identify at least one canonical authority step', () => {
  const registry = registry420();
  registry.guides[0].steps.forEach((step) => { step.canonical = false; });
  assert.throws(() => validateIntegrationGuideRegistry420(registry), /at least one canonical authority step/);
});

test('unknown guide IDs fail closed', () => {
  assert.throws(() => getIntegrationGuide420(registry420(), 'missing-guide'), /unknown integration guide/);
});
