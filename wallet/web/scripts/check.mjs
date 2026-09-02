import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const required = [
  'index.html',
  'app.js',
  'styles.css',
  'runtime-config.json',
  'core/config.js',
  'core/provider.js',
  'core/services.js',
  'test/core.test.js',
];

const errors = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing ${file}`);
}

const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'localStorage.setItem("private']) {
  if (app.includes(forbidden)) errors.push(`forbidden signing secret pattern in app.js: ${forbidden}`);
}

const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
if (config.manifest?.verificationMode !== 'registry-or-signed-manifest') errors.push('manifest verification mode must fail closed to registry-or-signed-manifest');
if (config.features?.smartAccountExecution !== false) errors.push('smartAccountExecution must remain disabled until execution implementation is qualified');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ pass: true, walletWebFoundation: true, serverSideKeyCustody: false, smartAccountExecutionEnabled: false }, null, 2));
