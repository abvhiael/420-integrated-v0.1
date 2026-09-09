import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const manifest = JSON.parse(read('design/brand-assets.json'));
const master = read('design/app-icon-master.svg');
const wordmark = read('design/420-integrated-wordmark.svg');
const android = read('android/app/src/main/res/drawable/ic_wallet420_foreground.xml');

test('W13.5 uses canonical 420 Integrated blue and green interlocked branding', () => {
  assert.equal(manifest.palette.blue, '#273B9C');
  assert.equal(manifest.palette.green, '#45B84A');
  for (const source of [master, wordmark, android]) {
    assert.match(source, /#273B9C/);
    assert.match(source, /#45B84A/);
  }
  assert.match(wordmark, />420</);
  assert.match(wordmark, />INTEGRATED</);
});

test('W13.5 graphics remain presentation-only and secret-free', () => {
  assert.equal(manifest.authority, 'presentation-only');
  assert.equal(manifest.privacy.forbidRealWalletAddresses, true);
  assert.equal(manifest.privacy.forbidPrivateKeys, true);
  assert.equal(manifest.privacy.forbidTransactionHashes, true);
  const sources = [master, wordmark, read('design/illustration-empty-wallet.svg'), read('design/illustration-security.svg')].join('\n');
  assert.doesNotMatch(sources, /0x[a-fA-F0-9]{40}|[a-fA-F0-9]{64}|private\s*key|seed\s*phrase|mnemonic/i);
});
