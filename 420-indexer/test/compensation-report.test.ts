import assert from 'node:assert/strict';
import test from 'node:test';
import { compensationReport420 } from '../src/compensation-report.js';

const h = (n: number) => '0x' + n.toString(16).padStart(64, '0');
const a = (n: number) => '0x' + n.toString(16).padStart(40, '0');
const [vault, splitter, administrator, andrew, janet, token] = [1,2,3,4,5,6].map(a) as [string,string,string,string,string,string];
const binding = { chainId: '420', vault, splitter, founders: [administrator, andrew, janet] as [string,string,string] };
const event = (event_name: string, contract_address: string, block_timestamp: string, tx: number, fields: Record<string,string>) =>
  ({ event_name, contract_address, block_timestamp, tx_hash: h(tx), block_hash: h(tx), fields });
const forward = (time: string, tx: number, asset: string, amount: string, eligible: string) =>
  event('DevelopmentCompensationForwarded', vault, time, tx, {
    contributionId: h(tx), sourceApplicationId: h(1), source: a(9), policyRef: h(2),
    asset, beneficiary: splitter, compensationAmount: amount, grossProtocolRevenue: eligible
  });
const native = (time: string, tx: number, amount: string) =>
  event('FounderCompensationDeposited', splitter, time, tx, { sourceVault: vault, amount });

test('period credits preserve opening dust and claims cannot create revenue or cross assets', async () => {
  const amount = '9007199254740993';
  const rows = [native('1', 1, '1'), forward('1', 1, a(0), '1', '10'),
    native('2', 2, '2'), forward('2', 2, a(0), '2', '20'),
    event('FounderTokenCompensationCredited', splitter, '2', 3, { sourceVault: vault, token, amount, contributionId: h(3) }),
    forward('2', 3, token, amount, amount + '0'),
    event('FounderCompensationClaimed', splitter, '2', 4, { beneficiary: administrator, asset: a(0), amount: '1' })];
  const report = await compensationReport420({query: async () => ({rows})}, 420n, binding, 2n, 3n);
  assert.deepEqual(report.contributions.map(row => [row.asset,row.eligibleRevenue,row.compensation]),
    [[a(0),'20','2'],[token,amount+'0',amount]]);
  assert.deepEqual(report.contributions[0]?.founderCredits.map(row => row.credited), ['2','0','0']);
  assert.equal(report.entitlements.find(row => row.asset === a(0) && row.founder === administrator)?.outstanding, '1');
  assert.equal(report.entitlements.find(row => row.asset === token && row.founder === administrator)?.claimed, '0');
});

test('rejects unpaired credits, duplicate contribution IDs and unfunded claims', async () => {
  const receipt = native('1', 1, '4');
  const funding = forward('1', 1, a(0), '4', '40');
  for (const rows of [[receipt], [funding], [receipt,funding,receipt,funding],
    [event('FounderCompensationClaimed', splitter, '1', 2, { beneficiary: andrew, asset: token, amount: '1' })]]) {
    await assert.rejects(compensationReport420({query: async () => ({rows})}, 420n, binding, 0n, 3n));
  }
});
