import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const required = ['manifest.json', 'service-worker.js', 'content-script.js', 'inpage.js', 'popup.html', 'popup.js'];
const forbiddenPatterns = [
  /\beval\s*\(/,
  /\bnew\s+Function\s*\(/,
  /https?:\/\/[^'"`\s]+\.js\b/i,
  /document\.write\s*\(/,
];

for (const file of required) {
  const info = await stat(join(root, file));
  assert.equal(info.isFile(), true, `${file} must exist`);
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

const files = await readdir(root, { withFileTypes: true });
for (const entry of files) {
  if (!entry.isFile() || !/\.(?:js|mjs|html|json)$/.test(entry.name)) continue;
  const text = await readFile(join(root, entry.name), 'utf8');
  for (const pattern of forbiddenPatterns) {
    assert.equal(pattern.test(text), false, `${entry.name} violates release code policy: ${pattern}`);
  }
}

const serviceWorker = await readFile(join(root, 'service-worker.js'), 'utf8');
assert.match(serviceWorker, /origin !== senderOrigin/);
assert.match(serviceWorker, /frameId/);
assert.match(serviceWorker, /eth_requestAccounts/);
assert.match(serviceWorker, /eth_sendTransaction/);
assert.match(serviceWorker, /personal_sign/);
assert.match(serviceWorker, /eth_signTypedData_v4/);
assert.match(serviceWorker, /LOCAL_AUTHORITY_METHODS/);
assert.match(serviceWorker, /executeWithLocalAuthority/);
assert.match(serviceWorker, /sensitive wallet methods cannot use RPC signing or submission authority/);
assert.match(serviceWorker, /kind: 'authority-request'/);
assert.match(serviceWorker, /420-wallet-local-authority/);
assert.doesNotMatch(serviceWorker, /return rpcRequest\(request\.method, request\.params/);
assert.doesNotMatch(serviceWorker, /localStorage|sessionStorage/);

const popup = await readFile(join(root, 'popup.html'), 'utf8');
assert.doesNotMatch(popup, /<script[^>]+src=["']https?:/i);
assert.doesNotMatch(popup, /<iframe/i);

console.log('420 Wallet extension release qualification: PASS');
