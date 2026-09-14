import fs from 'node:fs';
import assert from 'node:assert/strict';
import { resolveGenesisDappHelp } from './index.js';

const bundle = JSON.parse(fs.readFileSync(new URL('./genesis-dapps.json', import.meta.url), 'utf8'));

const ok = resolveGenesisDappHelp(bundle, '420-swap', 'CTX-SWAP-002', 'genesis', 'current');
assert.equal(ok.available, true);
assert.equal(ok.authority, 'documentation-navigation-only');
assert.match(ok.url, /versions\/genesis\/current\/apps\/swap\/user-guide\/$/);

assert.equal(resolveGenesisDappHelp(bundle, '420-swap', 'CTX-SWAP-002', 'testnet', 'current').available, false);
assert.equal(resolveGenesisDappHelp(bundle, '420-faucet', 'CTX-FAUCET-001', 'testnet', 'current').available, false);
assert.equal(resolveGenesisDappHelp(bundle, '420-gaming', 'CTX-GAMING-001', 'genesis', 'current').available, false);
assert.equal(resolveGenesisDappHelp(bundle, '420-swap', 'CTX-SWAP-002', 'genesis', 'v1').available, false);

console.log('420 docs-context package PASS');
