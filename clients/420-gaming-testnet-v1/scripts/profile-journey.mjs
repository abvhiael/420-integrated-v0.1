import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, getAddress, http, keccak256, toBytes, zeroHash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const manifestPath = path.resolve(process.env.GAMING_TESTNET_MANIFEST || path.join(repoRoot, 'deployments/gaming/testnet.runtime.json'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

if (manifest.status === 'UNRESOLVED_UNTIL_DEPLOYMENT') throw new Error('420GP-15 profile journey blocked: runtime is unresolved');
const rpcUrl = requiredEnv('GAMING_TESTNET_RPC_URL');
const privateKey = requiredEnv('GAMING_TESTNET_PLAYER_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('GAMING_TESTNET_PLAYER_PRIVATE_KEY must be a 32-byte hex key');

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const walletClient = createWalletClient({ account, transport: http(rpcUrl) });
const identity = getAddress(manifest.contracts.gameIdentity);
const gameRegistry = getAddress(manifest.contracts.gameRegistry);
const highCountry = manifest.games.find((game) => game.name === 'High Country');
if (!highCountry) throw new Error('High Country runtime registration missing');
const gameId = keccak256(toBytes(highCountry.gameIdDomain));
const commitment = keccak256(toBytes(`420GP-15/PROFILE/JOURNEY/${account.address}`));

const chainId = await publicClient.getChainId();
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);
for (const [label, address] of [['gameRegistry', gameRegistry], ['gameIdentity', identity]]) {
  const code = await publicClient.getCode({ address });
  if (!code || code === '0x') throw new Error(`${label} has no deployed bytecode`);
}

const registryAbi = [{
  type: 'function', name: 'isActive', stateMutability: 'view',
  inputs: [{ name: 'gameId', type: 'bytes32' }], outputs: [{ name: '', type: 'bool' }]
}];
const identityAbi = [
  {
    type: 'function', name: 'profileIdOf', stateMutability: 'view',
    inputs: [{ name: '', type: 'bytes32' }, { name: '', type: 'address' }], outputs: [{ name: '', type: 'bytes32' }]
  },
  {
    type: 'function', name: 'createProfile', stateMutability: 'nonpayable',
    inputs: [{ name: 'gameId', type: 'bytes32' }, { name: 'externalProfileCommitment', type: 'bytes32' }],
    outputs: [{ name: 'profileId', type: 'bytes32' }]
  }
];

const active = await publicClient.readContract({ address: gameRegistry, abi: registryAbi, functionName: 'isActive', args: [gameId] });
if (!active) throw new Error('High Country is not active in deployed GameRegistry420');

let profileId = await publicClient.readContract({ address: identity, abi: identityAbi, functionName: 'profileIdOf', args: [gameId, account.address] });
if (profileId === zeroHash) {
  const hash = await walletClient.writeContract({ address: identity, abi: identityAbi, functionName: 'createProfile', args: [gameId, commitment] });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error('createProfile transaction failed');
  profileId = await publicClient.readContract({ address: identity, abi: identityAbi, functionName: 'profileIdOf', args: [gameId, account.address] });
}
if (profileId === zeroHash) throw new Error('profileIdOf remained zero after profile journey');
console.log(`420GP-15 profile journey passed: ${account.address} -> ${profileId}`);
