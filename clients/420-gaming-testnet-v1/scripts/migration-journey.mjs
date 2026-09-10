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
if (manifest.status === 'UNRESOLVED_UNTIL_DEPLOYMENT') throw new Error('420GP-15 migration journey blocked: runtime is unresolved');

const rpcUrl = requiredEnv('GAMING_TESTNET_RPC_URL');
const player = privateKeyToAccount(requireKey('GAMING_TESTNET_PLAYER_PRIVATE_KEY'));
const operator = privateKeyToAccount(requireKey('GAMING_TESTNET_HIGH_COUNTRY_OPERATOR_PRIVATE_KEY'));
if (getAddress(operator.address) !== getAddress(manifest.operators.highCountryOperator)) throw new Error('High Country operator signer does not match runtime manifest');
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const operatorClient = createWalletClient({ account: operator, transport: http(rpcUrl) });
const playerClient = createWalletClient({ account: player, transport: http(rpcUrl) });
const identity = getAddress(manifest.contracts.gameIdentity);
const claims = getAddress(manifest.contracts.gameClaims);
const highCountry = manifest.games.find((game) => game.name === 'High Country');
if (!highCountry) throw new Error('High Country runtime registration missing');
const gameId = keccak256(toBytes(highCountry.gameIdDomain));
const identityAbi = [{ type:'function', name:'profileIdOf', stateMutability:'view', inputs:[{type:'bytes32'},{type:'address'}], outputs:[{type:'bytes32'}] }];
const claimsAbi = [
  { type:'function', name:'issue', stateMutability:'nonpayable', inputs:[{type:'bytes32'},{type:'bytes32'},{type:'address'},{type:'bytes32'},{type:'bytes32'},{type:'uint64'}], outputs:[] },
  { type:'function', name:'consume', stateMutability:'nonpayable', inputs:[{type:'bytes32'}], outputs:[{type:'bytes32'}] },
  { type:'function', name:'cancel', stateMutability:'nonpayable', inputs:[{type:'bytes32'}], outputs:[] }
];
const chainId = await publicClient.getChainId();
if (chainId !== manifest.chainId) throw new Error(`chainId mismatch: rpc=${chainId} manifest=${manifest.chainId}`);
const profileId = await publicClient.readContract({ address: identity, abi: identityAbi, functionName:'profileIdOf', args:[gameId, player.address] });
if (/^0x0{64}$/.test(profileId)) throw new Error('player profile required before migration journey');
const block = await publicClient.getBlock();
const nonce = `${block.number}/${Date.now()}`;
const claimId = keccak256(toBytes(`420GP-15/CLAIM/${player.address}/${nonce}`));
const guestStateCommitment = keccak256(toBytes(`420GP-15/GUEST/${nonce}`));
const migrationPayloadHash = keccak256(toBytes(`420GP-15/PAYLOAD/${nonce}`));
const validUntil = block.timestamp + 3600n;
const issueHash = await operatorClient.writeContract({ address: claims, abi: claimsAbi, functionName:'issue', args:[claimId, gameId, player.address, guestStateCommitment, migrationPayloadHash, validUntil] });
if ((await publicClient.waitForTransactionReceipt({ hash: issueHash })).status !== 'success') throw new Error('migration claim issue transaction failed');
const consumeHash = await playerClient.writeContract({ address: claims, abi: claimsAbi, functionName:'consume', args:[claimId] });
if ((await publicClient.waitForTransactionReceipt({ hash: consumeHash })).status !== 'success') throw new Error('migration claim consume transaction failed');
let replayRejected = false;
try { await publicClient.simulateContract({ account: player, address: claims, abi: claimsAbi, functionName:'consume', args:[claimId] }); } catch { replayRejected = true; }
if (!replayRejected) throw new Error('consumed migration claim did not fail closed on replay');
const cancelClaimId = keccak256(toBytes(`420GP-15/CLAIM/CANCEL/${player.address}/${nonce}`));
const issueCancelHash = await operatorClient.writeContract({ address: claims, abi: claimsAbi, functionName:'issue', args:[cancelClaimId, gameId, player.address, guestStateCommitment, migrationPayloadHash, validUntil] });
if ((await publicClient.waitForTransactionReceipt({ hash: issueCancelHash })).status !== 'success') throw new Error('cancellable migration claim issue failed');
const cancelHash = await operatorClient.writeContract({ address: claims, abi: claimsAbi, functionName:'cancel', args:[cancelClaimId] });
if ((await publicClient.waitForTransactionReceipt({ hash: cancelHash })).status !== 'success') throw new Error('migration claim cancel transaction failed');
let cancelledRejected = false;
try { await publicClient.simulateContract({ account: player, address: claims, abi: claimsAbi, functionName:'consume', args:[cancelClaimId] }); } catch { cancelledRejected = true; }
if (!cancelledRejected) throw new Error('cancelled migration claim did not fail closed');
console.log(`420GP-15 migration lifecycle passed: ${claimId}`);
