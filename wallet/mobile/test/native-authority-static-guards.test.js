import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(here, '..');
const nativeRoots = [
  path.join(mobileRoot, 'android', 'app', 'src', 'main', 'java'),
  path.join(mobileRoot, 'ios', 'Wallet420'),
];

function sourceFiles(root) {
  const out = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const full = path.join(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (entry.isFile() && /\.(kt|swift)$/.test(entry.name)) out.push(full);
  }
  return out;
}

const sources = nativeRoots.flatMap(sourceFiles);

function relative(file) {
  return path.relative(mobileRoot, file).replaceAll(path.sep, '/');
}

test('native production sources contain no embedded private-key material', () => {
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/, relative(file));
    assert.doesNotMatch(text, /\b(?:exportPrivateKey|getPrivateKey|privateKeyData)\b/, relative(file));
  }
});

test('native production sources contain no remote signing fallback', () => {
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\b(?:remoteSignerUrl|remoteSigningUrl|signingServiceUrl)\b/i, relative(file));
  }
});

test('native production sources contain no insecure HTTP RPC endpoints', () => {
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /["']http:\/\//, relative(file));
  }
});

test('native production sources do not transport legacy signing methods', () => {
  for (const file of sources) {
    const text = fs.readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /["']personal_sign["']/, relative(file));
    assert.doesNotMatch(text, /["']eth_sendTransaction["']/, relative(file));
  }
});
