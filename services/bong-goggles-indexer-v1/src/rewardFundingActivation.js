import { preflightCampaignPlan } from './rewardCampaignPlans.js';

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

function nonNegativeInt(value,field){
  const n=Number(required(value,field));
  if(!Number.isSafeInteger(n)||n<0) throw new Error(`${field} must be a non-negative safe integer`);
  return n;
}

export function buildCampaignActivationWorkflow({
  plan,
  campaignId,
  canonicalCampaign,
  poolState,
}={}){
  preflightCampaignPlan(plan);
  const id=String(required(campaignId,'campaignId'));
  if(!canonicalCampaign||typeof canonicalCampaign!=='object') throw new Error('canonical campaign required');
  if(canonicalCampaign.exists!==true) throw new Error('canonical campaign does not exist');

  if(String(canonicalCampaign.appIdSymbol??canonicalCampaign.appId)!==plan.appIdSymbol) throw new Error('canonical campaign app mismatch');
  if(String(canonicalCampaign.contributionType)!==plan.contributionType) throw new Error('canonical campaign contribution mismatch');
  if(String(canonicalCampaign.scorer).toLowerCase()!==String(plan.scorer).toLowerCase()) throw new Error('canonical campaign scorer mismatch');

  const canonicalPolicy=canonicalCampaign.policy==null?null:String(canonicalCampaign.policy).toLowerCase();
  const planPolicy=plan.policy==null?null:String(plan.policy).toLowerCase();
  if(canonicalPolicy!==planPolicy) throw new Error('canonical campaign policy mismatch');
  if(Number(canonicalCampaign.maxRewardPerContribution)!==plan.maxRewardPerContribution) throw new Error('canonical campaign contribution cap mismatch');
  if(Number(canonicalCampaign.maxRewardPerAccount)!==plan.maxRewardPerAccount) throw new Error('canonical campaign account cap mismatch');
  if(Number(canonicalCampaign.totalBudget)!==plan.totalBudget) throw new Error('canonical campaign budget mismatch');
  if(Number(canonicalCampaign.startsAt)!==plan.startsAt||Number(canonicalCampaign.endsAt)!==plan.endsAt) throw new Error('canonical campaign window mismatch');

  if(!poolState||typeof poolState!=='object') throw new Error('pool state required');
  const funded=nonNegativeInt(poolState.funded,'poolState.funded');
  const reserved=nonNegativeInt(poolState.reserved,'poolState.reserved');
  if(reserved>funded) throw new Error('pool reserved exceeds funded');
  const available=funded-reserved;
  const fullyFunded=funded>=plan.totalBudget;
  const activationReady=fullyFunded && available>=plan.maxRewardPerContribution;

  return freeze({
    campaignId:id,
    contributionType:plan.contributionType,
    funded,
    reserved,
    available,
    configuredBudget:plan.totalBudget,
    fullyFunded,
    activationReady,
    currentActive:canonicalCampaign.active===true,
    nextAction:activationReady
      ? (canonicalCampaign.active===true?'NONE':'ACTIVATE')
      : (funded===0?'FUND':'TOP_UP'),
    sequence:Object.freeze([
      'CREATE_CAMPAIGN',
      'VALIDATE_CANONICAL_CAMPAIGN',
      'FUND_REWARD_POOL',
      'VERIFY_POOL_BALANCES',
      'ACTIVATE_CAMPAIGN',
    ]),
    applicationCustodiesFunds:false,
    authoritative:false,
  });
}

export function prepareCampaignFundingIntent({workflow,rewardPool,value}={}){
  if(!workflow||typeof workflow!=='object') throw new Error('activation workflow required');
  const amount=nonNegativeInt(value,'value');
  if(amount===0) throw new Error('funding value must be positive');
  return freeze({
    contract:String(required(rewardPool,'rewardPool')).toLowerCase(),
    method:'fund',
    args:Object.freeze([workflow.campaignId]),
    value:amount,
    requiresWalletConfirmation:true,
    applicationCustodiesFunds:false,
    canonicalWrite:true,
    authoritative:false,
  });
}

export function prepareCampaignActivationIntent({workflow,campaignRegistry,active}={}){
  if(!workflow||typeof workflow!=='object') throw new Error('activation workflow required');
  const desired=active===true;
  if(desired && workflow.activationReady!==true) throw new Error('campaign is not funding-ready for activation');

  return freeze({
    contract:String(required(campaignRegistry,'campaignRegistry')).toLowerCase(),
    method:'setActive',
    args:Object.freeze([workflow.campaignId,desired]),
    requiresWalletConfirmation:true,
    canonicalWrite:true,
    deactivationPreservesPriorRewards:!desired,
    applicationCustodiesFunds:false,
    authoritative:false,
  });
}
