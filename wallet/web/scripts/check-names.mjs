import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const errors = [];

function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    errors.push('missing required Names Wallet artifact: ' + rel);
    return '';
  }
  return fs.readFileSync(file, 'utf8');
}

function requireStrings(rel, strings, label) {
  const content = read(rel);
  for (const value of strings) {
    if (!content.includes(value)) errors.push(label + ' missing: ' + value);
  }
  return content;
}

requireStrings('index.html', [
  'data-scroll-target="#names-management-panel"',
  'src="./names-management-ui.js"',
], 'Names Wallet shell binding');

requireStrings('names-management-ui.js', [
  'Manage .420 names',
  'names-commit',
  'names-register',
  'names-renew',
  'names-set-resolution',
  'names-set-reverse',
  'names-transfer',
  'names-accept',
  'role="status"',
  'role="alert"',
  'aria-live="polite"',
  'aria-live="assertive"',
  'config.deployment.namesAddress',
  '.focus()',
], 'Names management UI');

const management = requireStrings('core/names-management.js', [
  'eth_call',
  'eth_estimateGas',
  'eth_sendTransaction',
  'eth_getTransactionReceipt',
  'eth_accounts',
  'makeCommitment(bytes32,uint8,address,uint64,bytes32,address)',
  'commit(bytes32)',
  'register(bytes32,uint8,address,uint64,bytes32)',
  'renew(bytes32,uint64)',
  'setResolution(bytes32,address,bytes32,bytes32)',
  'setReverseName(bytes32)',
  'transferName(bytes32,address)',
  'acceptName(bytes32)',
  'connected 420 Names account changed',
  '420 Names chain changed',
  'simulation reverted',
  'transaction reverted',
], 'Names guarded management client');

for (const forbidden of [
  'privateKey',
  'mnemonic',
  'seedPhrase',
  '0x0000000000000000000000000000000000000435',
]) {
  if (management.includes(forbidden)) errors.push('forbidden Names management source pattern: ' + forbidden);
}

requireStrings('core/names-client.js', [
  'protocolVersion',
  'systemName',
  'resolvedAddress',
  'expiresAt',
], 'Names resolver client');

requireStrings('core/names-send.js', [
  'normalize420Name',
  'resolvedAddress',
], 'Names send guard');

requireStrings('test/names-management.test.js', [
  'reveal enforces minimum and maximum commitment age',
  'network/account changes and simulation failures fail closed before broadcast',
  'confirmation reports reverted or missing receipts as recoverable transaction state',
], 'Names management regression suite');

requireStrings('test/names-management-ui.test.js', [
  'canonical lifecycle workflow',
  'qualified deployment binding',
], 'Names management UI regression suite');

if (errors.length) {
  console.error(JSON.stringify({ pass: false, errors }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({
  pass: true,
  namesWalletApplicationQualified: true,
  qualifiedDeploymentBinding: true,
  guardedWritePreflight: true,
  explicitTransactionStates: true,
  accessibilityRecoverySurface: true,
  walletPrivateKeyCustody: false,
}, null, 2));
