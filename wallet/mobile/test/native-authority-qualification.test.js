import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const android = fs.readFileSync(path.join(root, 'android/app/src/main/java/io/fourtwenty/wallet/AndroidAuthorityPolicy420.kt'), 'utf8');
const ios = fs.readFileSync(path.join(root, 'ios/Wallet420/AuthorityPolicy420.swift'), 'utf8');

for (const [platform, source] of [['android', android], ['ios', ios]]) {
  test(`${platform} native authority fixture preserves canonical wallet boundary`, () => {
    assert.match(source, /SmartAccount420/);
    assert.match(source, /CapabilityRegistry420/);
    assert.match(source, /read_transport_only/);
    assert.match(source, /nativeClientIsCanonicalAuthority\s*=\s*false/);
    assert.match(source, /remoteSignerAllowed\s*=\s*false/);
    assert.match(source, /exportablePrivateKeyAllowed\s*=\s*false/);
    assert.match(source, /eth_sendUserOperation/);
    assert.doesNotMatch(source, /nativeClientIsCanonicalAuthority\s*=\s*true/);
    assert.doesNotMatch(source, /remoteSignerAllowed\s*=\s*true/);
    assert.doesNotMatch(source, /exportablePrivateKeyAllowed\s*=\s*true/);
  });
}

test('Android and iOS fixtures expose the same RPC authority vocabulary', () => {
  const required = [
    'eth_chainId',
    'eth_call',
    'eth_estimateGas',
    'eth_getBalance',
    'eth_getCode',
    'eth_getTransactionCount',
    'eth_getBlockByNumber',
    'eth_getLogs',
    'eth_sendUserOperation',
    'eth_getUserOperationReceipt',
    'eth_estimateUserOperationGas',
  ];
  for (const method of required) {
    assert.match(android, new RegExp(method));
    assert.match(ios, new RegExp(method));
  }
});
