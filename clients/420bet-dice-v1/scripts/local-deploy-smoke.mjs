import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
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
import { mnemonicToAccount } from 'viem/accounts';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.resolve(here, '..');
const repoRoot = path.resolve(clientDir, '..', '..');
const contractsDir = path.join(repoRoot, 'contracts');
const outDir = path.join(contractsDir, 'out');
const localDir = path.join(repoRoot, 'testnet', 'apps', '420bet', 'local');
const manifestPath = path.join(localDir, 'dice-v1.deployment.json');
const rpcUrl = process.env.DICE_LOCAL_RPC ?? 'http://127.0.0.1:8545';
const port = new URL(rpcUrl).port || '8545';
const chainId = Number(process.env.DICE_LOCAL_CHAIN_ID ?? '31337');
const mnemonic = process.env.DICE_LOCAL_MNEMONIC ?? 'test test test test test test test test test test test junk';
const keepAlive = process.argv.includes('--keep-alive');

const deployer = mnemonicToAccount(mnemonic, { addressIndex: 0 });
const player = mnemonicToAccount(mnemonic, { addressIndex: 1 });
const publicClient = createPublicClient({ transport: http(rpcUrl) });
const wallet = createWalletClient({ account: deployer, transport: http(rpcUrl) });

const id = (value) => keccak256(toBytes(value));
const COMPONENT_BET = id('420.BET.CORE');
const VAULT = id('420BET.VAULT.CADC.1');
const MODULE = id('420BET.MODULE.DICE');
const MODULE_V1 = id('420BET.MODULE.DICE.V1');
const GAME = id('420BET.GAME.DICE');
const GAME_V1 = id('420BET.GAME.DICE.V1');
const OPERATOR = id('420BET.OPERATOR.1');
const RANDOMNESS = id('profile/randomness/v1');
const RISK = id('profile/risk/v1');
const SETTLEMENT = id('profile/settlement/v1');
const ACCESS = id('profile/access/v1');
const RULESET = id('ruleset/dice/v1');

const ACTION = Object.fromEntries([
  'VAULT_REGISTER','VAULT_RECORD_DEPOSIT','VAULT_SETTLE_WAGER','VAULT_RESERVE_LIABILITY','VAULT_RELEASE_LIABILITY',
  'PROFILE_REGISTER','MODULE_REGISTER','MODULE_APPROVE','OPERATOR_REGISTER','OPERATOR_ACTIVATE','GAME_REGISTER','GAME_ACTIVATE',
  'ACCESS_CONFIGURE','ACCESS_RECORD','RISK_CONFIGURE','RANDOMNESS_CONFIGURE','LP_DEPOSIT','VAULT_ESCROW_STAKE','RISK_RESERVE','WAGER_RECORD','RISK_RELEASE',
  'WAGER_SETTLE_RECORD','PLACE','RANDOMNESS_REQUEST','RANDOMNESS_FULFILL','SETTLE'
].map((name) => [name, id(`BET_${name}`)]));

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

async function waitForRpc() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      if (await publicClient.getChainId()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Anvil did not become ready at ${rpcUrl}`);
}

async function deploy(file, contract, args = []) {
  const a = artifact(file, contract);
  const hash = await wallet.deployContract({ abi: a.abi, bytecode: a.bytecode, args });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`${contract} deployment had no contract address`);
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

let anvil;
try {
  run('forge', ['build'], { cwd: contractsDir });
  anvil = spawn('anvil', ['--port', port, '--chain-id', String(chainId), '--mnemonic', mnemonic, '--silent'], {
    cwd: repoRoot,
    stdio: keepAlive ? 'inherit' : 'ignore',
    detached: keepAlive,
  });
  await waitForRpc();
  if ((await publicClient.getChainId()) !== chainId) throw new Error('unexpected Anvil chain id');

  const caps = await deploy('DiceLocalMocks420', 'DiceLocalCapabilityRegistry420', [deployer.address]);
  const auth = await deploy('BetAuthorization420', 'BetAuthorization420', [caps.address]);
  const modules = await deploy('BetModuleRegistry420', 'BetModuleRegistry420', [auth.address]);
  const profiles = await deploy('BetProfileRegistry420', 'BetProfileRegistry420', [auth.address]);
  const access = await deploy('BetAccessPolicy420', 'BetAccessPolicy420', [auth.address, profiles.address]);
  const operators = await deploy('BetOperatorRegistry420', 'BetOperatorRegistry420', [auth.address]);
  const games = await deploy('BetGameRegistry420', 'BetGameRegistry420', [auth.address, modules.address, profiles.address]);
  const accounting = await deploy('VaultAccounting420', 'VaultAccounting420', [auth.address]);
  const queue = await deploy('WithdrawalQueue420', 'WithdrawalQueue420', [auth.address]);
  const token = await deploy('DiceLocalMocks420', 'DiceLocalToken420');
  const vault = await deploy('BankrollVault420', 'BankrollVault420', [VAULT, token.address, auth.address, accounting.address, queue.address, 86400n]);
  const risk = await deploy('RiskManager420', 'RiskManager420', [auth.address, profiles.address, accounting.address]);
  const registry = await deploy('BetRegistry420', 'BetRegistry420', [auth.address]);
  const wagerRouter = await deploy('WagerRouter420', 'WagerRouter420', [
    auth.address, games.address, modules.address, operators.address, profiles.address,
    access.address, risk.address, registry.address, vault.address,
  ]);
  const randomness = await deploy('RandomnessRouter420', 'RandomnessRouter420', [auth.address, profiles.address, registry.address]);
  const dice = await deploy('DiceV1420', 'DiceV1420', [registry.address, randomness.address, GAME, GAME_V1, RULESET]);
  const settlement = await deploy('SettlementEngine420', 'SettlementEngine420', [auth.address, registry.address, risk.address, vault.address]);
  const diceView = await deploy('DiceV1View420', 'DiceV1View420', [registry.address, randomness.address, dice.address]);

  const scopeVault = await read(auth, 'scopeForVault', [VAULT]);
  const scopeRandomness = await read(auth, 'scopeForProfile', [RANDOMNESS]);
  const scopeRisk = await read(auth, 'scopeForProfile', [RISK]);
  const scopeSettlement = await read(auth, 'scopeForProfile', [SETTLEMENT]);
  const scopeAccess = await read(auth, 'scopeForProfile', [ACCESS]);
  const scopeModule = await read(auth, 'scopeForModule', [MODULE, MODULE_V1]);
  const scopeOperator = await read(auth, 'scopeForOperator', [OPERATOR]);
  const scopeGame = await read(auth, 'scopeForGame', [GAME, GAME_V1]);

  const allow = async (principal, action, scope) => write(caps, 'setAllowed', [principal, COMPONENT_BET, action, scope, true]);

  await allow(deployer.address, ACTION.VAULT_REGISTER, scopeVault);
  await write(accounting, 'registerVault', [VAULT, token.address]);
  await allow(vault.address, ACTION.VAULT_RECORD_DEPOSIT, scopeVault);
  await allow(vault.address, ACTION.VAULT_SETTLE_WAGER, scopeVault);
  await allow(risk.address, ACTION.VAULT_RESERVE_LIABILITY, scopeVault);
  await allow(risk.address, ACTION.VAULT_RELEASE_LIABILITY, scopeVault);

  for (const [profileId, profileType, scope] of [
    [RANDOMNESS, id('RANDOMNESS'), scopeRandomness],
    [RISK, id('RISK'), scopeRisk],
    [SETTLEMENT, id('SETTLEMENT'), scopeSettlement],
    [ACCESS, id('ACCESS'), scopeAccess],
  ]) {
    await allow(deployer.address, ACTION.PROFILE_REGISTER, scope);
    await write(profiles, 'registerProfile', [profileId, profileType, id(`manifest:${profileId}`), id(`artifact:${profileId}`)]);
  }

  await allow(deployer.address, ACTION.ACCESS_CONFIGURE, scopeAccess);
  await write(access, 'configurePolicy', [ACCESS, token.address, zeroAddress, [], 0n, 0n, 0n, id('access-policy')]);

  await allow(deployer.address, ACTION.MODULE_REGISTER, scopeModule);
  await allow(deployer.address, ACTION.MODULE_APPROVE, scopeModule);
  await write(modules, 'registerModule', [MODULE, MODULE_V1, dice.address, id('module-manifest'), id('module-code')]);
  await write(modules, 'approve', [MODULE_V1]);

  await allow(deployer.address, ACTION.OPERATOR_REGISTER, scopeOperator);
  await allow(deployer.address, ACTION.OPERATOR_ACTIVATE, scopeOperator);
  await write(operators, 'registerOperator', [OPERATOR, deployer.address, id('operator-manifest')]);
  await write(operators, 'activate', [OPERATOR]);

  await allow(deployer.address, ACTION.GAME_REGISTER, scopeGame);
  await allow(deployer.address, ACTION.GAME_ACTIVATE, scopeGame);
  await write(games, 'registerGame', [{
    gameId: GAME,
    gameVersionId: GAME_V1,
    moduleVersionId: MODULE_V1,
    rulesetId: RULESET,
    randomnessProfileId: RANDOMNESS,
    riskProfileId: RISK,
    settlementProfileId: SETTLEMENT,
    accessPolicyId: ACCESS,
    manifestHash: id('game-manifest'),
    productClass: 1,
    gameMode: 1,
    registeredAt: 0n,
    status: 0,
    exists: false,
  }]);
  await write(games, 'activate', [GAME_V1]);

  await allow(deployer.address, ACTION.RISK_CONFIGURE, scopeRisk);
  await write(risk, 'configureProfile', [{
    profileId: RISK,
    maxStakePerWager: parseEther('200'),
    maxGrossPayoutPerWager: parseEther('600'),
    maxReservedLiabilityPerWager: parseEther('500'),
    maxReservedLiabilityPerGame: parseEther('800'),
    maxReservedLiabilityPerVault: parseEther('800'),
    maxReservedLiabilityPerCorrelationKey: parseEther('600'),
    manifestHash: id('risk-terms'),
    exists: false,
  }]);

  await allow(deployer.address, ACTION.RANDOMNESS_CONFIGURE, scopeRandomness);
  await write(randomness, 'configureProfile', [{
    profileId: RANDOMNESS,
    method: 1,
    primaryProvider: deployer.address,
    fallbackProvider: zeroAddress,
    fallbackDelay: 100n,
    securityLevelHash: id('security'),
    domainSeparator: id('dice-randomness-domain'),
    manifestHash: id('randomness-manifest'),
    exists: false,
  }]);

  await allow(deployer.address, ACTION.LP_DEPOSIT, scopeVault);
  await write(token, 'mint', [deployer.address, parseEther('1000')]);
  await write(token, 'approve', [vault.address, parseEther('1000')]);
  await write(vault, 'depositToken', [parseEther('1000')]);

  await allow(wagerRouter.address, ACTION.ACCESS_RECORD, scopeAccess);
  await allow(wagerRouter.address, ACTION.VAULT_ESCROW_STAKE, scopeVault);
  await allow(wagerRouter.address, ACTION.RISK_RESERVE, scopeVault);
  await allow(wagerRouter.address, ACTION.WAGER_RECORD, scopeVault);
  await allow(settlement.address, ACTION.RISK_RELEASE, scopeVault);
  await allow(settlement.address, ACTION.VAULT_SETTLE_WAGER, scopeVault);

  await allow(player.address, ACTION.PLACE, scopeGame);
  await write(token, 'mint', [player.address, parseEther('100')]);

  fs.mkdirSync(localDir, { recursive: true });
  const sourceCommit = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot, encoding: 'utf8' }).stdout.trim();
  const manifest = {
    schema: '420bet-dice-v1-deployment-v1',
    status: 'PROMOTED',
    target: 'LOCAL_ANVIL',
    chain: {
      id: chainId,
      name: '420Bet DiceV1 Local Anvil',
      rpcUrl,
      nativeCurrency: { name: '420', symbol: '420', decimals: 18 },
    },
    contracts: {
      dice: dice.address,
      diceView: diceView.address,
      wagerRouter: wagerRouter.address,
      accessPolicy: access.address,
      vault: vault.address,
      asset: token.address,
      betAuthorization: auth.address,
    },
    ids: { gameId: GAME, gameVersionId: GAME_V1, operatorId: OPERATOR },
    promotion: {
      deployer: deployer.address,
      sourceCommit,
      deployedAt: new Date().toISOString(),
    },
    local: {
      player: player.address,
      playerMnemonicIndex: 1,
      capabilityRegistry: caps.address,
      token: token.address,
      settlementEngine: settlement.address,
      randomnessRouter: randomness.address,
      wagerRegistry: registry.address,
    },
  };
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`promoted local manifest: ${manifestPath}`);

  run('node', [path.join(clientDir, 'scripts', 'smoke-rpc.mjs'), manifestPath], { cwd: clientDir });
  run('node', [path.join(clientDir, 'scripts', 'manifest-to-config.mjs'), manifestPath], { cwd: clientDir });
  console.log('420Bet DiceV1 local deployment harness PASS');
  console.log(`player address: ${player.address}`);
  console.log(`browser config: ${path.join(clientDir, 'public', 'config.js')}`);

  if (keepAlive) {
    console.log(`Anvil left running at ${rpcUrl} (pid ${anvil.pid})`);
    anvil.unref();
  }
} finally {
  if (anvil && !keepAlive && !anvil.killed) anvil.kill('SIGTERM');
}
