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
if (manifest.status === 'UNRESOLVED_UNTIL_DEPLOYMENT') throw new Error('420GP-15 cross-game journey blocked: runtime is unresolved');

const rpcUrl = requiredEnv('GAMING_TESTNET_RPC_URL');
const player = privateKeyToAccount(requireKey('GAMING_TESTNET_PLAYER_PRIVATE_KEY'));
const operator = privateKeyToAccount(requireKey('GAMING_TESTNET_HIGH_COUNTRY_OPERATOR_PRIVATE_KEY'));
if (getAddress(operator.address) !== getAddress(manifest.operators.highCountryOperator)) throw new Error('High Country operator signer does not match runtime manifest');
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const operatorClient = createWalletClient({ account: operator, transport: http(rpcUrl) });
const identity = getAddress(manifest.contracts.gameIdentity);
const registry = getAddress(manifest.contracts.crossGameRegistry);
const highCountry = manifest.games.find((game) => game.name === 'High Country');
if (!highCountry) throw new Error('High Country runtime registration missing');
const gameId = keccak256(toBytes(highCountry.gameIdDomain));
const identityAbi = [{ type:'function', name:'profileIdOf', stateMutability:'view', inputs:[{type:'bytes32'},{type:'address'}], outputs:[{type:'bytes32'}] }];
const registryAbi = [
  { type:'function', name:'issue', stateMutability:'nonpayable', inputs:[{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'bytes32'},{type:'uint64'}], outputs:[] },
  { type:'function', name:'revoke', stateMutability:'nonpayable', inputs:[{type:'bytes32'}], outputs:[] },
  { type:'function', name:'isActive', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'bool'}] },
  { type:'function', name:'attestation', stateMutability:'view', inputs:[{type:'bytes32'}], outputs:[{type:'tuple', components:[{name:'attestationId',type:'bytes32'},{name:'sourceGameId',type:'bytes32'},{name:'profileId',type:'bytes32'},{name:'subjectType',type:'bytes32'},{name:'subjectId',type:'bytes32'},{name:'payloadHash',type:'bytes32'},{name:'validUntil',type:'uint64'},{name:'revoked',type:'bool'},{name:'exists',type:'bool'}]}] }
];
const chainId = await publicClient.getChainId();
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);
const profileId = await publicClient.readContract({ address: identity, abi: identityAbi, functionName:'profileIdOf', args:[gameId, player.address] });
if (/^0x0{64}$/.test(profileId)) throw new Error('player profile required before cross-game journey');
const block = await publicClient.getBlock();
const nonce = `${block.number}/${Date.now()}`;
const attestationId = keccak256(toBytes(`420GP-15/ATTESTATION/${player.address}/${nonce}`));
const subjectType = keccak256(toBytes('420/GAMING/SUBJECT/ACHIEVEMENT/V1'));
const subjectId = keccak256(toBytes(`420GP-15/HC/ACHIEVEMENT/${nonce}`));
const payloadHash = keccak256(toBytes(`420GP-15/PAYLOAD/${gameId}/${profileId}/${subjectId}`));
const validUntil = block.timestamp + 3600n;
const issueHash = await operatorClient.writeContract({ address: registry, abi: registryAbi, functionName:'issue', args:[attestationId, profileId, subjectType, subjectId, payloadHash, validUntil] });
if ((await publicClient.waitForTransactionReceipt({ hash: issueHash })).status !== 'success') throw new Error('cross-game attestation issue transaction failed');
if (!(await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'isActive', args:[attestationId] }))) throw new Error('issued cross-game attestation is not active');
const record = await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'attestation', args:[attestationId] });
if (record.sourceGameId !== gameId || record.profileId !== profileId || record.subjectType !== subjectType || record.subjectId !== subjectId || record.payloadHash !== payloadHash || !record.exists || record.revoked) throw new Error('cross-game attestation scope mismatch');
const revokeHash = await operatorClient.writeContract({ address: registry, abi: registryAbi, functionName:'revoke', args:[attestationId] });
if ((await publicClient.waitForTransactionReceipt({ hash: revokeHash })).status !== 'success') throw new Error('cross-game attestation revoke transaction failed');
if (await publicClient.readContract({ address: registry, abi: registryAbi, functionName:'isActive', args:[attestationId] })) throw new Error('revoked cross-game attestation remained active');
console.log(`420GP-15 cross-game attestation lifecycle passed: ${attestationId}`);
