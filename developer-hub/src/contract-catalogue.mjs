const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SOURCES = new Set(['genesis', 'registry', 'governance', 'deployment-manifest']);

export class ContractCatalogueError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'ContractCatalogueError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new ContractCatalogueError420(message);
}

function object420(value, path) {
  assert420(value && typeof value === 'object' && !Array.isArray(value), `${path} must be an object`);
  return value;
}

function string420(value, path) {
  assert420(typeof value === 'string' && value.length > 0, `${path} must be a non-empty string`);
  return value;
}

export function validateContractCatalogue420(input) {
  const catalogue = object420(input, 'catalogue');
  assert420(catalogue.schemaVersion === '1.0.0', 'unsupported contract catalogue schemaVersion');
  assert420(typeof catalogue.chainId === 'string' && /^[1-9][0-9]*$/.test(catalogue.chainId), 'catalogue.chainId must be a positive decimal string');
  assert420(Array.isArray(catalogue.contracts), 'catalogue.contracts must be an array');

  const seenNames = new Set();
  const seenAddresses = new Set();
  for (const [index, raw] of catalogue.contracts.entries()) {
    const path = `catalogue.contracts[${index}]`;
    const contract = object420(raw, path);
    const allowed = new Set(['name','protocol','address','source','version','deploymentBlock','artifact','interface','abiSha256','verified']);
    for (const key of Object.keys(contract)) assert420(allowed.has(key), `${path} contains unsupported field: ${key}`);

    const name = string420(contract.name, `${path}.name`);
    string420(contract.protocol, `${path}.protocol`);
    assert420(ADDRESS_RE.test(contract.address), `${path}.address is invalid`);
    assert420(SOURCES.has(contract.source), `${path}.source is invalid`);
    string420(contract.version, `${path}.version`);
    assert420(Number.isSafeInteger(contract.deploymentBlock) && contract.deploymentBlock >= 0, `${path}.deploymentBlock is invalid`);
    string420(contract.artifact, `${path}.artifact`);
    string420(contract.interface, `${path}.interface`);
    assert420(SHA256_RE.test(contract.abiSha256), `${path}.abiSha256 is invalid`);
    assert420(contract.verified === true, `${path}.verified must be true`);

    const address = contract.address.toLowerCase();
    assert420(!seenNames.has(name), `duplicate contract name: ${name}`);
    assert420(!seenAddresses.has(address), `duplicate contract address: ${address}`);
    seenNames.add(name);
    seenAddresses.add(address);
  }

  return structuredClone(catalogue);
}

export function createContractCatalogue420(input) {
  const catalogue = validateContractCatalogue420(input);
  const byName = new Map(catalogue.contracts.map((entry) => [entry.name, Object.freeze({ ...entry, address: entry.address.toLowerCase() })]));
  const byAddress = new Map([...byName.values()].map((entry) => [entry.address, entry]));

  return Object.freeze({
    schemaVersion: catalogue.schemaVersion,
    chainId: BigInt(catalogue.chainId),
    chainIdDecimal: catalogue.chainId,
    list: () => Object.freeze([...byName.values()]),
    get: (name) => byName.get(name) ?? null,
    getByAddress: (address) => typeof address === 'string' ? (byAddress.get(address.toLowerCase()) ?? null) : null,
    getAbiReference: (name) => {
      const contract = byName.get(name);
      if (!contract) return null;
      return Object.freeze({ artifact: contract.artifact, interface: contract.interface, abiSha256: contract.abiSha256 });
    }
  });
}
