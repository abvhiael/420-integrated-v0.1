import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createPublicClient, createWalletClient, getAddress, http, keccak256, toBytes } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const repoRoot = path.resolve(clientDir, '..', '..');
const contractsDir = path.join(repoRoot, 'contracts');
const outDir = path.join(contractsDir, 'out');
const manifestPath = path.resolve(process.argv[2] || process.env.DICE_DEPLOYMENT_MANIFEST || path.join(repoRoot, 'testnet', 'apps', '420bet', 'dice-v1.shared.json'));

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};

const rpcUrl = requiredEnv('DICE_RPC_URL');
const privateKey = requiredEnv('DICE_DEPLOYER_PRIVATE_KEY');
const configuredChainId = Number(requiredEnv('DICE_CHAIN_ID'));
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('DICE_DEPLOYER_PRIVATE_KEY must be a 32-byte hex key');
if (!Number.isSafeInteger(configuredChainId) || configuredChainId <= 0) throw new Error('DICE_CHAIN_ID must be a positive integer');
if (!fs.existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`);

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.status !== 'PROMOTED') throw new Error(`manifest must be PROMOTED before emergency installation, got ${manifest.status}`);

const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const wallet = createWalletClient({ account, transport: http(rpcUrl) });
const id = (value) => keccak256(toBytes(value));
const COMPONENT_BET = id('420.BET.CORE');
const ACTION_EMERGENCY_SET = id('BET_EMERGENCY_SET');

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} failed with ${result.status}`);
}

function artifact(file, contract) {
  const value = JSON.parse(fs.readFileSync(path.join(outDir, `${file}.sol`, `${contract}.json`), 'utf8'));
  const object = value.bytecode?.object;
  if (!object) throw new Error(`missing bytecode for ${contract}`);
  return { abi: value.abi, bytecode: object.startsWith('0x') ? object : `0x${object}` };
}

async function deploy(file, contract, args = []) {
  const a = artifact(file, contract);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success' || !receipt.contractAddress) throw new Error(`${contract} deployment failed`);
  return { ...a, address: getAddress(receipt.contractAddress) };
}

async function write(target, functionName, args = []) {
  const hash = await wallet.writeContract({ address: target.address, abi: target.abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted`);
}

async function requireCode(address, label) {
  const code = await publicClient.getCode({ address: getAddress(address) });
  if (!code || code === '0x') throw new Error(`${label} has no bytecode: ${address}`);
}

const chainId = await publicClient.getChainId();
if (chainId !== configuredChainId) throw new Error(`RPC chain id ${chainId} does not match DICE_CHAIN_ID ${configuredChainId}`);
if (Number(manifest.chain?.id) !== configuredChainId) throw new Error('manifest chain id mismatch');
if (getAddress(manifest.promotion?.deployer) !== getAddress(account.address)) throw new Error('private key does not match manifest deployer');

const authAddress = getAddress(manifest.contracts.betAuthorization);
const wagerRouterAddress = getAddress(manifest.contracts.wagerRouter);
const randomnessAddress = getAddress(manifest.deployment.randomnessRouter);
const settlementAddress = getAddress(manifest.deployment.settlementEngine);
const capabilityRegistryAddress = getAddress(manifest.deployment.capabilityRegistry);
for (const [label, address] of Object.entries({ authAddress, wagerRouterAddress, randomnessAddress, settlementAddress, capabilityRegistryAddress })) {
  await requireCode(address, label);
}

run('forge', ['build'], { cwd: contractsDir });
const auth = { ...artifact('BetAuthorization420', 'BetAuthorization420'), address: authAddress };
const wagerRouter = { ...artifact('WagerRouter420', 'WagerRouter420'), address: wagerRouterAddress };
const randomness = { ...artifact('RandomnessRouter420', 'RandomnessRouter420'), address: randomnessAddress };
const settlement = { ...artifact('SettlementEngine420', 'SettlementEngine420'), address: settlementAddress };
const capabilityRegistry = { ...artifact('ICapabilityRegistry420', 'ICapabilityRegistry420'), address: capabilityRegistryAddress };

const scopeGlobal = await publicClient.readContract({ address: auth.address, abi: auth.abi, functionName: 'scopeGlobal' });
const canBind = await publicClient.readContract({
  address: capabilityRegistry.address,
  abi: capabilityRegistry.abi,
  functionName: 'isAuthorized',
  args: [account.address, COMPONENT_BET, ACTION_EMERGENCY_SET, scopeGlobal, 0n],
});
if (!canBind) {
  throw new Error(`missing global emergency binding capability: principal=${account.address} component=${COMPONENT_BET} capability=${ACTION_EMERGENCY_SET} scope=${scopeGlobal}`);
}

if (manifest.deployment.emergencyState) throw new Error('manifest already records an emergency state; refusing replacement');
const emergency = await deploy('BetEmergencyState420', 'BetEmergencyState420', [auth.address]);
await write(wagerRouter, 'bindEmergencyState', [emergency.address]);
await write(randomness, 'bindEmergencyState', [emergency.address]);
await write(settlement, 'bindEmergencyState', [emergency.address]);

for (const target of [wagerRouter, randomness, settlement]) {
  const bound = await publicClient.readContract({ address: target.address, abi: target.abi, functionName: 'emergencyState' });
  if (getAddress(bound) !== emergency.address) throw new Error(`emergency binding mismatch on ${target.address}`);
}

manifest.deployment.emergencyState = emergency.address;
manifest.emergencyControl = {
  installedAt: new Date().toISOString(),
  installedBy: account.address,
  actionId: ACTION_EMERGENCY_SET,
  globalBindingScope: scopeGlobal,
  policy: 'prospective-new-risk-halts; committed randomness fulfilment and VOID refund path remain live',
};
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(`420Bet emergency state installed: ${emergency.address}`);
console.log(`updated manifest: ${manifestPath}`);
