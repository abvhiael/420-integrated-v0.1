import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);

async function json(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, root), 'utf8'));
}

async function text(relativePath) {
  return readFile(new URL(relativePath, root), 'utf8');
}

test('network manifest schema fails closed to the frozen v1 schema', async () => {
  const schema = await json('schema/network-manifest.schema.json');
  assert.equal(schema.properties.schemaVersion.const, '1.0.0');
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(schema.required, [
    'schemaVersion',
    'network',
    'nativeCurrency',
    'rpc',
    'services',
    'contracts'
  ]);
  assert.equal(schema.properties.network.properties.chainId.type, 'string');
  assert.equal(schema.properties.network.properties.chainId.pattern, '^[1-9][0-9]*$');
});

test('contract catalogue entries require address and provenance', async () => {
  const schema = await json('schema/network-manifest.schema.json');
  const contract = schema.properties.contracts.additionalProperties;
  assert.deepEqual(contract.required, ['address', 'source']);
  assert.match(contract.properties.address.pattern, /0x/);
  assert.deepEqual(contract.properties.source.enum, [
    'genesis',
    'registry',
    'governance',
    'deployment-manifest'
  ]);
});

test('local example is explicitly non-production and preserves explicit chain identity', async () => {
  const manifest = await json('manifests/local.example.json');
  assert.equal(manifest.schemaVersion, '1.0.0');
  assert.equal(manifest.network.environment, 'local');
  assert.equal(manifest.network.chainId, '420');
  assert.equal(typeof manifest.network.chainId, 'string');
  assert.equal(manifest.nativeCurrency.symbol, '420');
  assert.ok(manifest.rpc.http.length > 0);
  assert.ok(manifest.services.indexer);
  assert.ok(manifest.services.faucet);
});

test('DEVHUB-0 documentation freezes non-authority and indexer projection boundaries', async () => {
  const doc = await text('../docs/DEVELOPER-HUB-DEVHUB-0.md');
  assert.match(doc, /does not become a new source of protocol truth/i);
  assert.match(doc, /Indexed output remains a projection/i);
  assert.match(doc, /DEVHUB-INV-001/);
  assert.match(doc, /DEVHUB-INV-008/);
  assert.match(doc, /faucet capability is testnet-only/i);
});

test('Hub foundation does not define production secrets or private keys', async () => {
  const manifestText = await text('manifests/local.example.json');
  assert.doesNotMatch(manifestText, /privateKey|private_key|mnemonic|secretKey|secret_key/i);
});
