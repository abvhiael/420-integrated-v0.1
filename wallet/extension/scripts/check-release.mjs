import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExtension420 } from './build.mjs';

const sourceRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { dist: root } = await buildExtension420();
const required = ['manifest.json', 'service-worker.js', 'content-script.js', 'inpage.js', 'popup.html', 'popup.js', 'authority.html', 'authority.js', 'core/extension-local-authority.js'];
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
assert.deepEqual(manifest.permissions, ['storage', 'tabs', 'windows']);
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
    const text = await readFile(full, 'utf8');
    for (const pattern of forbiddenPatterns) assert.equal(pattern.test(text), false, `${full} violates release code policy: ${pattern}`);
  }
}
await scan(root);

const serviceWorker = await readFile(join(root, 'service-worker.js'), 'utf8');
assert.match(serviceWorker, /origin !== senderOrigin/);
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

const authority = await readFile(join(root, 'authority.js'), 'utf8');
assert.match(authority, /createExtensionLocalAuthority420/);
assert.match(authority, /navigatorLike: navigator/);
assert.match(authority, /420-wallet-passkey-bindings-v1/);
assert.doesNotMatch(authority, /personal_sign|eth_signTypedData_v4/);

const localAuthority = await readFile(join(root, 'core/extension-local-authority.js'), 'utf8');
assert.match(localAuthority, /preparePasskeyUserOperationTransport/);
assert.match(localAuthority, /eth_sendUserOperation/);
assert.match(localAuthority, /eth_getUserOperationReceipt/);
assert.match(localAuthority, /RPC fallback is forbidden/);
assert.doesNotMatch(localAuthority, /provider\.request\(\s*['"]eth_sendTransaction['"]/);

const popup = await readFile(join(root, 'popup.html'), 'utf8');
const authorityHtml = await readFile(join(root, 'authority.html'), 'utf8');
for (const html of [popup, authorityHtml]) {
  assert.doesNotMatch(html, /<script[^>]+src=["']https?:/i);
  assert.doesNotMatch(html, /<iframe/i);
}

assert.equal(sourceRoot.endsWith('/wallet/extension') || sourceRoot.endsWith('\\wallet\\extension'), true);
console.log('420 Wallet extension release qualification: PASS');
