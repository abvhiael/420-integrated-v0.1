import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, getAddress, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..');
const manifestPath = path.resolve(process.env.GAMING_TESTNET_MANIFEST || path.join(repoRoot, 'deployments/gaming/testnet.runtime.json'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const requiredEnv = (name) => { const value = process.env[name]?.trim(); if (!value) throw new Error(`${name} is required`); return value; };
const requireKey = (name) => { const value = requiredEnv(name); if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new Error(`${name} must be a 32-byte hex key`); return value; };
if (manifest.status === 'UNRESOLVED_UNTIL_DEPLOYMENT') throw new Error('420GP-15 entitlement journey blocked: runtime is unresolved');

const rpcUrl = requiredEnv('GAMING_TESTNET_RPC_URL');
const player = privateKeyToAccount(requireKey('GAMING_TESTNET_PLAYER_PRIVATE_KEY'));
const operator = privateKeyToAccount(requireKey('GAMING_TESTNET_HIGH_COUNTRY_OPERATOR_PRIVATE_KEY'));
const expectedOperator = getAddress(manifest.operators.highCountryOperator);
if (getAddress(operator.address) !== expectedOperator) throw new Error('High Country operator signer does not match runtime manifest');

const publicClient = createPublicClient({ transport: http(rpcUrl) });
const operatorClient = createWalletClient({ account: operator, transport: http(rpcUrl) });
const identity = getAddress(manifest.contracts.gameIdentity);
const entitlements = getAddress(manifest.contracts.gameEntitlements);
const highCountry = manifest.games.find((game) => game.name === 'High Country');
if (!highCountry) throw new Error('High Country runtime registration missing');
const gameId = keccak256(toBytes(highCountry.gameIdDomain));
const identityAbi = [{ type:'function', name:'profileIdOf', stateMutability:'view', inputs:[{type:'bytes32'},{type:'address'}], outputs:[{type:'bytes32'}] }];
const entitlementAbi = [
  { type:'function', name:'issue', stateMutability:'nonpayable', inputs:[{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'uint64'},{type:'uint64'}], outputs:[] },
  { type:'function', name:'revoke', stateMutability:'nonpayable', inputs:[{type:'bytes32'}], outputs:[] },
  { type:'function', name:'isActive', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'bool'}] }
];
const chainId = await publicClient.getChainId();
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);
const profileId = await publicClient.readContract({ address: identity, abi: identityAbi, functionName:'profileIdOf', args:[gameId, player.address] });
if (/^0x0{64}$/.test(profileId)) throw new Error('player profile required before entitlement journey');
const block = await publicClient.getBlock();
const nonce = `${block.number}/${Date.now()}`;
const entitlementId = keccak256(toBytes(`420GP-15/ENTITLEMENT/${player.address}/${nonce}`));
const entitlementType = keccak256(toBytes('420/HC/ENTITLEMENT/CROSS_GAME/V1'));
const contentId = keccak256(toBytes(`420GP-15/CONTENT/${nonce}`));
const validUntil = block.timestamp + 3600n;
const issueHash = await operatorClient.writeContract({ address: entitlements, abi: entitlementAbi, functionName:'issue', args:[entitlementId, profileId, entitlementType, contentId, 0n, validUntil] });
const issueReceipt = await publicClient.waitForTransactionReceipt({ hash: issueHash });
if (issueReceipt.status !== 'success') throw new Error('entitlement issue transaction failed');
if (!(await publicClient.readContract({ address: entitlements, abi: entitlementAbi, functionName:'isActive', args:[entitlementId] }))) throw new Error('issued entitlement is not active');
const revokeHash = await operatorClient.writeContract({ address: entitlements, abi: entitlementAbi, functionName:'revoke', args:[entitlementId] });
const revokeReceipt = await publicClient.waitForTransactionReceipt({ hash: revokeHash });
if (revokeReceipt.status !== 'success') throw new Error('entitlement revoke transaction failed');
if (await publicClient.readContract({ address: entitlements, abi: entitlementAbi, functionName:'isActive', args:[entitlementId] })) throw new Error('revoked entitlement remained active');
console.log(`420GP-15 entitlement lifecycle passed: ${entitlementId}`);
