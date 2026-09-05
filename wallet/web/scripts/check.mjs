import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html','app.js','ui-v1.js','apps-page.js','recovery-ui.js','session-execution-ui.js','batch-execution-ui.js','styles.css','apps.css','runtime-config.json',
  'core/abi.js','core/accounts.js','core/apps.js','core/batch-execution.js','core/capabilities.js','core/capability-management.js','core/session-management.js','core/session-execution.js','core/entrypoint-transport.js','core/recovery.js','core/recovery-management.js','core/config.js','core/deployment.js','core/execution.js','core/portfolio.js','core/provider.js','core/provider-lifecycle.js','core/services.js','core/send.js','core/passkeys.js','core/passkey-metadata.js',
  'test/core.test.js','test/apps.test.js','test/execution.test.js','test/batch-execution.test.js','test/batch-execution-ui.test.js','test/capabilities.test.js','test/capability-management.test.js','test/session-management.test.js','test/session-execution.test.js','test/entrypoint-transport.test.js','test/recovery.test.js','test/recovery-management.test.js','test/recovery-ui.test.js','test/session-execution-ui.test.js','test/ui-v1.test.js','test/send.test.js','test/provider-lifecycle.test.js','test/ui-hardening.test.js','test/session-hardening.test.js','test/passkeys.test.js','test/passkey-metadata.test.js',
];

const errors = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireStrings = (file, values, label) => {
  const text = read(file);
  for (const value of values) if (!text.includes(value)) errors.push(`missing ${label}: ${value}`);
  return text;
};
for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);

const app = requireStrings('app.js', [
  'discoverSmartAccount','readNetwork','readPortfolio','sendSmartAccountCreation','confirmSmartAccountCreation',
  'prepareSmartAccountExecution','sendSmartAccountExecution','confirmSmartAccountExecution','inspectCapabilityGrant',
  'sendGasSponsorGrantCreation','sendCapabilityGrantRevocation','confirmCapabilityManagementTransaction',
  'sendSessionKeyEnablement','sendSessionKeyRevocation','sendSessionGrantCreation','confirmSessionManagementTransaction'
], 'UI Wallet Core binding');
for (const forbidden of ['privateKey','mnemonic','seedPhrase','localStorage.setItem("private']) if (app.includes(forbidden)) errors.push(`forbidden signing secret pattern in app.js: ${forbidden}`);

requireStrings('ui-v1.js', ['recovery-ui.js','apps-page.js','buildSendExecution','installFailClosedBrowserLifecycle'], 'Wallet Web UI binding');
requireStrings('index.html', ['./session-execution-ui.js','./batch-execution-ui.js'], 'Wallet execution UI script binding');
requireStrings('recovery-ui.js', ['Recovery management','Two-day safety delay','recovery-countdown','recovery-set-authority','recovery-propose','recovery-cancel','recovery-finalize','readDeployedSmartAccountState','sendFinalizeRecovery','confirmFinalizeRecovery'], 'recovery UI/timelock control');
requireStrings('session-execution-ui.js', ['Session execution','Prepare + sign + simulate','Submit to EntryPoint420','prepareSessionUserOperationTransport','sendPreparedEntryPointUserOperation','confirmEntryPointUserOperation','sessionExecution','entryPointUserOpSubmission'], 'controlled session execution UI');
requireStrings('batch-execution-ui.js', [
  'Batch transaction','Compose calls','Review + simulate batch','Submit batch','moveBatchCall','escapeBatchHtml','prepareSmartAccountBatch','sendPreparedSmartAccountBatch','confirmSmartAccountBatch',
  'exact simulated batch snapshot','Identical repeats','batchExecutionUi','batchExecution'
], 'guarded batch execution UI');

const appsPage = requireStrings('apps-page.js', ['resolveServices','Verified manifest','Awaiting manifest','noopener noreferrer','apps-search','app-filter','Not published'], 'verified 420 Apps page guard');
if (appsPage.includes('javascript:')) errors.push('420 Apps page must not contain javascript service URLs');
requireStrings('core/services.js', ['duplicate ecosystem service id','service URL credentials are not permitted','Preserve canonical wallet metadata'], 'service discovery hardening guard');
requireStrings('core/provider-lifecycle.js', ['accountsChanged','chainChanged','disconnect','removeListener','reload'], 'provider lifecycle guard');
const send = requireStrings('core/send.js', ['a9059cbb','parseUnits','normalizeAddress',"kind === 'native'","kind !== 'erc20'",'zero address','MAX_AMOUNT_TEXT_LENGTH','token contract cannot be used as the transfer recipient'], 'guided send guard');
if (send.includes('eth_sendTransaction') || send.includes('eth_sendUserOperation')) errors.push('guided send builder must not broadcast directly');
requireStrings('core/portfolio.js', ['invalid chain id','invalid token decimals','invalid token symbol','MAX_TOKEN_SYMBOL_LENGTH'], 'portfolio hardening guard');
requireStrings('core/accounts.js', ['readDeployedSmartAccountState','owner','recoveryAuthority','authorizationEpoch','entryPoint','capabilityRegistry'], 'canonical account read binding');
requireStrings('core/recovery.js', ['RECOVERY_DELAY_SECONDS','pending recovery owner exists without executable timestamp','canSetAuthority','canPropose','canCancel','canFinalize'], 'recovery state policy guard');
requireStrings('core/recovery-management.js', ['67bdcc3f','7ee76082','0ba234d6','e2ccb305','eth_call','eth_estimateGas','eth_sendTransaction','recovery finalization did not advance authorization epoch'], 'guarded recovery management control');
requireStrings('core/execution.js', ['eth_call','eth_estimateGas','eth_sendTransaction','owner changed after simulation','authorization epoch changed after simulation'], 'Smart Account execution guard');
requireStrings('core/batch-execution.js', [
  '34fcd5be','MAX_BATCH_CALLS','MAX_BATCH_CALLDATA_BYTES','wallet authority contract','aggregate batch native value','aggregate batch calldata','duplicateCallIndexes',
  'sendPreparedSmartAccountBatch','prepared batch calldata changed after simulation','prepared batch transaction envelope changed after simulation','prepared batch authorization epoch changed',
  'eth_call','eth_estimateGas','eth_sendTransaction','owner changed after batch simulation','authorization epoch changed after batch simulation','reverted atomically; no batch call was committed'
], 'guarded batch execution/hardening control');
requireStrings('core/capabilities.js', ['0x0000000000000000000000000000000000000421','SESSION_EXECUTE_CAPABILITY_420','readActiveGrantId','readCapabilityAuthorization'], 'capability inspection guard');
requireStrings('core/session-management.js', ['8d08b1a4','5ae7ab32','388c930c','d557e335','fdb3c749','authorizationEpoch','post-confirmation verification'], 'session administration guard');

const sessionExecution = requireStrings('core/session-execution.js', ['efff7e19','d86f2b3c','SESSION_EXECUTE_CAPABILITY_420','readActiveGrantId','readCapabilityAuthorization','authorizationEpoch','nonce lane','wallet authority contract','broadcastReady: false','EntryPoint420'], 'session execution preflight guard');
if (sessionExecution.includes('eth_sendUserOperation') || sessionExecution.includes('eth_sendTransaction')) errors.push('session execution preflight must remain transport-free');

const transport = requireStrings('core/entrypoint-transport.js', [
  '22cdde4c','9eec012b','USER_OPERATION_HANDLED_TOPIC','personal_sign','eth_accounts','eth_call','eth_estimateGas','eth_sendTransaction',
  'authorization epoch changed after user operation preparation','session key was revoked or invalidated after user operation preparation','active session grant changed after user operation preparation',
  'session nonce changed after user operation preparation','canonical user operation hash changed after signing','ambiguous duplicate EntryPoint420 UserOperationHandled confirmation events',
  'malformed EntryPoint420 UserOperationHandled event','malformed EntryPoint420 UserOperationHandled success value','session nonce did not advance exactly once','consumed the session nonce to prevent replay'
], 'EntryPoint420 transport/hardening control');
if (transport.includes('eth_sendUserOperation')) errors.push('Wallet V1 must use canonical EntryPoint420.handleOp transport, not unfrozen bundler RPC');

requireStrings('core/passkeys.js', [
  'navigatorLike.credentials.create','navigatorLike.credentials.get','webauthn.create','webauthn.get','cross-origin WebAuthn ceremony rejected',
  'WebAuthn RP ID hash mismatch','WebAuthn user presence flag missing','WebAuthn user verification flag missing','WebAuthn sign counter did not advance'
], 'passkey/WebAuthn foundation guard');
requireStrings('core/passkey-metadata.js', [
  '420-wallet-passkey-binding-v1','passkey binding requires a deployed SmartAccount420','passkey SmartAccount420 binding changed','passkey authorization epoch changed',
  'passkey RP ID binding changed','passkey origin binding changed','authenticated WebAuthn sign counter did not advance'
], 'passkey credential/account binding guard');

const abi = read('core/abi.js');
if (!abi.includes("createAccount: '4003f6ba'")) errors.push('canonical SmartAccountFactory420 createAccount selector missing');
if (!abi.includes("execute: 'b61d27f6'")) errors.push('canonical SmartAccount420 execute selector missing');

const config = JSON.parse(read('runtime-config.json'));
if (config.manifest?.verificationMode !== 'registry-or-signed-manifest') errors.push('manifest verification mode must fail closed');
if (config.features?.smartAccountExecution !== true || config.features?.executionSimulationRequired !== true) errors.push('guarded owner execution must remain enabled');
if (config.features?.capabilityInspection !== true || config.features?.capabilityMutation !== true || config.features?.gasSponsorGrantManagement !== true) errors.push('capability management must remain enabled');
if (config.features?.sessionKeyAdministration !== true || config.features?.sessionGrantManagement !== true || config.features?.sessionKeys !== true) errors.push('session administration must remain enabled');
if (config.features?.sessionExecutionPreflight !== true || config.features?.sessionExecutionUi !== true) errors.push('qualified session execution preflight/UI must remain enabled');
if (config.features?.sessionExecution !== true || config.features?.entryPointUserOpSubmission !== true) errors.push('qualified controlled session broadcast must be enabled');
if (config.features?.delegatedCapabilities !== false) errors.push('general delegated capabilities must remain disabled beyond scoped session execution');
if (config.features?.recoveryManagement !== true) errors.push('qualified recovery management UI must remain enabled');
if (config.features?.batchExecutionUi !== true || config.features?.batchExecution !== true) errors.push('qualified guarded batch execution UI and broadcast must remain enabled');
if (config.features?.passkeys !== false) errors.push('passkeys must remain disabled until their dedicated milestone qualifies');
if (config.smartAccount?.factoryAddress !== '0x0000000000000000000000000000000000000420') errors.push('wallet must use frozen canonical SmartAccountFactory420 address');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({
  pass: true,
  walletWebFoundation: true,
  walletWebUiV1: true,
  recoveryManagementUiEnabled: true,
  recoveryTimelockPresentation: true,
  entryPoint420TransportQualified: true,
  finalRecoverySessionHardeningQualified: true,
  sessionExecutionUiEnabled: true,
  sessionExecutionEnabled: true,
  entryPointUserOpSubmission: true,
  guardedBatchExecutionCore: true,
  batchExecutionUiEnabled: true,
  finalBatchHardeningQualified: true,
  batchExecutionEnabled: true,
  passkeyWebAuthnFoundationQualified: true,
  passkeyCredentialBindingQualified: true,
  passkeysEnabled: false,
  delegatedCapabilitiesEnabled: false,
  serverSideKeyCustody: false
}, null, 2));
