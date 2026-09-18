import { buildCampaignActivationWorkflow, prepareCampaignFundingIntent, prepareCampaignActivationIntent } from './rewardFundingActivation.js';

function freeze(value){
  if(Array.isArray(value)) return Object.freeze(value.map(freeze));
  if(value && typeof value==='object'){
    const out={};
    for(const [key,item] of Object.entries(value)) out[key]=freeze(item);
    return Object.freeze(out);
  }
  return value;
}

function required(value,field){
  if(value===undefined||value===null||value==='') throw new Error(`${field} is required`);
  return value;
}

function safeInt(value,field){
  const n=Number(required(value,field));
  if(!Number.isSafeInteger(n)||n<0) throw new Error(`${field} must be a non-negative safe integer`);
  return n;
}

function normalizeAddress(value,field){
  return String(required(value,field)).toLowerCase();
}

export function buildRewardOperatorCampaignSurface({
  plan,
  campaignId,
  canonicalCampaign,
  poolState,
  accruedByCampaign=0,
  earnedByAccount={},
  now,
  explorerBaseUrl,
}={}){
  const workflow=buildCampaignActivationWorkflow({plan,campaignId,canonicalCampaign,poolState});
  const timestamp=safeInt(now,'now');
  const accrued=safeInt(accruedByCampaign,'accruedByCampaign');

  const warnings=[];
  if(workflow.fullyFunded!==true) warnings.push('UNDERFUNDED');
  if(canonicalCampaign.active!==true) warnings.push('DISABLED');
  if(timestamp<Number(canonicalCampaign.startsAt)) warnings.push('NOT_STARTED');
  if(timestamp>Number(canonicalCampaign.endsAt)) warnings.push('EXPIRED');
  if(workflow.reserved>workflow.funded) warnings.push('POOL_INVARIANT');
  if(accrued>Number(canonicalCampaign.totalBudget)) warnings.push('ACCRUED_EXCEEDS_BUDGET');

  const normalizedEarned={};
  for(const [account,amount] of Object.entries(earnedByAccount??{})){
    normalizedEarned[normalizeAddress(account,'earnedByAccount account')]=safeInt(amount,'earnedByAccount amount');
  }

  const explorerBase=String(required(explorerBaseUrl,'explorerBaseUrl')).replace(/\/$/,'');
  return freeze({
    campaignId:String(campaignId),
    appId:canonicalCampaign.appIdSymbol??canonicalCampaign.appId,
    contributionType:canonicalCampaign.contributionType,
    scorer:canonicalCampaign.scorer,
    policy:canonicalCampaign.policy??null,
    caps:{
      maxRewardPerContribution:Number(canonicalCampaign.maxRewardPerContribution),
      maxRewardPerAccount:Number(canonicalCampaign.maxRewardPerAccount),
      totalBudget:Number(canonicalCampaign.totalBudget),
    },
    window:{
      startsAt:Number(canonicalCampaign.startsAt),
      endsAt:Number(canonicalCampaign.endsAt),
      active:canonicalCampaign.active===true,
    },
    pool:{
      funded:workflow.funded,
      reserved:workflow.reserved,
      available:workflow.available,
    },
    accruedByCampaign:accrued,
    earnedByAccount:normalizedEarned,
    readiness:{
      fullyFunded:workflow.fullyFunded,
      activationReady:workflow.activationReady,
      warnings,
    },
    links:{
      campaign:`${explorerBase}/rewards/campaigns/${campaignId}`,
    },
    applicationCustodiesFunds:false,
    storesPrivateWalletMaterial:false,
    authoritative:false,
  });
}

export function buildRewardOperatorLookupSurface({
  contribution=null,
  reward=null,
  explorerBaseUrl,
}={}){
  if(contribution===null && reward===null) throw new Error('contribution or reward lookup required');
  const base=String(required(explorerBaseUrl,'explorerBaseUrl')).replace(/\/$/,'');
  if(contribution && reward && String(reward.contributionId)!==String(contribution.contributionId)){
    throw new Error('reward contribution lookup mismatch');
  }
  return freeze({
    contribution:contribution?{
      contributionId:String(required(contribution.contributionId,'contribution.contributionId')),
      beneficiary:String(required(contribution.beneficiary,'contribution.beneficiary')),
      contributionType:String(required(contribution.contributionType,'contribution.contributionType')),
      status:String(required(contribution.status,'contribution.status')),
      explorerLink:`${base}/rewards/contributions/${contribution.contributionId}`,
    }:null,
    reward:reward?{
      rewardId:String(required(reward.rewardId,'reward.rewardId')),
      campaignId:String(required(reward.campaignId,'reward.campaignId')),
      contributionId:String(required(reward.contributionId,'reward.contributionId')),
      beneficiary:String(required(reward.beneficiary,'reward.beneficiary')),
      amount:safeInt(reward.amount,'reward.amount'),
      status:String(required(reward.status,'reward.status')),
      explorerLink:`${base}/rewards/${reward.rewardId}`,
    }:null,
    authoritative:false,
  });
}

export function prepareRewardOperatorAction({
  action,
  workflow,
  rewardPool,
  campaignRegistry,
  value,
}={}){
  const normalized=String(required(action,'action')).toUpperCase();
  if(normalized==='FUND'||normalized==='TOP_UP'){
    return prepareCampaignFundingIntent({workflow,rewardPool,value});
  }
  if(normalized==='ACTIVATE'){
    return prepareCampaignActivationIntent({workflow,campaignRegistry,active:true});
  }
  if(normalized==='DEACTIVATE'){
    return prepareCampaignActivationIntent({workflow,campaignRegistry,active:false});
  }
  throw new Error(`unsupported reward operator action: ${normalized}`);
}
