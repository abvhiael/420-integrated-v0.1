import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html',
  'app.js',
  'styles.css',
  'runtime-config.json',
  'core/abi.js',
  'core/accounts.js',
  'core/config.js',
  'core/deployment.js',
  'core/portfolio.js',
  'core/provider.js',
  'core/services.js',
  'test/core.test.js',
];

const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'localStorage.setItem("private']) {
  if (app.includes(forbidden)) errors.push(`forbidden signing secret pattern in app.js: ${forbidden}`);
}
for (const requiredBinding of ['discoverSmartAccount', 'readNetwork', 'readPortfolio', 'sendSmartAccountCreation', 'confirmSmartAccountCreation']) {
  if (!app.includes(requiredBinding)) errors.push(`missing UI Wallet Core binding: ${requiredBinding}`);
}

const accounts = fs.readFileSync(path.join(root, 'core/accounts.js'), 'utf8');
for (const requiredBinding of ['SmartAccount', 'eth_getCode', 'owner', 'recoveryAuthority', 'authorizationEpoch', 'capabilityRegistry']) {
  if (!accounts.includes(requiredBinding)) errors.push(`missing canonical account read binding: ${requiredBinding}`);
}

const deployment = fs.readFileSync(path.join(root, 'core/deployment.js'), 'utf8');
for (const requiredGuard of ['SmartAccountFactory420', 'eth_sendTransaction', 'eth_getTransactionReceipt', 'controllerIsOwner', 'alreadyDeployed']) {
  if (!deployment.includes(requiredGuard)) errors.push(`missing account creation guard: ${requiredGuard}`);
}

const abi = fs.readFileSync(path.join(root, 'core/abi.js'), 'utf8');
if (!abi.includes("createAccount: '4003f6ba'")) errors.push('canonical SmartAccountFactory420 createAccount selector missing');

const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
if (config.manifest?.verificationMode !== 'registry-or-signed-manifest') errors.push('manifest verification mode must fail closed to registry-or-signed-manifest');
if (config.features?.smartAccountExecution !== false) errors.push('general smartAccountExecution must remain disabled until execution implementation is qualified');
if (config.features?.smartAccountCreation !== true) errors.push('smartAccountCreation must be enabled for this qualification stage');
if (config.features?.smartAccountDiscovery !== true) errors.push('smartAccountDiscovery must remain enabled');
if (config.features?.networkReads !== true || config.features?.readOnlyPortfolio !== true) errors.push('network and portfolio reads must remain enabled');
if (config.features?.sessionKeys !== false || config.features?.passkeys !== false) errors.push('session keys and passkeys must remain disabled in account creation stage');
if (!config.smartAccount || !Array.isArray(config.trackedAssets)) errors.push('smart account and tracked asset runtime config required');
if (config.smartAccount?.factoryAddress !== '0x0000000000000000000000000000000000000420') errors.push('wallet must use frozen canonical SmartAccountFactory420 address');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  pass: true,
  walletWebFoundation: true,
  smartAccountDiscovery: true,
  smartAccountCreation: true,
  portfolioReads: true,
  networkReads: true,
  serverSideKeyCustody: false,
  generalSmartAccountExecutionEnabled: false,
  sessionKeysEnabled: false,
  passkeysEnabled: false,
}, null, 2));
