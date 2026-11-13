import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension420 } from './build.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { dist: root } = await buildExtension420();
const required = ['manifest.json', 'service-worker.js', 'content-script.js', 'inpage.js', 'popup.html', 'popup.css', 'popup.js', 'wallet.html', 'wallet.css', 'wallet.js', 'core/vault.js', 'core/extension-portfolio.js', 'vendor/ethers-6.17.0.min.js', 'vendor/ETHERS-LICENSE.md', 'authority.html', 'authority.js', 'core/extension-local-authority.js', 'core/signing-policy.js'];
const forbiddenPatterns = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /https?:\/\/[^'"`\s]+\.js\b/i,
  /document\.write\s*\(/,
];

for (const file of required) {
  const info = await stat(join(root, file));
  assert.equal(info.isFile(), true, `${file} must exist in packaged extension`);
}

const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background?.type, 'module');
assert.equal(manifest.background?.service_worker, 'service-worker.js');
assert.deepEqual(manifest.permissions, ['storage', 'tabs', 'windows', 'alarms']);
assert.deepEqual(manifest.host_permissions, ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*']);
assert.equal(manifest.content_scripts?.[0]?.all_frames, false);
assert.equal(manifest.content_scripts?.[0]?.run_at, 'document_start');
assert.deepEqual(manifest.web_accessible_resources?.[0]?.resources, ['inpage.js']);
assert.equal(manifest.content_security_policy?.extension_pages, "script-src 'self'; object-src 'self'; base-uri 'none'; frame-ancestors 'none'");

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = join(directory, entry.name);
    if (entry.isDirectory()) {
      await scan(full);
      continue;
    }
    if (!/\.(?:js|mjs|html|json)$/.test(entry.name)) continue;
    if (full.endsWith('ethers-6.17.0.min.js')) continue; // Exact upstream blob is separately authenticated below.
    const text = await readFile(full, 'utf8');
    for (const pattern of forbiddenPatterns) assert.equal(pattern.test(text), false, `${full} violates release code policy: ${pattern}`);
  }
}
await scan(root);
const canonicalEthers = await readFile(join(root, 'vendor/ethers-6.17.0.min.js'));
const upstreamGitBlob = createHash('sha1').update('blob ' + canonicalEthers.length + '\0').update(canonicalEthers).digest('hex');
assert.equal(upstreamGitBlob, '8b1bb8fb32192a266cbe2cf27983c71a69ba7d4c', 'vendored ethers 6.17.0 blob must match pinned upstream release');


const serviceWorker = await readFile(join(root, 'service-worker.js'), 'utf8');
assert.match(serviceWorker, /origin !== senderOrigin/);
assert.match(serviceWorker, /trustedWalletPopup420/);
assert.match(serviceWorker, /extensionCanSend420/);
assert.match(serviceWorker, /walletUiState420/);
assert.match(serviceWorker, /effectiveChain420/);
assert.match(serviceWorker, /wallet_addEthereumChain/);
assert.match(serviceWorker, /wallet_switchEthereumChain/);
assert.match(serviceWorker, /wallet_watchAsset/);
assert.match(serviceWorker, /readAssetPortfolio420/);
assert.match(serviceWorker, /portfolioScope420/);
assert.match(serviceWorker, /verifiedPrice420/);
assert.match(serviceWorker, /monitorPortfolioBlocks420/);
assert.match(serviceWorker, /NETWORK_HEALTH_KEY_420/);
assert.match(serviceWorker, /frameId/);
assert.match(serviceWorker, /eth_requestAccounts/);
assert.match(serviceWorker, /LOCAL_AUTHORITY_METHODS/);
assert.match(serviceWorker, /AUTHORITY_TRANSPORT_METHODS/);
assert.match(serviceWorker, /eth_sendUserOperation/);
assert.match(serviceWorker, /eth_getUserOperationReceipt/);
assert.match(serviceWorker, /authority\.html\?request=/);
assert.match(serviceWorker, /sensitive wallet methods cannot use RPC signing or submission authority/);
assert.match(serviceWorker, /420-wallet-authority-ui/);
assert.doesNotMatch(serviceWorker, /return rpcRequest\(request\.method, request\.params/);
assert.doesNotMatch(serviceWorker, /localStorage|sessionStorage/);

const registry = await readFile(join(root, 'core/network-registry.js'), 'utf8');
assert.match(registry, /probeNetwork420/);
assert.match(registry, /smartAccountApproved:false/);
const portfolio = await readFile(join(root, 'core/extension-portfolio.js'), 'utf8');
assert.match(portfolio, /verifiedTokenMetadata420/);
assert.match(portfolio, /validatePrice420/);
assert.match(portfolio, /discoverTokens420/);
const router = await readFile(join(root, 'core/extension-rpc-router.js'), 'utf8');
assert.match(router, /signing-policy\.js/);
assert.match(router, /classifyProviderMethod420/);
assert.doesNotMatch(router, /const READ_METHODS = new Set/);
assert.doesNotMatch(router, /const APPROVAL_METHODS = new Set/);

const signingPolicy = await readFile(join(root, 'core/signing-policy.js'), 'utf8');
assert.match(signingPolicy, /eth_sendTransaction: 'owner-transaction'/);
assert.match(signingPolicy, /personal_sign: 'message-signature'/);
assert.match(signingPolicy, /eth_signTypedData_v4: 'typed-data-signature'/);
assert.match(signingPolicy, /return 'unsupported'/);

const securityCore=await readFile(join(root,'core/extension-security-centre.js'),'utf8');
const securityActions=await readFile(join(root,'core/extension-security-actions.js'),'utf8');
assert.match(securityCore,/readSecurityAllowance420/);
assert.match(securityCore,/discoverRecentSecurityAllowances420/);
assert.match(securityCore,/assessSecuritySignature420/);
assert.match(securityActions,/prepareCapabilityGrantRevocation/);
assert.match(securityActions,/prepareSessionKeyRevocation/);
assert.match(securityActions,/readSecurityPasskey420/);
assert.match(serviceWorker,/securityReview420/);
assert.match(serviceWorker,/securitySubmit420/);
assert.match(serviceWorker,/assertSecurityRevocationSnapshot420/);
assert.match(serviceWorker,/securityRecordSignature420/);
assert.match(serviceWorker,/trustedWalletPopup420/);
assert.doesNotMatch(serviceWorker,/eth_sendTransaction.*return rpcRequest/s);
const securityMarkup=await readFile(join(root,'popup.html'),'utf8');
for(const id of ['security-view','security-sites','security-signatures','security-allowances',
 'security-discovered','security-capabilities','security-sessions','security-passkeys',
 'security-recovery','security-alerts','security-revocation-review',
 'security-review-ack','security-submit-review']){
 assert.match(securityMarkup,new RegExp('id="'+id+'"'),id+' must be packaged');
}
assert.match(securityMarkup,/Disconnect removes only local browser/);
assert.match(securityMarkup,/does not change this allowance|does not discover every spender/);
const authority = await readFile(join(root, 'authority.js'), 'utf8');
assert.match(authority, /createExtensionLocalAuthority420/);
assert.match(authority, /navigatorLike: navigator/);
assert.match(authority, /420-wallet-passkey-bindings-v1/);
assert.match(authority, /signExtensionEoaMessage420/);
assert.match(authority, /personal_sign/);
assert.match(authority, /eth_signTypedData_v4/);
assert.match(authority, /pending\.context\.origin/);
assert.match(authority, /pending\.context\.chainId/);
assert.match(authority, /Encrypted local vault unavailable/);
assert.doesNotMatch(authority, /chrome\.runtime\.sendMessage\([^;]*?(?:privateKey|mnemonic|password)/s);
const localSigner=await readFile(join(root,'core/eoa-local-signer.js'),'utf8');
assert.match(localSigner, /decryptVault420/);
assert.match(localSigner, /verifyMessage/);
assert.match(localSigner, /verifyTypedData/);
assert.doesNotMatch(serviceWorker, /decryptVault420|signExtensionEoaMessage420/);
const inpage=await readFile(join(root,'inpage.js'),'utf8');
assert.match(inpage, /eip6963:announceProvider/);
assert.match(inpage, /eip6963:requestProvider/);
assert.match(inpage, /!window\.ethereum/);
const compatibility=await readFile(join(root,'core/extension-dapp-compatibility.js'),'utf8');
assert.match(compatibility,/normalizeDappAccountPermission420/);
assert.match(compatibility,/normalizeDappWalletCalls420/);
assert.match(serviceWorker,/wallet_getCapabilities/);
assert.match(serviceWorker,/wallet_sendCalls/);
assert.match(serviceWorker,/wallet_getCallsStatus/);
assert.match(serviceWorker,/wallet_revokePermissions/);

const localAuthority = await readFile(join(root, 'core/extension-local-authority.js'), 'utf8');
assert.match(localAuthority, /preparePasskeyUserOperationTransport/);
assert.match(localAuthority, /eth_sendUserOperation/);
assert.match(localAuthority, /eth_getUserOperationReceipt/);
assert.match(localAuthority, /RPC fallback is forbidden/);
assert.doesNotMatch(localAuthority, /provider\.request\(['"]eth_sendTransaction['"]/);

const popup = await readFile(join(root, 'popup.html'), 'utf8');
const authorityHtml = await readFile(join(root, 'authority.html'), 'utf8');
const walletHtml = await readFile(join(root, 'wallet.html'), 'utf8');
assert.match(walletHtml, /id="welcome"/);
assert.match(walletHtml, /id="confirm-phrase"/);
assert.match(walletHtml, /id="unlock"/);
assert.match(walletHtml, /id="accounts"/);
assert.match(popup, /id="dashboard"/);
assert.match(popup, /id="asset-list"/);
assert.match(popup, /id="sites-view"/);
assert.match(popup, /id="send-review"/);
assert.match(popup, /id="settings-view"/);
for (const html of [popup, authorityHtml, walletHtml]) {
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html, /<iframe/i);
}

assert.equal(sourceRoot.endsWith('/wallet/extension') || sourceRoot.endsWith('\\wallet\\extension'), true);
console.log('420 Wallet extension release qualification: PASS');
