import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  http,
  keccak256,
  parseEther,
  toBytes,
  zeroAddress,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const repoRoot = path.resolve(clientDir, '..', '..');
const contractsDir = path.join(repoRoot, 'contracts');
const outDir = path.join(contractsDir, 'out');

const command = process.argv[2];
if (!['deploy', 'promote'].includes(command)) {
  throw new Error('usage: node scripts/shared-deploy.mjs <deploy|promote> [manifest-path]');
}

const requiredEnv = (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
};
const parsePositive = (name, fallback) => {
  const raw = process.env[name] ?? fallback;
  const value = BigInt(raw);
  if (value <= 0n) throw new Error(`${name} must be positive`);
  return value;
};

const rpcUrl = requiredEnv('DICE_RPC_URL');
const privateKey = requiredEnv('DICE_DEPLOYER_PRIVATE_KEY');
if (!/^0x[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error('DICE_DEPLOYER_PRIVATE_KEY must be a 32-byte hex key');
const configuredChainId = Number(requiredEnv('DICE_CHAIN_ID'));
if (!Number.isSafeInteger(configuredChainId) || configuredChainId <= 0) throw new Error('DICE_CHAIN_ID must be a positive integer');
const targetName = process.env.DICE_TARGET_NAME?.trim() || `420 Integrated chain ${configuredChainId}`;
const outputPath = path.resolve(process.argv[3] || process.env.DICE_DEPLOYMENT_MANIFEST || path.join(repoRoot, 'testnet', 'apps', '420bet', 'dice-v1.shared.json'));
const account = privateKeyToAccount(privateKey);
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const wallet = createWalletClient({ account, transport: http(rpcUrl) });

const id = (value) => keccak256(toBytes(value));
const COMPONENT_BET = id('420.BET.CORE');
const VAULT = id(process.env.DICE_VAULT_ID || '420BET.VAULT.CADC.1');
const MODULE = id('420BET.MODULE.DICE');
const MODULE_V1 = id('420BET.MODULE.DICE.V1');
const GAME = id('420BET.GAME.DICE');
const GAME_V1 = id('420BET.GAME.DICE.V1');
const OPERATOR = id(process.env.DICE_OPERATOR_ID || '420BET.OPERATOR.1');
const RANDOMNESS = id('profile/randomness/v1');
const RISK = id('profile/risk/v1');
const SETTLEMENT = id('profile/settlement/v1');
const ACCESS = id('profile/access/v1');
const RULESET = id('ruleset/dice/v1');

const ACTION = Object.fromEntries([
  'VAULT_REGISTER','VAULT_RECORD_DEPOSIT','VAULT_SETTLE_WAGER','VAULT_RESERVE_LIABILITY','VAULT_RELEASE_LIABILITY',
  'PROFILE_REGISTER','MODULE_REGISTER','MODULE_APPROVE','OPERATOR_REGISTER','OPERATOR_ACTIVATE','GAME_REGISTER','GAME_ACTIVATE',
  'RISK_CONFIGURE','RANDOMNESS_CONFIGURE','LP_DEPOSIT','VAULT_ESCROW_STAKE','RISK_RESERVE','WAGER_RECORD','RISK_RELEASE',
].map((name) => [name, id(`BET_${name}`)]));

const riskTerms = {
  maxStakePerWager: parsePositive('DICE_MAX_STAKE_WEI', parseEther('200').toString()),
  maxGrossPayoutPerWager: parsePositive('DICE_MAX_GROSS_PAYOUT_WEI', parseEther('600').toString()),
  maxReservedLiabilityPerWager: parsePositive('DICE_MAX_LIABILITY_PER_WAGER_WEI', parseEther('500').toString()),
  maxReservedLiabilityPerGame: parsePositive('DICE_MAX_LIABILITY_PER_GAME_WEI', parseEther('800').toString()),
  maxReservedLiabilityPerVault: parsePositive('DICE_MAX_LIABILITY_PER_VAULT_WEI', parseEther('800').toString()),
  maxReservedLiabilityPerCorrelationKey: parsePositive('DICE_MAX_LIABILITY_PER_CORRELATION_WEI', parseEther('600').toString()),
};
if (riskTerms.maxGrossPayoutPerWager < riskTerms.maxStakePerWager) throw new Error('max gross payout must be >= max stake');
const seedLiquidity = parsePositive('DICE_SEED_LIQUIDITY_WEI', parseEther('1000').toString());
const withdrawalCooldown = parsePositive('DICE_WITHDRAWAL_COOLDOWN_SECONDS', '86400');

function run(commandName, args, options = {}) {
  const result = spawnSync(commandName, args, { cwd: repoRoot, stdio: 'inherit', ...options });
  if (result.status !== 0) throw new Error(`${commandName} ${args.join(' ')} failed with ${result.status}`);
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
  const address = getAddress(receipt.contractAddress);
  console.log(`deployed ${contract}: ${address}`);
  return { ...a, address };
}

async function write(target, functionName, args = []) {
  const hash = await wallet.writeContract({ address: target.address, abi: target.abi, functionName, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== 'success') throw new Error(`${functionName} reverted`);
  return receipt;
}

async function read(target, functionName, args = []) {
  return publicClient.readContract({ address: target.address, abi: target.abi, functionName, args });
}

async function requireCode(address, label) {
  const code = await publicClient.getCode({ address: getAddress(address) });
  if (!code || code === '0x') throw new Error(`${label} has no bytecode: ${address}`);
}

function sourceCommit() {
  return spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
}

function serialize(value) {
  return JSON.stringify(value, (_, item) => typeof item === 'bigint' ? item.toString() : item, 2) + '\n';
}

function targetFromManifest(manifest, key, file, contract) {
  const address = manifest.deployment?.[key] || manifest.contracts?.[key];
  if (!address) throw new Error(`manifest missing address for ${key}`);
  return { ...artifact(file, contract), address: getAddress(address) };
}

async function deployStage() {
  const capabilityRegistry = getAddress(requiredEnv('DICE_CAPABILITY_REGISTRY'));
  const asset = getAddress(requiredEnv('DICE_STAKE_ASSET'));
  const randomnessProvider = getAddress(requiredEnv('DICE_RANDOMNESS_PROVIDER'));
  if (asset === zeroAddress) throw new Error('shared deployment requires a real ERC-20 stake asset');
  if (capabilityRegistry === zeroAddress) throw new Error('DICE_CAPABILITY_REGISTRY cannot be zero');
  if (randomnessProvider === zeroAddress) throw new Error('DICE_RANDOMNESS_PROVIDER cannot be zero');

  const chainId = await publicClient.getChainId();
  if (chainId !== configuredChainId) throw new Error(`RPC chain id ${chainId} does not match DICE_CHAIN_ID ${configuredChainId}`);
  await requireCode(capabilityRegistry, 'capability registry');
  await requireCode(asset, 'stake asset');
  run('forge', ['build'], { cwd: contractsDir });

  const auth = await deploy('BetAuthorization420', 'BetAuthorization420', [capabilityRegistry]);
  const modules = await deploy('BetModuleRegistry420', 'BetModuleRegistry420', [auth.address]);
  const profiles = await deploy('BetProfileRegistry420', 'BetProfileRegistry420', [auth.address]);
  const operators = await deploy('BetOperatorRegistry420', 'BetOperatorRegistry420', [auth.address]);
  const games = await deploy('BetGameRegistry420', 'BetGameRegistry420', [auth.address, modules.address, profiles.address]);
  const accounting = await deploy('VaultAccounting420', 'VaultAccounting420', [auth.address]);
  const queue = await deploy('WithdrawalQueue420', 'WithdrawalQueue420', [auth.address]);
  const vault = await deploy('BankrollVault420', 'BankrollVault420', [VAULT, asset, auth.address, accounting.address, queue.address, withdrawalCooldown]);
  const risk = await deploy('RiskManager420', 'RiskManager420', [auth.address, profiles.address, accounting.address]);
  const registry = await deploy('BetRegistry420', 'BetRegistry420', [auth.address]);
  const wagerRouter = await deploy('WagerRouter420', 'WagerRouter420', [
    auth.address, games.address, modules.address, operators.address, profiles.address,
    risk.address, registry.address, vault.address,
  ]);
  const randomness = await deploy('RandomnessRouter420', 'RandomnessRouter420', [auth.address, profiles.address, registry.address]);
  const dice = await deploy('DiceV1420', 'DiceV1420', [registry.address, randomness.address, GAME, GAME_V1, RULESET]);
  const settlement = await deploy('SettlementEngine420', 'SettlementEngine420', [auth.address, registry.address, risk.address, vault.address]);
  const diceView = await deploy('DiceV1View420', 'DiceV1View420', [registry.address, randomness.address, dice.address]);

  const scopes = {
    vault: await read(auth, 'scopeForVault', [VAULT]),
    randomness: await read(auth, 'scopeForProfile', [RANDOMNESS]),
    risk: await read(auth, 'scopeForProfile', [RISK]),
    settlement: await read(auth, 'scopeForProfile', [SETTLEMENT]),
    access: await read(auth, 'scopeForProfile', [ACCESS]),
    module: await read(auth, 'scopeForModule', [MODULE, MODULE_V1]),
    operator: await read(auth, 'scopeForOperator', [OPERATOR]),
    game: await read(auth, 'scopeForGame', [GAME, GAME_V1]),
  };

  const grant = (principal, action, scope, amount, reason) => ({
    principal, componentId: COMPONENT_BET, capabilityId: action, scopeHash: scope, requiredAmount: amount.toString(), reason,
  });
  const grants = [
    grant(account.address, ACTION.VAULT_REGISTER, scopes.vault, 0n, 'register vault accounting asset'),
    grant(vault.address, ACTION.VAULT_RECORD_DEPOSIT, scopes.vault, seedLiquidity, 'record seeded and future LP deposits'),
    grant(vault.address, ACTION.VAULT_SETTLE_WAGER, scopes.vault, riskTerms.maxGrossPayoutPerWager, 'record wager settlement accounting'),
    grant(risk.address, ACTION.VAULT_RESERVE_LIABILITY, scopes.vault, riskTerms.maxReservedLiabilityPerWager, 'reserve wager liability'),
    grant(risk.address, ACTION.VAULT_RELEASE_LIABILITY, scopes.vault, riskTerms.maxReservedLiabilityPerWager, 'release wager liability'),
    grant(account.address, ACTION.PROFILE_REGISTER, scopes.randomness, 0n, 'register randomness profile'),
    grant(account.address, ACTION.PROFILE_REGISTER, scopes.risk, 0n, 'register risk profile'),
    grant(account.address, ACTION.PROFILE_REGISTER, scopes.settlement, 0n, 'register settlement profile'),
    grant(account.address, ACTION.PROFILE_REGISTER, scopes.access, 0n, 'register access profile'),
    grant(account.address, ACTION.MODULE_REGISTER, scopes.module, 0n, 'register Dice module'),
    grant(account.address, ACTION.MODULE_APPROVE, scopes.module, 0n, 'approve Dice module'),
    grant(account.address, ACTION.OPERATOR_REGISTER, scopes.operator, 0n, 'register Dice operator'),
    grant(account.address, ACTION.OPERATOR_ACTIVATE, scopes.operator, 0n, 'activate Dice operator'),
    grant(account.address, ACTION.GAME_REGISTER, scopes.game, 0n, 'register Dice game'),
    grant(account.address, ACTION.GAME_ACTIVATE, scopes.game, 0n, 'activate Dice game'),
    grant(account.address, ACTION.RISK_CONFIGURE, scopes.risk, 0n, 'configure bounded risk profile'),
    grant(account.address, ACTION.RANDOMNESS_CONFIGURE, scopes.randomness, 0n, 'configure randomness provider'),
    grant(account.address, ACTION.LP_DEPOSIT, scopes.vault, seedLiquidity, 'seed bankroll liquidity'),
    grant(wagerRouter.address, ACTION.VAULT_ESCROW_STAKE, scopes.vault, riskTerms.maxStakePerWager, 'escrow accepted player stakes'),
    grant(wagerRouter.address, ACTION.RISK_RESERVE, scopes.vault, riskTerms.maxReservedLiabilityPerWager, 'reserve accepted wager exposure'),
    grant(wagerRouter.address, ACTION.WAGER_RECORD, scopes.vault, riskTerms.maxStakePerWager, 'record accepted wagers'),
    grant(settlement.address, ACTION.RISK_RELEASE, scopes.vault, riskTerms.maxReservedLiabilityPerWager, 'release settled wager exposure'),
    grant(settlement.address, ACTION.VAULT_SETTLE_WAGER, scopes.vault, riskTerms.maxGrossPayoutPerWager, 'resolve settled wager escrow'),
  ];

  const manifest = {
    schema: '420bet-dice-v1-deployment-v1',
    environment: 'SHARED_TESTNET',
    status: 'DEPLOYED_AWAITING_CAPABILITIES',
    target: targetName,
    chain: { id: chainId, name: targetName, rpcUrl, nativeCurrency: { name: '420', symbol: '420', decimals: 18 } },
    contracts: {
      dice: dice.address,
      diceView: diceView.address,
      wagerRouter: wagerRouter.address,
      vault: vault.address,
      asset,
      betAuthorization: auth.address,
    },
    ids: { gameId: GAME, gameVersionId: GAME_V1, operatorId: OPERATOR },
    promotion: {
      deployer: account.address,
      sourceCommit: sourceCommit(),
      deployedAt: new Date().toISOString(),
      notes: 'Not promoted. Grant every required capability through the shared Capability Registry, then run shared:promote.',
    },
    deployment: {
      capabilityRegistry,
      modules: modules.address,
      profiles: profiles.address,
      operators: operators.address,
      games: games.address,
      accounting: accounting.address,
      withdrawalQueue: queue.address,
      riskManager: risk.address,
      wagerRegistry: registry.address,
      randomnessRouter: randomness.address,
      settlementEngine: settlement.address,
      randomnessProvider,
    },
    parameters: {
      vaultId: VAULT,
      moduleId: MODULE,
      moduleVersionId: MODULE_V1,
      randomnessProfileId: RANDOMNESS,
      riskProfileId: RISK,
      settlementProfileId: SETTLEMENT,
      accessProfileId: ACCESS,
      rulesetId: RULESET,
      withdrawalCooldownSeconds: withdrawalCooldown,
      seedLiquidity,
      ...riskTerms,
    },
    scopes,
    requiredCapabilities: grants,
  };
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, serialize(manifest));
  console.log(`shared Dice deployment staged: ${outputPath}`);
  console.log(`required capability grants: ${grants.length}`);
  console.log('No registry/module/game/risk/randomness state was configured before capability approval.');
}

async function promoteStage() {
  if (!fs.existsSync(outputPath)) throw new Error(`manifest not found: ${outputPath}`);
  const manifest = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
  if (manifest.status !== 'DEPLOYED_AWAITING_CAPABILITIES') throw new Error(`manifest status must be DEPLOYED_AWAITING_CAPABILITIES, got ${manifest.status}`);
  if (Number(manifest.chain?.id) !== configuredChainId) throw new Error('manifest chain id mismatch');
  if (getAddress(manifest.promotion?.deployer) !== getAddress(account.address)) throw new Error('private key does not match manifest deployer');
  const chainId = await publicClient.getChainId();
  if (chainId !== configuredChainId) throw new Error(`RPC chain id ${chainId} does not match DICE_CHAIN_ID ${configuredChainId}`);

  run('forge', ['build'], { cwd: contractsDir });
  for (const [label, address] of Object.entries({ ...manifest.contracts, ...manifest.deployment })) {
    if (label === 'randomnessProvider') continue;
    if (typeof address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(address)) await requireCode(address, label);
  }

  const capabilityRegistry = {
    address: getAddress(manifest.deployment.capabilityRegistry),
    abi: artifact('ICapabilityRegistry420', 'ICapabilityRegistry420').abi,
  };
  const missing = [];
  for (const grant of manifest.requiredCapabilities || []) {
    const ok = await publicClient.readContract({
      address: capabilityRegistry.address,
      abi: capabilityRegistry.abi,
      functionName: 'isAuthorized',
      args: [getAddress(grant.principal), grant.componentId, grant.capabilityId, grant.scopeHash, BigInt(grant.requiredAmount)],
    });
    if (!ok) missing.push(grant);
  }
  if (missing.length) {
    console.error(`missing ${missing.length} required capability grant(s):`);
    for (const grant of missing) console.error(`${grant.principal} ${grant.capabilityId} ${grant.scopeHash} amount=${grant.requiredAmount} :: ${grant.reason}`);
    throw new Error('shared Capability Registry prerequisites are incomplete');
  }

  const modules = targetFromManifest(manifest, 'modules', 'BetModuleRegistry420', 'BetModuleRegistry420');
  const profiles = targetFromManifest(manifest, 'profiles', 'BetProfileRegistry420', 'BetProfileRegistry420');
  const operators = targetFromManifest(manifest, 'operators', 'BetOperatorRegistry420', 'BetOperatorRegistry420');
  const games = targetFromManifest(manifest, 'games', 'BetGameRegistry420', 'BetGameRegistry420');
  const accounting = targetFromManifest(manifest, 'accounting', 'VaultAccounting420', 'VaultAccounting420');
  const vault = targetFromManifest(manifest, 'vault', 'BankrollVault420', 'BankrollVault420');
  const risk = targetFromManifest(manifest, 'riskManager', 'RiskManager420', 'RiskManager420');
  const randomness = targetFromManifest(manifest, 'randomnessRouter', 'RandomnessRouter420', 'RandomnessRouter420');
  const dice = targetFromManifest(manifest, 'dice', 'DiceV1420', 'DiceV1420');
  const token = { address: getAddress(manifest.contracts.asset), abi: [
    { type: 'function', name: 'approve', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
    { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  ] };

  await write(accounting, 'registerVault', [VAULT, token.address]);
  for (const [profileId, profileType] of [
    [RANDOMNESS, id('RANDOMNESS')], [RISK, id('RISK')], [SETTLEMENT, id('SETTLEMENT')], [ACCESS, id('ACCESS')],
  ]) {
    await write(profiles, 'registerProfile', [profileId, profileType, id(`manifest:${profileId}`), id(`artifact:${profileId}`)]);
  }
  await write(modules, 'registerModule', [MODULE, MODULE_V1, dice.address, id('module-manifest'), id('module-code')]);
  await write(modules, 'approve', [MODULE_V1]);
  await write(operators, 'registerOperator', [OPERATOR, account.address, id('operator-manifest')]);
  await write(operators, 'activate', [OPERATOR]);
  await write(games, 'registerGame', [{
    gameId: GAME, gameVersionId: GAME_V1, moduleVersionId: MODULE_V1, rulesetId: RULESET,
    randomnessProfileId: RANDOMNESS, riskProfileId: RISK, settlementProfileId: SETTLEMENT, accessPolicyId: ACCESS,
    manifestHash: id('game-manifest'), productClass: 1, gameMode: 1, registeredAt: 0n, status: 0, exists: false,
  }]);
  await write(games, 'activate', [GAME_V1]);
  await write(risk, 'configureProfile', [{
    profileId: RISK,
    maxStakePerWager: BigInt(manifest.parameters.maxStakePerWager),
    maxGrossPayoutPerWager: BigInt(manifest.parameters.maxGrossPayoutPerWager),
    maxReservedLiabilityPerWager: BigInt(manifest.parameters.maxReservedLiabilityPerWager),
    maxReservedLiabilityPerGame: BigInt(manifest.parameters.maxReservedLiabilityPerGame),
    maxReservedLiabilityPerVault: BigInt(manifest.parameters.maxReservedLiabilityPerVault),
    maxReservedLiabilityPerCorrelationKey: BigInt(manifest.parameters.maxReservedLiabilityPerCorrelationKey),
    manifestHash: id('risk-terms'), exists: false,
  }]);
  await write(randomness, 'configureProfile', [{
    profileId: RANDOMNESS,
    method: 1,
    primaryProvider: getAddress(manifest.deployment.randomnessProvider),
    fallbackProvider: zeroAddress,
    fallbackDelay: BigInt(process.env.DICE_RANDOMNESS_FALLBACK_DELAY ?? '100'),
    securityLevelHash: id('security'),
    domainSeparator: id('dice-randomness-domain'),
    manifestHash: id('randomness-manifest'),
    exists: false,
  }]);

  const balance = await publicClient.readContract({ address: token.address, abi: token.abi, functionName: 'balanceOf', args: [account.address] });
  const seed = BigInt(manifest.parameters.seedLiquidity);
  if (balance < seed) throw new Error(`deployer stake-asset balance ${balance} is below seed liquidity ${seed}`);
  await write(token, 'approve', [vault.address, seed]);
  await write(vault, 'depositToken', [seed]);

  const promoted = {
    ...manifest,
    status: 'PROMOTED',
    promotion: {
      ...manifest.promotion,
      promotedAt: new Date().toISOString(),
      notes: 'Shared capability prerequisites verified on-chain; protocol relationships configured; bankroll seeded.',
    },
  };
  fs.writeFileSync(outputPath, serialize(promoted));
  console.log(`shared Dice deployment promoted: ${outputPath}`);
  run('node', [path.join(clientDir, 'scripts', 'smoke-rpc.mjs'), outputPath], { cwd: clientDir });
  run('node', [path.join(clientDir, 'scripts', 'manifest-to-config.mjs'), outputPath], { cwd: clientDir });
}

if (command === 'deploy') await deployStage();
else await promoteStage();
