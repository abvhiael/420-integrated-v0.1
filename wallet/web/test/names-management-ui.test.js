import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { namesMarkup, installNames420ManagementUi } from '../names-management-ui.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('420Names management UI exposes every canonical lifecycle workflow with accessible state', () => {
  const markup = namesMarkup();
  for (const required of [
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
    'Generate secure salt',
    'Reveal window',
  ]) {
    assert.equal(markup.includes(required), true, 'missing UI requirement: ' + required);
  }
  assert.equal(typeof installNames420ManagementUi, 'function');
});

test('Wallet shell publishes the Names management navigation and module', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(html.includes('data-scroll-target="#names-management-panel"'), true);
  assert.equal(html.includes('src="./names-management-ui.js"'), true);
});

test('management UI never embeds signing secrets or a hard-coded Names deployment', () => {
  const source = fs.readFileSync(path.join(root, 'names-management-ui.js'), 'utf8');
  for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', '0x0000000000000000000000000000000000000435']) {
    assert.equal(source.includes(forbidden), false, 'forbidden source pattern: ' + forbidden);
  }
  assert.equal(source.includes('config.deployment.namesAddress'), true);
  assert.equal(source.includes('qualified chain-specific deployment'), true);
  assert.equal(source.includes('.focus()'), true);
});
