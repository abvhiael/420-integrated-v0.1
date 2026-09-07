import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileAppShell420 } from '../core/app-shell.js';

test('app shell starts locked and fails closed until account and network are ready', () => {
  const shell = createMobileAppShell420();
  assert.equal(shell.getState().locked, true);
  assert.throws(() => shell.unlock(), /cannot unlock/);
  shell.setReadiness({ accountReady: true, networkReady: true });
  assert.equal(shell.unlock().locked, false);
});

test('navigation is constrained to qualified mobile views', () => {
  const shell = createMobileAppShell420({ view: 'home' });
  assert.equal(shell.navigate('connect').view, 'connect');
  assert.throws(() => shell.navigate('debug'), /unsupported mobile view/);
});

test('locking clears connection and pending approvals', () => {
  const shell = createMobileAppShell420({ accountReady: true, networkReady: true });
  shell.unlock();
  shell.setConnection('https://dapp.example');
  shell.setApprovalCount(2);
  const locked = shell.lock();
  assert.equal(locked.locked, true);
  assert.equal(locked.activeConnectionOrigin, null);
  assert.equal(locked.pendingApprovals, 0);
});
