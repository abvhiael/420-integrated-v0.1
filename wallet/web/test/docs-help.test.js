import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveWalletHelp } from '../core/docs-help.js';

const bundle = {
  canonical_base_url: 'https://abvhiael.github.io/420-integrated-v0.1/',
  published_environments: ['development', 'genesis'],
  cross_environment_fallback: false,
  cross_release_fallback: false,
  records: { 'CTX-WALLET-005': 'users/wallet/signing-and-transaction-review.md' }
};

test('published environment resolves', () => {
  const result = resolveWalletHelp(bundle, 'CTX-WALLET-005', 'genesis');
  assert.equal(result.available, true);
  assert.equal(result.authority, 'documentation-navigation-only');
});

test('unpublished environments fail closed', () => {
  assert.equal(resolveWalletHelp(bundle, 'CTX-WALLET-005', 'testnet').available, false);
  assert.equal(resolveWalletHelp(bundle, 'CTX-WALLET-005', 'mainnet').available, false);
});

test('unknown id fails closed', () => {
  assert.equal(resolveWalletHelp(bundle, 'CTX-WALLET-999', 'genesis').available, false);
});
