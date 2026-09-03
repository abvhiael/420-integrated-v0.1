import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html', 'app.js', 'ui-v1.js', 'apps-page.js', 'styles.css', 'apps.css', 'runtime-config.json',
  'core/abi.js', 'core/accounts.js', 'core/apps.js', 'core/capabilities.js', 'core/capability-management.js', 'core/session-management.js', 'core/session-execution.js',
  'core/config.js', 'core/deployment.js', 'core/execution.js', 'core/portfolio.js', 'core/provider.js', 'core/provider-lifecycle.js', 'core/services.js', 'core/send.js',
  'test/core.test.js', 'test/apps.test.js', 'test/execution.test.js', 'test/capabilities.test.js', 'test/capability-management.test.js', 'test/session-management.test.js', 'test/session-execution.test.js', 'test/ui-v1.test.js', 'test/send.test.js', 'test/provider-lifecycle.test.js',
];

const errors = [];
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'localStorage.setItem("private']) {
  if (app.includes(forbidden)) errors.push(`forbidden signing secret pattern in app.js: ${forbidden}`);
}
for (const requiredBinding of [
  'discoverSmartAccount', 'readNetwork', 'readPortfolio', 'sendSmartAccountCreation', 'confirmSmartAccountCreation',
  'prepareSmartAccountExecution', 'sendSmartAccountExecution', 'confirmSmartAccountExecution', 'inspectCapabilityGrant',
  'sendGasSponsorGrantCreation', 'sendCapabilityGrantRevocation', 'confirmCapabilityManagementTransaction',
  'sendSessionKeyEnablement', 'sendSessionKeyRevocation', 'sendSessionGrantCreation', 'confirmSessionManagementTransaction'
]) {
  if (!app.includes(requiredBinding)) errors.push(`missing UI Wallet Core binding: ${requiredBinding}`);
}

const ui = fs.readFileSync(path.join(root, 'ui-v1.js'), 'utf8');
for (const requiredBinding of ['apps-page.js', 'buildSendExecution', 'send-asset', 'send-recipient', 'send-amount', 'prepare-send', 'execute-target', 'execute-value', 'execute-data', 'installFailClosedBrowserLifecycle']) {
  if (!ui.includes(requiredBinding)) errors.push(`missing Wallet Web UI V1 binding: ${requiredBinding}`);
}

const appsPage = fs.readFileSync(path.join(root, 'apps-page.js'), 'utf8');
for (const requiredGuard of ['resolveServices', 'Verified manifest', 'Awaiting manifest', 'noopener noreferrer', 'apps-search', 'app-filter', 'Not published']) {
  if (!appsPage.includes(requiredGuard)) errors.push(`missing verified 420 Apps page guard: ${requiredGuard}`);
}
if (appsPage.includes('javascript:')) errors.push('420 Apps page must not contain javascript service URLs');

const apps = fs.readFileSync(path.join(root, 'core/apps.js'), 'utf8');
for (const requiredService of ['420/service/swap/v1', '420/service/explorer/v1', '420/service/ai/v1', '420/service/registry/v1', '420/service/identity/v1', '420/service/governance/v1']) {
  if (!apps.includes(requiredService)) errors.push(`missing 420 Apps catalog service: ${requiredService}`);
}

const lifecycle = fs.readFileSync(path.join(root, 'core/provider-lifecycle.js'), 'utf8');
for (const requiredGuard of ['accountsChanged', 'chainChanged', 'disconnect', 'removeListener', 'reload']) {
  if (!lifecycle.includes(requiredGuard)) errors.push(`missing injected provider lifecycle guard: ${requiredGuard}`);
}

const send = fs.readFileSync(path.join(root, 'core/send.js'), 'utf8');
for (const requiredGuard of ['a9059cbb', 'parseUnits', 'normalizeAddress', "kind === 'native'", "kind !== 'erc20'"]) {
  if (!send.includes(requiredGuard)) errors.push(`missing guided send guard: ${requiredGuard}`);
}
if (send.includes('eth_sendTransaction') || send.includes('eth_sendUserOperation')) errors.push('guided send builder must not broadcast transactions directly');

const accounts = fs.readFileSync(path.join(root, 'core/accounts.js'), 'utf8');
for (const requiredBinding of ['SmartAccount', 'eth_getCode', 'owner', 'recoveryAuthority', 'authorizationEpoch', 'capabilityRegistry']) {
  if (!accounts.includes(requiredBinding)) errors.push(`missing canonical account read binding: ${requiredBinding}`);
}

const deployment = fs.readFileSync(path.join(root, 'core/deployment.js'), 'utf8');
for (const requiredGuard of ['SmartAccountFactory420', 'eth_sendTransaction', 'eth_getTransactionReceipt', 'controllerIsOwner', 'alreadyDeployed']) {
  if (!deployment.includes(requiredGuard)) errors.push(`missing account creation guard: ${requiredGuard}`);
}

const execution = fs.readFileSync(path.join(root, 'core/execution.js'), 'utf8');
for (const requiredGuard of ['eth_call', 'eth_estimateGas', 'eth_sendTransaction', 'controllerIsOwner', 'authority contract', 'confirmSmartAccountExecution']) {
  if (!execution.includes(requiredGuard)) errors.push(`missing Smart Account execution guard: ${requiredGuard}`);
}

const capabilities = fs.readFileSync(path.join(root, 'core/capabilities.js'), 'utf8');
for (const requiredGuard of [
  '0x0000000000000000000000000000000000000421', 'CapabilityRegistry420', 'grantResult', 'usageResult', 'belongsToAccount',
  'SESSION_EXECUTE_CAPABILITY_420', 'readActiveGrantId', 'readCapabilityAuthorization'
]) {
  if (!capabilities.includes(requiredGuard)) errors.push(`missing capability inspection guard: ${requiredGuard}`);
}
for (const forbiddenMutation of ['createGrant(', 'revokeGrant(', '.consume(']) {
  if (capabilities.includes(forbiddenMutation)) errors.push(`capability inspector must remain read-only: ${forbiddenMutation}`);
}

const management = fs.readFileSync(path.join(root, 'core/capability-management.js'), 'utf8');
for (const requiredGuard of ['297945e0', 'be737654', 'eth_call', 'eth_estimateGas', 'eth_sendTransaction', 'controllerIsOwner', 'CANONICAL_CAPABILITY_REGISTRY_420', 'belongsToAccount', 'post-confirmation verification']) {
  if (!management.includes(requiredGuard)) errors.push(`missing capability management guard: ${requiredGuard}`);
}
if (management.includes('createGrant(') || management.includes('revokeGrant(')) errors.push('wallet capability management must not call CapabilityRegistry420 mutation methods directly');

const sessions = fs.readFileSync(path.join(root, 'core/session-management.js'), 'utf8');
for (const requiredGuard of ['8d08b1a4', '5ae7ab32', '388c930c', 'd557e335', 'fdb3c749', 'eth_call', 'eth_estimateGas', 'eth_sendTransaction', 'authorizationEpoch', 'wallet authority contract', 'post-confirmation verification']) {
  if (!sessions.includes(requiredGuard)) errors.push(`missing session administration guard: ${requiredGuard}`);
}

const sessionExecution = fs.readFileSync(path.join(root, 'core/session-execution.js'), 'utf8');
for (const requiredGuard of [
  'efff7e19', 'd86f2b3c', 'SESSION_EXECUTE_CAPABILITY_420', 'readActiveGrantId', 'readCapabilityAuthorization',
  'authorizationEpoch', 'nonce lane', 'wallet authority contract', 'broadcastReady: false', 'EntryPoint420'
]) {
  if (!sessionExecution.includes(requiredGuard)) errors.push(`missing session execution preflight guard: ${requiredGuard}`);
}
if (sessionExecution.includes('eth_sendUserOperation') || sessionExecution.includes('eth_sendTransaction')) {
  errors.push('session execution preflight must not broadcast until production EntryPoint420 transport is frozen');
}

const abi = fs.readFileSync(path.join(root, 'core/abi.js'), 'utf8');
if (!abi.includes("createAccount: '4003f6ba'")) errors.push('canonical SmartAccountFactory420 createAccount selector missing');
if (!abi.includes("execute: 'b61d27f6'")) errors.push('canonical SmartAccount420 execute selector missing');

const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
if (config.manifest?.verificationMode !== 'registry-or-signed-manifest') errors.push('manifest verification mode must fail closed to registry-or-signed-manifest');
if (config.features?.smartAccountExecution !== true || config.features?.executionSimulationRequired !== true) errors.push('guarded owner execution with mandatory simulation must remain enabled');
if (config.features?.capabilityInspection !== true) errors.push('capabilityInspection must remain enabled');
if (config.features?.capabilityMutation !== true || config.features?.gasSponsorGrantManagement !== true) errors.push('guarded capability management must remain enabled');
if (config.features?.sessionKeyAdministration !== true || config.features?.sessionGrantManagement !== true || config.features?.sessionKeys !== true) errors.push('session-key administration and scoped session grants must remain enabled');
if (config.features?.sessionExecutionPreflight !== true) errors.push('session execution preflight must be enabled');
if (config.features?.sessionExecution !== false || config.features?.entryPointUserOpSubmission !== false || config.features?.delegatedCapabilities !== false) errors.push('session broadcast/delegated execution must remain disabled until EntryPoint420 transport is frozen');
if (config.features?.batchExecution !== false || config.features?.passkeys !== false || config.features?.recoveryManagement !== false) errors.push('batching, passkeys, and recovery management must remain disabled');
if (config.features?.smartAccountCreation !== true || config.features?.smartAccountDiscovery !== true) errors.push('smart account discovery and creation must remain enabled');
if (config.features?.networkReads !== true || config.features?.readOnlyPortfolio !== true) errors.push('network and portfolio reads must remain enabled');
if (!config.smartAccount || !Array.isArray(config.trackedAssets)) errors.push('smart account and tracked asset runtime config required');
if (config.smartAccount?.factoryAddress !== '0x0000000000000000000000000000000000000420') errors.push('wallet must use frozen canonical SmartAccountFactory420 address');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  pass: true,
  walletWebFoundation: true,
  walletWebUiV1: true,
  verifiedAppsPage: true,
  appsLaunchFailClosed: true,
  guidedNativeSend: true,
  guidedErc20Send: true,
  guidedSendBroadcastsDirectly: false,
  injectedProviderLifecycleFailClosed: true,
  smartAccountDiscovery: true,
  smartAccountCreation: true,
  simulatedOwnerExecution: true,
  capabilityInspection: true,
  capabilityMutationEnabled: true,
  gasSponsorGrantManagement: true,
  sessionKeyAdministration: true,
  sessionGrantManagement: true,
  sessionExecutionPreflight: true,
  sessionExecutionEnabled: false,
  entryPointUserOpSubmission: false,
  canonicalCapabilityRegistry: '0x0000000000000000000000000000000000000421',
  serverSideKeyCustody: false,
  batchExecutionEnabled: false,
  delegatedCapabilitiesEnabled: false,
  recoveryManagementEnabled: false,
  passkeysEnabled: false
}, null, 2));
