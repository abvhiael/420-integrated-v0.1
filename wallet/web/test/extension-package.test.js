import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(here, '../../extension');
const read = (file) => fs.readFileSync(path.join(extensionRoot, file), 'utf8');

test('W8 extension package contains a valid MV3 runtime surface', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 3);
  assert.equal(manifest.background.service_worker, 'service-worker.js');
  assert.equal(manifest.background.type, 'module');
  assert.equal(manifest.action.default_popup, 'popup.html');
  assert.deepEqual(manifest.content_scripts[0].js, ['content-script.js']);
  assert.equal(manifest.content_scripts[0].all_frames, false);
  assert.ok(manifest.web_accessible_resources[0].resources.includes('inpage.js'));
  assert.ok(manifest.permissions.includes('storage'));
  assert.ok(manifest.permissions.includes('tabs'));
  assert.ok(manifest.permissions.includes('windows'));
  assert.ok(!manifest.permissions.includes('<all_urls>'));
});

test('packaged provider path preserves isolation and exact channel boundaries', () => {
  const inpage = read('inpage.js');
  const content = read('content-script.js');
  const worker = read('service-worker.js');
  for (const source of [inpage, content, worker]) {
    assert.match(source, /420-wallet-provider-v1/);
    assert.doesNotMatch(source, /\beval\s*\(/);
    assert.doesNotMatch(source, /new Function\s*\(/);
  }
  assert.match(content, /event\.source !== window/);
  assert.match(content, /event\.origin !== origin/);
  assert.match(worker, /origin !== senderOrigin/);
  assert.match(worker, /frameId.*0/);
  assert.match(worker, /unsupported provider method/);
});

test('approval popup is one-time and removes the pending request before returning a decision', () => {
  const worker = read('service-worker.js');
  const popup = read('popup.js');
  const html = read('popup.html');
  assert.match(worker, /420-wallet-pending-approvals-v1/);
  assert.match(worker, /chrome\.windows\.create/);
  assert.match(worker, /approval-result/);
  assert.match(worker, /120000/);
  assert.match(popup, /delete next\[approvalId\]/);
  assert.match(popup, /User rejected|approved/);
  assert.match(popup, /chrome\.runtime\.sendMessage/);
  assert.match(html, /id="approve"/);
  assert.match(html, /id="reject"/);
});

test('packaged extension never grants account visibility without origin-scoped permission state', () => {
  const worker = read('service-worker.js');
  assert.match(worker, /accountsFor\(origin\)/);
  assert.match(worker, /eth_accounts/);
  assert.match(worker, /eth_requestAccounts/);
  assert.match(worker, /setAccounts\(origin, selected\)/);
  assert.match(worker, /origin is not connected to 420 Wallet/);
});

test('sensitive extension methods execute through local authority and signed UserOperation transport only', () => {
  const worker = read('service-worker.js');
  const authority = read('authority.js');
  assert.match(worker, /LOCAL_AUTHORITY_METHODS/);
  assert.match(worker, /eth_sendTransaction/);
  assert.match(worker, /personal_sign/);
  assert.match(worker, /eth_signTypedData_v4/);
  assert.match(worker, /sensitive wallet methods cannot use RPC signing or submission authority/);
  assert.match(worker, /authority\.html\?request=/);
  assert.match(worker, /AUTHORITY_TRANSPORT_METHODS/);
  assert.match(worker, /eth_sendUserOperation/);
  assert.match(worker, /eth_getUserOperationReceipt/);
  assert.match(worker, /420-wallet-authority-ui/);
  assert.match(worker, /420-wallet-local-authority/);
  assert.doesNotMatch(worker, /return rpcRequest\(request\.method, request\.params/);
  assert.match(authority, /createExtensionLocalAuthority420/);
  assert.match(authority, /navigatorLike: navigator/);
  assert.match(authority, /420-wallet-passkey-bindings-v1/);
});
