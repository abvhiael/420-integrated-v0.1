import test from 'node:test';
import assert from 'node:assert/strict';
import { composeMobileScreen420 } from '../core/native-screen-model.js';

test('locked screen only exposes unlock when ready', () => {
  const preparing = composeMobileScreen420({ locked: true, accountReady: false, networkReady: true, view: 'home' });
  assert.equal(preparing.actions.length, 0);
  const ready = composeMobileScreen420({ locked: true, accountReady: true, networkReady: true, view: 'home' });
  assert.equal(ready.actions[0].id, 'unlock');
});

test('home and approval screens compose expected state', () => {
  const home = composeMobileScreen420({ locked: false, view: 'home' }, { accountLabel: 'Primary', activityCount: 3 });
  assert.equal(home.subtitle, 'Primary');
  assert.equal(home.sections[1].count, 3);
  const approvals = composeMobileScreen420({ locked: false, view: 'approvals', pendingApprovals: 2 });
  assert.equal(approvals.sections[0].count, 2);
});
