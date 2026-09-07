import fs from 'node:fs';
import path from 'node:path';
import { qualifyMobileDeviceManifest420 } from './core/device-qualification.js';

const root = process.cwd();
const required = [
  'package.json',
  'core/runtime-adapter.js',
  'core/passkey-auth.js',
  'core/wallet-surfaces.js',
  'core/session-capabilities.js',
  'core/lifecycle-hardening.js',
  'core/dapp-connection.js',
  'core/dapp-session.js',
  'core/dapp-callback.js',
  'core/app-shell.js',
  'core/native-screen-model.js',
  'core/platform-adapters.js',
  'core/device-qualification.js',
  'platform/ios.manifest.json',
  'platform/android.manifest.json',
  'test/runtime-adapter.test.js',
  'test/passkey-auth.test.js',
  'test/wallet-surfaces.test.js',
  'test/session-capabilities.test.js',
  'test/lifecycle-hardening.test.js',
  'test/dapp-connection.test.js',
  'test/dapp-session.test.js',
  'test/dapp-callback.test.js',
  'test/app-shell.test.js',
  'test/native-screen-model.test.js',
  'test/platform-adapters.test.js',
  'test/device-qualification.test.js',
];

for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) throw new Error(`missing mobile release file: ${file}`);
}

const sourceFiles = required.filter((file) => file.endsWith('.js') && !file.startsWith('test/'));
for (const file of sourceFiles) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  if (/\beval\s*\(/.test(text) || /new\s+Function\s*\(/.test(text)) throw new Error(`dynamic code execution forbidden in ${file}`);
  if (/https?:\/\//i.test(text) && file !== 'core/runtime-adapter.js' && file !== 'core/dapp-connection.js' && file !== 'core/dapp-callback.js' && file !== 'core/app-shell.js') {
    throw new Error(`hard-coded remote URL forbidden in ${file}`);
  }
  if (/localStorage|sessionStorage/.test(text)) throw new Error(`web storage forbidden in mobile runtime source: ${file}`);
}

const runtime = fs.readFileSync(path.join(root, 'core/runtime-adapter.js'), 'utf8');
if (!runtime.includes('secureStorage')) throw new Error('mobile release requires secure-storage boundary');
if (!runtime.includes("/^https:\\/\\//i")) throw new Error('external URL policy must remain HTTPS-only');

const lifecycle = fs.readFileSync(path.join(root, 'core/lifecycle-hardening.js'), 'utf8');
for (const requiredInvariant of ['chainChanged', 'accountsChanged', 'authorizationEpochChanged', 'invalidateSessions', 'invalidatePasskey']) {
  if (!lifecycle.includes(requiredInvariant)) throw new Error(`missing lifecycle invariant: ${requiredInvariant}`);
}

for (const platform of ['ios', 'android']) {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, `platform/${platform}.manifest.json`), 'utf8'));
  const result = qualifyMobileDeviceManifest420(manifest);
  if (!result.qualified) throw new Error(`${platform} mobile package did not qualify`);
}

console.log('420 Wallet mobile release qualification passed');
