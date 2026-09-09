import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileAppShell420, MOBILE_APP_VIEWS_420 } from '../core/app-shell.js';

test('app shell starts locked and fails closed until account and network are ready', () => {
  const shell = createMobileAppShell420();
  assert.equal(shell.getState().view, 'wallet');
  assert.equal(shell.getState().locked, true);
  assert.throws(() => shell.unlock(), /cannot unlock/);
  shell.setReadiness({ accountReady: true, networkReady: true });
  assert.equal(shell.unlock().locked, false);
});

test('navigation exposes W11.7 wallet, apps, activity and security surfaces', () => {
  const shell = createMobileAppShell420({ view: 'wallet' });
  for (const view of ['wallet', 'apps', 'activity', 'security']) assert.equal(shell.navigate(view).view, view);
  assert.equal(shell.navigate('connect').view, 'connect');
  assert.throws(() => shell.navigate('home'), /unsupported mobile view/);
  assert.throws(() => shell.navigate('debug'), /unsupported mobile view/);
  for (const view of ['wallet', 'apps', 'activity', 'security']) assert.equal(MOBILE_APP_VIEWS_420.includes(view), true);
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
