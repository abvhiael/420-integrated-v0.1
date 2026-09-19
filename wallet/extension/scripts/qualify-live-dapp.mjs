import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { qualifyWalletLiveTestnet420 } from '../../web/scripts/qualify-live-testnet.mjs';

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export class ExtensionLiveDappQualificationError420 extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExtensionLiveDappQualificationError420';
  }
}

function assert420(condition, message) {
  if (!condition) throw new ExtensionLiveDappQualificationError420(message);
}

function normalizeAddress420(value, label) {
  assert420(typeof value === 'string' && ADDRESS_RE.test(value), `${label} must be an EVM address`);
  return value.toLowerCase();
}

export function assertExtensionLiveDappInputs420({ runtimeConfig, extensionConfig }) {
  assert420(runtimeConfig?.schema === '420-wallet-runtime-config-v1', 'unsupported Wallet runtime schema');
  assert420(runtimeConfig?.deployment?.environment === 'testnet', 'W14.4 requires testnet Wallet runtime');
  assert420(extensionConfig?.schema === '420-wallet-extension-live-config-v1', 'unsupported extension live config schema');
  assert420(extensionConfig.environment === 'testnet', 'extension environment must be testnet');
  assert420(extensionConfig.rpcUrl === runtimeConfig.network?.rpcUrl, 'extension RPC URL does not match Wallet runtime');
  assert420(Array.isArray(extensionConfig.accounts) && extensionConfig.accounts.length > 0, 'extension requires at least one approved local account');
  for (const account of extensionConfig.accounts) normalizeAddress420(account, 'extension account');

  const smart = extensionConfig.smartAccountConfig;
  assert420(smart && typeof smart === 'object', 'extension SmartAccount configuration required');
  assert420(
    normalizeAddress420(smart.factoryAddress, 'extension factoryAddress')
      === normalizeAddress420(runtimeConfig.smartAccount?.factoryAddress, 'runtime factoryAddress'),
    'extension SmartAccount factory does not match Wallet runtime',
  );
  assert420(
    normalizeAddress420(smart.entryPointAddress, 'extension entryPointAddress')
      === normalizeAddress420(runtimeConfig.deployment?.entryPointAddress, 'runtime entryPointAddress'),
    'extension EntryPoint does not match Wallet runtime',
  );
  assert420(
    normalizeAddress420(smart.capabilityRegistryAddress, 'extension capabilityRegistryAddress')
      === normalizeAddress420(runtimeConfig.deployment?.capabilityRegistryAddress, 'runtime capabilityRegistryAddress'),
    'extension CapabilityRegistry does not match Wallet runtime',
  );
  return true;
}

export function qualifyExtensionPackageSurface420({ serviceWorker, inpage, contentScript, popup, authority }) {
  const requiredWorker = [
    'eth_requestAccounts',
    'eth_accounts',
    'eth_sendTransaction',
    'personal_sign',
    'eth_signTypedData_v4',
    'accountsFor(origin)',
    'setAccounts(origin, selected)',
    'origin !== senderOrigin',
    'frameId',
    'LOCAL_AUTHORITY_METHODS',
    'sensitive wallet methods cannot use RPC signing or submission authority',
    'eth_sendUserOperation',
    'eth_getUserOperationReceipt',
    'accountsChanged',
  ];
  for (const marker of requiredWorker) assert420(serviceWorker.includes(marker), `extension service worker missing qualification marker: ${marker}`);

  for (const marker of ['is420Wallet: true', 'eip6963:announceProvider', 'accountsChanged', 'chainChanged']) {
    assert420(inpage.includes(marker), `inpage provider missing qualification marker: ${marker}`);
  }
  for (const marker of ['event.source !== window', 'event.origin !== origin', 'chrome.runtime.sendMessage']) {
    assert420(contentScript.includes(marker), `content bridge missing qualification marker: ${marker}`);
  }
  for (const marker of ['Review this request carefully before approving.', 'approve', 'reject']) {
    assert420(popup.includes(marker), `approval UI missing qualification marker: ${marker}`);
  }
  for (const marker of ['createExtensionLocalAuthority420', 'navigatorLike: navigator', '420-wallet-passkey-bindings-v1']) {
    assert420(authority.includes(marker), `authority UI missing qualification marker: ${marker}`);
  }
  return true;
}

export async function qualifyExtensionLiveDapp420({
  manifest,
  inventory,
  runtimeConfig,
  extensionConfig,
  packageSources,
  fetchImpl = globalThis.fetch,
  minimumBlockNumber = 1n,
}) {
  assertExtensionLiveDappInputs420({ runtimeConfig, extensionConfig });
  qualifyExtensionPackageSurface420(packageSources);

  const walletQualification = await qualifyWalletLiveTestnet420({
    manifest,
    inventory,
    runtimeConfig,
    fetchImpl,
    minimumBlockNumber,
  });

  const chainIdResponse = await fetchImpl(extensionConfig.rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 4204, method: 'eth_chainId', params: [] }),
  });
  assert420(chainIdResponse?.ok === true, 'extension RPC chain check failed');
  const chainPayload = await chainIdResponse.json();
  assert420(chainPayload?.result === runtimeConfig.network.chainId, 'extension RPC chain differs from Wallet runtime chain');

  return {
    schema: '420-wallet-extension-live-dapp-qualification-v1',
    phase: 'W14.4',
    pass: true,
    environment: 'testnet',
    rpcUrl: extensionConfig.rpcUrl,
    chainId: chainPayload.result,
    accountCount: extensionConfig.accounts.length,
    providerInjectionQualified: true,
    originApprovalQualified: true,
    accountExposureQualified: true,
    signingReviewQualified: true,
    localAuthorityQualified: true,
    transactionSubmissionQualified: true,
    smartAccountAuthorityConsistent: true,
    walletLiveTestnetEvidence: walletQualification,
  };
}

async function readJson420(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); }
  catch (error) { throw new ExtensionLiveDappQualificationError420(`cannot read valid JSON from ${file}: ${error.message}`); }
}

async function readText420(file) {
  try { return await fs.readFile(file, 'utf8'); }
  catch (error) { throw new ExtensionLiveDappQualificationError420(`cannot read ${file}: ${error.message}`); }
}

function parseArgs420(argv) {
  const args = {
    manifest: null,
    inventory: 'wallet/deployment-inventory.json',
    runtime: 'wallet/web/runtime-config.generated.json',
    extensionConfig: 'wallet/extension/live-testnet-config.json',
    output: null,
    minimumBlockNumber: '1',
  };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    assert420(key.startsWith('--'), `unexpected argument: ${key}`);
    const name = key.slice(2);
    assert420(Object.hasOwn(args, name), `unsupported argument: --${name}`);
    const value = argv[++i];
    assert420(value && !value.startsWith('--'), `missing value for --${name}`);
    args[name] = value;
  }
  assert420(args.manifest, '--manifest is required');
  assert420(/^\d+$/.test(args.minimumBlockNumber), '--minimumBlockNumber must be a non-negative integer');
  return args;
}

export async function runExtensionLiveDappQualification420(args) {
  const extensionRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const [manifest, inventory, runtimeConfig, extensionConfig, serviceWorker, inpage, contentScript, popup, authority] = await Promise.all([
    readJson420(args.manifest),
    readJson420(args.inventory),
    readJson420(args.runtime),
    readJson420(args.extensionConfig),
    readText420(path.join(extensionRoot, 'service-worker.js')),
    readText420(path.join(extensionRoot, 'inpage.js')),
    readText420(path.join(extensionRoot, 'content-script.js')),
    readText420(path.join(extensionRoot, 'popup.js')),
    readText420(path.join(extensionRoot, 'authority.js')),
  ]);

  const result = await qualifyExtensionLiveDapp420({
    manifest,
    inventory,
    runtimeConfig,
    extensionConfig,
    packageSources: { serviceWorker, inpage, contentScript, popup, authority },
    minimumBlockNumber: BigInt(args.minimumBlockNumber),
  });

  if (args.output) {
    const output = path.resolve(args.output);
    await fs.mkdir(path.dirname(output), { recursive: true });
    await fs.writeFile(output, JSON.stringify(result, null, 2) + '\n');
  }
  return result;
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : null;
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const args = parseArgs420(process.argv.slice(2));
    const result = await runExtensionLiveDappQualification420(args);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } catch (error) {
    process.stderr.write(JSON.stringify({ schema: '420-wallet-extension-live-dapp-qualification-v1', phase: 'W14.4', pass: false, error: error.message }, null, 2) + '\n');
    process.exit(1);
  }
}
