import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRewardOperatorCampaignSurface, buildRewardOperatorLookupSurface, prepareRewardOperatorAction } from '../src/rewardOperatorSurface.js';

const plan={
  appIdSymbol:'APP_ID_BONG_GOGGLES',
  contributionType:'POST',
  scorer:'0x1111111111111111111111111111111111111111',
  policy:null,
  maxRewardPerContribution:10,
  maxRewardPerAccount:100,
  totalBudget:1000,
  startsAt:100,
  endsAt:200,
};

const campaign={
  exists:true,
  appIdSymbol:'APP_ID_BONG_GOGGLES',
  contributionType:'POST',
  scorer:'0x1111111111111111111111111111111111111111',
  policy:null,
  maxRewardPerContribution:10,
  maxRewardPerAccount:100,
  totalBudget:1000,
  startsAt:100,
  endsAt:200,
  active:true,
};

test('BG-18.10 operator campaign surface exposes campaign, pool, accounting, readiness and Explorer state',()=>{
  const surface=buildRewardOperatorCampaignSurface({
    plan,
    campaignId:'camp-1',
    canonicalCampaign:campaign,
    poolState:{funded:1000,reserved:125},
    accruedByCampaign:500,
    earnedByAccount:{'0xABC':75},
    now:150,
    explorerBaseUrl:'https://explorer.420integrated.org/',
  });
  assert.equal(surface.pool.available,875);
  assert.equal(surface.accruedByCampaign,500);
  assert.equal(surface.earnedByAccount['0xabc'],75);
  assert.deepEqual(surface.readiness.warnings,[]);
  assert.equal(surface.links.campaign,'https://explorer.420integrated.org/rewards/campaigns/camp-1');
  assert.equal(surface.applicationCustodiesFunds,false);
  assert.equal(surface.storesPrivateWalletMaterial,false);
  assert.equal(surface.authoritative,false);
});

test('BG-18.10 operator surface warns on underfunded disabled not-started and expired campaigns',()=>{
  const underfunded=buildRewardOperatorCampaignSurface({
    plan,
    campaignId:'camp-2',
    canonicalCampaign:{...campaign,active:false},
    poolState:{funded:100,reserved:0},
    now:50,
    explorerBaseUrl:'https://explorer.420integrated.org',
  });
  assert.equal(underfunded.readiness.warnings.includes('UNDERFUNDED'),true);
  assert.equal(underfunded.readiness.warnings.includes('DISABLED'),true);
  assert.equal(underfunded.readiness.warnings.includes('NOT_STARTED'),true);

  const expired=buildRewardOperatorCampaignSurface({
    plan,
    campaignId:'camp-3',
    canonicalCampaign:campaign,
    poolState:{funded:1000,reserved:0},
    now:201,
    explorerBaseUrl:'https://explorer.420integrated.org',
  });
  assert.equal(expired.readiness.warnings.includes('EXPIRED'),true);
});

test('BG-18.10 canonical lookup surface links contribution and reward IDs and rejects mismatches',()=>{
  const contribution={contributionId:'c1',beneficiary:'0xBEN',contributionType:'POST',status:'ACCRUED'};
  const reward={rewardId:'r1',campaignId:'camp-1',contributionId:'c1',beneficiary:'0xBEN',amount:10,status:'RESERVED'};
  const lookup=buildRewardOperatorLookupSurface({contribution,reward,explorerBaseUrl:'https://explorer.420integrated.org'});
  assert.equal(lookup.contribution.explorerLink,'https://explorer.420integrated.org/rewards/contributions/c1');
  assert.equal(lookup.reward.explorerLink,'https://explorer.420integrated.org/rewards/r1');
  assert.throws(()=>buildRewardOperatorLookupSurface({
    contribution,
    reward:{...reward,contributionId:'other'},
    explorerBaseUrl:'https://explorer.420integrated.org',
  }),/lookup mismatch/);
});

test('BG-18.10 sponsor actions remain Wallet-bound canonical intents with no service custody',()=>{
  const workflow={
    campaignId:'camp-1',
    activationReady:true,
    applicationCustodiesFunds:false,
  };
  const fund=prepareRewardOperatorAction({
    action:'FUND',
    workflow,
    rewardPool:'0x2222222222222222222222222222222222222222',
    value:100,
  });
  assert.equal(fund.method,'fund');
  assert.equal(fund.requiresWalletConfirmation,true);
  assert.equal(fund.applicationCustodiesFunds,false);

  const activate=prepareRewardOperatorAction({
    action:'ACTIVATE',
    workflow,
    campaignRegistry:'0x3333333333333333333333333333333333333333',
  });
  assert.equal(activate.method,'setActive');
  assert.deepEqual(activate.args,['camp-1',true]);
  assert.equal(activate.requiresWalletConfirmation,true);

  const deactivate=prepareRewardOperatorAction({
    action:'DEACTIVATE',
    workflow,
    campaignRegistry:'0x3333333333333333333333333333333333333333',
  });
  assert.equal(deactivate.deactivationPreservesPriorRewards,true);
});
