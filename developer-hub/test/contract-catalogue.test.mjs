import test from 'node:test';
import assert from 'node:assert/strict';
import { ContractCatalogueError420, createContractCatalogue420, validateContractCatalogue420 } from '../src/contract-catalogue.mjs';

function fixture() {
  return {
    schemaVersion: '1.0.0',
    chainId: '420',
    contracts: [
      {
        name: 'ProtocolRegistry',
        protocol: '420Registry',
        address: '0x0000000000000000000000000000000000000420',
        source: 'genesis',
        version: '1.0.0',
        deploymentBlock: 0,
        artifact: 'contracts/out/ProtocolRegistry.sol/ProtocolRegistry.json',
        interface: 'contracts/src/interfaces/IProtocolRegistry.sol',
        abiSha256: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        verified: true
      }
    ]
  };
}

test('accepts verified catalogue entries with provenance and ABI identity', () => {
  const catalogue = validateContractCatalogue420(fixture());
  assert.equal(catalogue.contracts[0].protocol, '420Registry');
});

test('resolves contracts by name and normalized address without inventing entries', () => {
  const catalogue = createContractCatalogue420(fixture());
  assert.equal(catalogue.chainId, 420n);
  assert.equal(catalogue.get('ProtocolRegistry').address, '0x0000000000000000000000000000000000000420');
  assert.equal(catalogue.getByAddress('0x0000000000000000000000000000000000000420').name, 'ProtocolRegistry');
  assert.equal(catalogue.get('Missing420'), null);
  assert.equal(catalogue.getByAddress('0x0000000000000000000000000000000000000001'), null);
});

test('exposes immutable ABI/interface references', () => {
  const catalogue = createContractCatalogue420(fixture());
  const ref = catalogue.getAbiReference('ProtocolRegistry');
  assert.match(ref.artifact, /ProtocolRegistry\.json$/);
  assert.match(ref.interface, /IProtocolRegistry\.sol$/);
  assert.equal(ref.abiSha256.length, 64);
});

test('fails closed on unverified or malformed catalogue entries', () => {
  const unverified = fixture();
  unverified.contracts[0].verified = false;
  assert.throws(() => validateContractCatalogue420(unverified), ContractCatalogueError420);

  const badHash = fixture();
  badHash.contracts[0].abiSha256 = 'abc';
  assert.throws(() => validateContractCatalogue420(badHash), /abiSha256/);
});

test('rejects duplicate names and duplicate addresses', () => {
  const dupName = fixture();
  dupName.contracts.push({ ...dupName.contracts[0], address: '0x0000000000000000000000000000000000000421' });
  assert.throws(() => validateContractCatalogue420(dupName), /duplicate contract name/);

  const dupAddress = fixture();
  dupAddress.contracts.push({ ...dupAddress.contracts[0], name: 'RegistryAlias' });
  assert.throws(() => validateContractCatalogue420(dupAddress), /duplicate contract address/);
});
