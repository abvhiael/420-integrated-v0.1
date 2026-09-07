import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const required = [
  'package.json',
  'core/runtime-adapter.js',
  'core/passkey-auth.js',
  'core/wallet-surfaces.js',
  'core/session-capabilities.js',
  'core/lifecycle-hardening.js',
  'test/runtime-adapter.test.js',
  'test/passkey-auth.test.js',
  'test/wallet-surfaces.test.js',
  'test/session-capabilities.test.js',
  'test/lifecycle-hardening.test.js',
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`missing mobile release file: ${file}`);
}

const sourceFiles = required.filter((file) => file.endsWith('.js') && !file.startsWith('test/'));
for (const file of sourceFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\beval\s*\(/.test(text) || /new\s+Function\s*\(/.test(text)) throw new Error(`dynamic code execution forbidden in ${file}`);
  if (/https?:\/\//i.test(text) && file !== 'core/runtime-adapter.js') throw new Error(`hard-coded remote URL forbidden in ${file}`);
  if (/localStorage|sessionStorage/.test(text)) throw new Error(`web storage forbidden in mobile runtime source: ${file}`);
}

const runtime = fs.readFileSync(path.join(root, 'core/runtime-adapter.js'), 'utf8');
if (!runtime.includes('secureStorage')) throw new Error('mobile release requires secure-storage boundary');
if (!runtime.includes("/^https:\\/\\//i")) throw new Error('external URL policy must remain HTTPS-only');

const lifecycle = fs.readFileSync(path.join(root, 'core/lifecycle-hardening.js'), 'utf8');
for (const requiredInvariant of ['chainChanged', 'accountsChanged', 'authorizationEpochChanged', 'invalidateSessions', 'invalidatePasskey']) {
  if (!lifecycle.includes(requiredInvariant)) throw new Error(`missing lifecycle invariant: ${requiredInvariant}`);
}

console.log('420 Wallet mobile release qualification passed');
