import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRewardAccountingProjection, reconcileRewardAccounting, exportSanitizedRewardAccounting } from '../src/rewardAccountingReconciliation.js';

const events=[
  {replayKey:'1',name:'ContributionPublished',contributionId:'c1',appId:'bg',contributionType:'POST',publisher:'p',beneficiary:'alice',contentHash:'h1',nullifier:'n1'},
  {replayKey:'2',name:'RewardAccrued',rewardId:'r1',campaignId:'camp1',contributionId:'c1',beneficiary:'alice',amount:10},
  {replayKey:'3',name:'RewardReserved',rewardId:'r1',campaignId:'camp1',amount:10},
  // canonical contract order can release funds before RewardClaimed is emitted
  {replayKey:'4',name:'RewardReleased',rewardId:'r1',campaignId:'camp1',beneficiary:'alice',amount:10},
  {replayKey:'5',name:'RewardClaimed',rewardId:'r1',beneficiary:'alice',amount:10},
];

test('BG-18.11 accounting separates submitted accrued paid and remaining budget without double counting',()=>{
  const projection=buildRewardAccountingProjection({events,campaignBudgets:{camp1:100}});
  assert.equal(projection.submittedContributions,1);
  assert.equal(projection.accruedRewards,1);
  assert.equal(projection.paidRewards,1);
  assert.equal(projection.accruedAmount,10);
  assert.equal(projection.paidAmount,10);
  assert.equal(projection.byCampaign.camp1.remainingBudget,90);
});

test('BG-18.11 replay and restart rebuild identical accounting totals',()=>{
  const withReplay=[...events,events[1],events[3]];
  const a=buildRewardAccountingProjection({events:withReplay,campaignBudgets:{camp1:100}});
  const b=buildRewardAccountingProjection({events,campaignBudgets:{camp1:100}});
  assert.deepEqual(
    {submitted:a.submittedContributions,accrued:a.accruedAmount,paid:a.paidAmount,byCampaign:a.byCampaign},
    {submitted:b.submittedContributions,accrued:b.accruedAmount,paid:b.paidAmount,byCampaign:b.byCampaign}
  );
});

test('BG-18.11 real RewardReleased then RewardClaimed order preserves paid accounting',()=>{
  const projection=buildRewardAccountingProjection({events,campaignBudgets:{camp1:100}});
  assert.equal(projection.paidRewards,1);
  assert.equal(projection.paidAmount,10);
});

test('BG-18.11 reconciliation fails closed on canonical/local mismatch',()=>{
  const projection=buildRewardAccountingProjection({events,campaignBudgets:{camp1:100}});
  const canonical={
    submittedContributions:1,
    accruedRewards:1,
    paidRewards:1,
    accruedAmount:10,
    paidAmount:10,
    byCampaign:{camp1:{accrued:10,paid:10,remainingBudget:90}},
  };
  assert.deepEqual(reconcileRewardAccounting({projection,canonical}),{reconciled:true,mismatches:[],authoritative:false});
  assert.throws(()=>reconcileRewardAccounting({
    projection,
    canonical:{...canonical,paidAmount:9},
  }),/reconciliation mismatch/);
});

test('BG-18.11 sanitized export excludes private wallet material and secrets',()=>{
  const projection=buildRewardAccountingProjection({events,campaignBudgets:{camp1:100}});
  const out=exportSanitizedRewardAccounting(projection);
  assert.equal(out.containsPrivateWalletData,false);
  assert.equal(out.containsSecrets,false);
  assert.equal(Object.hasOwn(out,'replayKeys'),false);
  assert.equal(out.authoritative,false);
});
