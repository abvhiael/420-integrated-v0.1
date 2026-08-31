import { createPublicClient, getAddress, http } from 'viem';
import { loadDeploymentManifest } from './deployment-manifest.mjs';

const manifestPath = process.env.DICE_DEPLOYMENT_MANIFEST ?? process.argv[2];
const { manifest, resolved } = loadDeploymentManifest(manifestPath);
const client = createPublicClient({ transport: http(manifest.chain.rpcUrl) });

const actualChainId = await client.getChainId();
if (actualChainId !== manifest.chain.id) {
  throw new Error(`chain ID mismatch: manifest=${manifest.chain.id}, rpc=${actualChainId}`);
}

const codeTargets = ['dice', 'diceView', 'wagerRouter', 'vault', 'betAuthorization'];
for (const key of codeTargets) {
  const address = getAddress(manifest.contracts[key]);
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`${key} has no deployed bytecode at ${address}`);
  console.log(`code ok: ${key} ${address} (${(code.length - 2) / 2} bytes)`);
}

if (manifest.contracts.asset !== '0x0000000000000000000000000000000000000000') {
  const asset = getAddress(manifest.contracts.asset);
  const code = await client.getCode({ address: asset });
  if (!code || code === '0x') throw new Error(`asset has no deployed bytecode at ${asset}`);
  console.log(`code ok: asset ${asset}`);
}

const systemAbi = [
  { type: 'function', name: 'systemName', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'string' }] },
  { type: 'function', name: 'protocolVersion', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint32' }] },
] as const;

const expectedSystems = {
  dice: 'DiceV1420',
  diceView: 'DiceV1View420',
  betAuthorization: 'BetAuthorization420',
};

for (const [key, expected] of Object.entries(expectedSystems)) {
  const address = getAddress(manifest.contracts[key]);
  const [name, version] = await Promise.all([
    client.readContract({ address, abi: systemAbi, functionName: 'systemName' }),
    client.readContract({ address, abi: systemAbi, functionName: 'protocolVersion' }),
  ]);
  if (name !== expected) throw new Error(`${key} identity mismatch: expected ${expected}, got ${name}`);
  if (version !== 1) throw new Error(`${key} protocol version mismatch: expected 1, got ${version}`);
  console.log(`identity ok: ${key} ${name} v${version}`);
}

const diceAbi = [
  { type: 'function', name: 'gameId', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
  { type: 'function', name: 'gameVersionId', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'bytes32' }] },
] as const;
const diceAddress = getAddress(manifest.contracts.dice);
const [gameId, gameVersionId] = await Promise.all([
  client.readContract({ address: diceAddress, abi: diceAbi, functionName: 'gameId' }),
  client.readContract({ address: diceAddress, abi: diceAbi, functionName: 'gameVersionId' }),
]);
if (gameId.toLowerCase() !== manifest.ids.gameId.toLowerCase()) throw new Error('Dice gameId does not match promoted manifest');
if (gameVersionId.toLowerCase() !== manifest.ids.gameVersionId.toLowerCase()) throw new Error('Dice gameVersionId does not match promoted manifest');

console.log(`DiceV1 live deployment smoke PASS: ${resolved}`);
