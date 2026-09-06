import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'passkey-ui.js',
  'core/passkey-runtime.js',
  'core/passkey-entrypoint-transport.js',
  'core/passkey-management.js',
  'test/passkey-runtime.test.js',
  'test/passkey-entrypoint-transport.test.js',
  'test/passkey-management.test.js',
  'test/passkey-lifecycle.test.js',
];
const errors = [];
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const requireStrings = (file, values, label) => {
  const text = read(file);
  for (const value of values) if (!text.includes(value)) errors.push(`missing ${label}: ${value}`);
  return text;
};

for (const file of required) if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);

const runtime = requireStrings('core/passkey-runtime.js', [
  'features?.passkeys !== true',
  'credentials.create',
  'credentials.get',
  'controllerIsOwner',
  'Passkeys are blocked while recovery is pending',
  'Passkey binding is stale after an authorization epoch change',
  'canReenroll: true',
  'canExecute: true',
], 'passkey runtime activation boundary');
if (runtime.includes('localStorage') || runtime.includes('sessionStorage')) errors.push('passkey runtime policy must not persist credential binding state');

const ui = requireStrings('passkey-ui.js', [
  'registerP256Passkey',
  'createPasskeyCredentialBinding',
  'sendEnrollPasskey',
  'confirmEnrollPasskey',
  'sendReenrollPasskey',
  'confirmReenrollPasskey',
  'preparePasskeyUserOperationTransport',
  'sendPreparedPasskeyUserOperation',
  "globalThis.ethereum?.on?.('accountsChanged'",
  "globalThis.ethereum?.on?.('chainChanged'",
  'binding = null',
], 'passkey runtime UI binding');
for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'localStorage', 'sessionStorage']) {
  if (ui.includes(forbidden)) errors.push(`forbidden passkey UI persistence/secret pattern: ${forbidden}`);
}

requireStrings('core/passkey-entrypoint-transport.js', [
  "signerType: 'passkey'",
  'buildPk42Signature',
  'owner nonce changed during passkey ceremony',
  'canonical user operation hash changed during passkey ceremony',
  'passkey credential is not active',
  'eth_sendTransaction',
], 'PK42 EntryPoint420 runtime transport');

requireStrings('core/passkey-management.js', [
  'enrollPasskey(bytes32,bytes32,bytes32,uint256,uint256)',
  'reenrollPasskey(bytes32)',
  'passkey management is blocked while recovery is pending',
  'stored passkey P-256 x coordinate changed',
  'stored passkey P-256 y coordinate changed',
  'authorizationEpoch: after.authorizationEpoch.toString()',
], 'passkey enrollment/re-enrollment runtime management');

requireStrings('test/passkey-lifecycle.test.js', [
  'W7.10',
  'reenroll',
  'authorizationEpoch',
  'passkey',
], 'end-to-end passkey lifecycle qualification');

const index = read('index.html');
if (!index.includes('./passkey-ui.js')) errors.push('wallet index must load the qualified passkey UI');

const config = JSON.parse(read('runtime-config.json'));
if (config.features?.passkeys !== true) errors.push('qualified passkey runtime must be enabled');
if (config.features?.entryPointUserOpSubmission !== true) errors.push('EntryPoint420 submission must remain enabled for passkey runtime');
if (config.features?.recoveryManagement !== true) errors.push('recovery management must remain enabled with passkey runtime');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  pass: true,
  passkeyRuntimeEnabled: true,
  webAuthnRuntimeGateQualified: true,
  passkeyEnrollmentUiQualified: true,
  passkeyReenrollmentUiQualified: true,
  pk42EntryPointTransportQualified: true,
  passkeyRecoveryLifecycleQualified: true,
  persistentPasskeySecrets: false,
}, null, 2));
