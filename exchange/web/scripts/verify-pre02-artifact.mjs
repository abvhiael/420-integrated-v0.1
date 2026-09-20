import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => readFileSync(path.join(root, 'dist', file), 'utf8');
const html = read('index.html');
const fallbackHtml = read('404.html');
const app = read('app.js');
const walletUi = read('browser-wallet-ui.js');
const readOnlySwap = read('read-only-swap-review-ui.js');
const manifest = JSON.parse(read('deployment-manifest.json'));
const metadata = JSON.parse(read('build-meta.json'));

const walletEntrypoint = '<script type="module" src="./browser-wallet-ui.js"></script>';
const legacyEntrypoint = '<script type="module" src="./app.js"></script>';
for (const page of [html, fallbackHtml]) {
  assert.equal(page.split(walletEntrypoint).length - 1, 1, 'exactly one V15 wallet entry point required');
  assert.equal(page.split(legacyEntrypoint).length - 1, 1, 'exactly one V14 display entry point required');
  assert.ok(page.indexOf(walletEntrypoint) < page.indexOf(legacyEntrypoint), 'V15 wallet must mount before V14 display app');
}
for (const file of ['index.html', '404.html', 'app.js', 'browser-wallet-ui.js', 'read-only-swap-review-ui.js']) {
  assert.ok(manifest.files.includes(file), `deployment artifact missing ${file}`);
}
assert.equal(metadata.sourceSha, process.env.GITHUB_SHA || process.env.EXCHANGE_BUILD_SHA || 'local', 'artifact source revision mismatch');
assert.match(walletUi, /mountWalletUI/, 'V15 wallet mounting missing');
assert.match(readOnlySwap, /read.only|readOnly|Read.only/i, 'read-only swap review missing');
for (const forbidden of [
  /\bnew\s+WalletController\s*\(/,
  /\bnew\s+WalletSession\s*\(/,
  /\bstate\.wallet(?:Controller|Session)\b/,
  /\bconnectOrSwitchWallet\b/,
  /\bglobalThis\.ethereum\b/,
  /\beth_requestAccounts\b/,
  /\bwallet_switchEthereumChain\b/,
  /\breviewSigningRequest\b/,
  /\bbuildSigningRequest\b/,
  /\bsigningGate\b/,
  /\beth_sendTransaction\b/,
  /\beth_signTypedData_v4\b/,
]) assert.doesNotMatch(app, forbidden, 'V14 must not own a wallet or signing path in deployment artifact');
for (const marker of [
  "const submit=fragment.querySelector('#swap-submit');submit.disabled=true",
  "const submit=fragment.querySelector('#bridge-submit');submit.disabled=true",
  'cancel.disabled=true',
  'sign.disabled=true',
  "target.closest('#connect,#swap-submit,#order-sign,#bridge-submit,[data-cancel-order]')",
]) assert.ok(app.includes(marker), `V14 execution lock missing: ${marker}`);
console.log('PRE-02 deployment artifact verified: V15 wallet owner, V14 read-only controls, exact source revision. No live browser/device qualification asserted.');
