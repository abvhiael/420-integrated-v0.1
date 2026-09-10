import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, getAddress, http, keccak256, toBytes } from 'viem';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const manifestPath = path.resolve(process.env.GAMING_TESTNET_MANIFEST || path.join(repoRoot, 'deployments/gaming/testnet.runtime.json'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const rpcUrl = process.env.GAMING_TESTNET_RPC_URL?.trim();
if (manifest.status === 'UNRESOLVED_UNTIL_DEPLOYMENT') throw new Error('420GP-15 registry journey blocked: runtime is unresolved');
if (!rpcUrl) throw new Error('GAMING_TESTNET_RPC_URL is required');
const registry = getAddress(manifest.contracts.gameRegistry);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const registryAbi = [
  { type:'function', name:'exists', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'bool'}] },
  { type:'function', name:'isActive', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'bool'}] },
  { type:'function', name:'operatorOf', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'address'}] }
];
const chainId = await publicClient.getChainId();
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);
for (const game of manifest.games ?? []) {
  const gameId = keccak256(toBytes(game.gameIdDomain));
  const expectedOperator = getAddress(manifest.operators[game.operatorRef]);
  const exists = await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'exists', args:[gameId] });
  if (!exists) throw new Error(`${game.name} is not registered in deployed GameRegistry420`);
  const active = await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'isActive', args:[gameId] });
  if (!active) throw new Error(`${game.name} is not active in deployed GameRegistry420`);
  const actualOperator = getAddress(await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'operatorOf', args:[gameId] }));
  if (actualOperator !== expectedOperator) throw new Error(`${game.name} operator mismatch: chain=${actualOperator} manifest=${expectedOperator}`);
}
if ((manifest.games ?? []).length !== 4) throw new Error(`expected four reference games, found ${(manifest.games ?? []).length}`);
console.log('420GP-15 reference-game registry qualification passed for all four games.');
