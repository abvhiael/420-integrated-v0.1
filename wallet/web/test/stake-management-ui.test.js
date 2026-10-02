import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { stakeMarkup, installStake420ManagementUi } from '../stake-management-ui.js';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

test('420Stake UI exposes canonical registration, lifecycle, reward, bond and withdrawal workflows accessibly', () => {
  const markup = stakeMarkup();
  for (const required of [
    'Validator staking',
    'stake-register',
    'stake-registration-quote',
    'stake-load',
    'stake-topup',
    'stake-replace',
    'stake-withdraw',
    'Activation readiness',
    'Reward accrued',
    'Withdrawal',
    'role="status"',
    'role="alert"',
    'aria-live="polite"',
    'aria-live="assertive"',
    'Simulate & register',
    'Wallet does not create validator signing keys',
  ]) {
    assert.equal(markup.includes(required), true, 'missing Stake UI requirement: ' + required);
  }
  assert.equal(typeof installStake420ManagementUi, 'function');
});

test('Wallet shell publishes Stake navigation and management module', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.equal(html.includes('data-scroll-target="#stake-management-panel"'), true);
  assert.equal(html.includes('src="./stake-management-ui.js"'), true);
});

test('Stake UI fails closed on unqualified runtime configuration and does not embed signing secrets', () => {
  const source = fs.readFileSync(path.join(root, 'stake-management-ui.js'), 'utf8');
  for (const forbidden of ['privateKey', 'mnemonic', 'seedPhrase', 'applyExitNotice.selector', 'eth_sign', 'personal_sign']) {
    assert.equal(source.includes(forbidden), false, 'forbidden Stake UI source pattern: ' + forbidden);
  }
  assert.equal(source.includes('qualified chain-specific canonical Stake deployment'), true);
  assert.equal(source.includes('config.deployment.stakeAddress'), true);
  assert.equal(source.includes('config.deployment.validatorRegistryAddress'), true);
  assert.equal(source.includes('config.deployment.rewardControllerAddress'), true);
  assert.equal(source.includes('.focus()'), true);
});

test('checked-in runtime config remains deliberately unbound until canonical deployment generation', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'runtime-config.json'), 'utf8'));
  assert.equal(config.deployment.stakeAddress, null);
  assert.equal(config.deployment.validatorRegistryAddress, null);
  assert.equal(config.deployment.rewardControllerAddress, null);
});
