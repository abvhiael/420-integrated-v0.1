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

export function createRewardLifecycleProjection(){
  return {
    contributions:new Map(),
    rewards:new Map(),
  };
}

export function applyRewardLifecycleEvent(state,event){
  if(!state||!(state.contributions instanceof Map)||!(state.rewards instanceof Map)) throw new Error('reward lifecycle state required');
  if(!event||typeof event!=='object') throw new Error('reward lifecycle event required');
  const name=String(required(event.name,'event.name'));

  if(name==='ContributionPublished'){
    const id=String(required(event.contributionId,'contributionId'));
    const existing=state.contributions.get(id);
    if(existing && JSON.stringify(existing)!==JSON.stringify(event)) throw new Error('conflicting contribution replay');
    state.contributions.set(id,freeze({
      contributionId:id,
      appId:String(required(event.appId,'appId')),
      contributionType:String(required(event.contributionType,'contributionType')),
      publisher:String(required(event.publisher,'publisher')),
      beneficiary:String(required(event.beneficiary,'beneficiary')),
      contentHash:String(required(event.contentHash,'contentHash')),
      nullifier:String(required(event.nullifier,'nullifier')),
      status:'SUBMITTED',
      accruedRewardIds:Object.freeze([]),
      authoritative:true,
    }));
    return rewardLifecycleView(state,{contributionId:id});
  }

  if(name==='RewardAccrued'){
    const rewardId=String(required(event.rewardId,'rewardId'));
    const contributionId=String(required(event.contributionId,'contributionId'));
    const contribution=state.contributions.get(contributionId);
    if(!contribution) throw new Error('reward accrual missing canonical contribution');
    if(String(event.beneficiary)!==contribution.beneficiary) throw new Error('reward beneficiary mismatch');

    const reward=freeze({
      rewardId,
      campaignId:String(required(event.campaignId,'campaignId')),
      contributionId,
      beneficiary:contribution.beneficiary,
      amount:Number(required(event.amount,'amount')),
      status:'ACCRUED',
      reserved:false,
      claimed:false,
      released:false,
      authoritative:true,
    });
    state.rewards.set(rewardId,reward);
    state.contributions.set(contributionId,freeze({
      ...contribution,
      status:'ACCRUED',
      accruedRewardIds:Object.freeze([...new Set([...(contribution.accruedRewardIds??[]),rewardId])]),
    }));
    return rewardLifecycleView(state,{rewardId});
  }

  if(name==='RewardReserved'){
    const rewardId=String(required(event.rewardId,'rewardId'));
    const reward=state.rewards.get(rewardId);
    if(!reward) throw new Error('reward reservation missing canonical accrual');
    if(String(required(event.campaignId,'campaignId'))!==reward.campaignId) throw new Error('reward reservation campaign mismatch');
    if(Number(required(event.amount,'amount'))!==reward.amount) throw new Error('reward reservation amount mismatch');
    state.rewards.set(rewardId,freeze({...reward,status:'RESERVED',reserved:true}));
    return rewardLifecycleView(state,{rewardId});
  }

  if(name==='RewardClaimed'){
    const rewardId=String(required(event.rewardId,'rewardId'));
    const reward=state.rewards.get(rewardId);
    if(!reward) throw new Error('reward claim missing canonical accrual');
    if(String(required(event.beneficiary,'beneficiary'))!==reward.beneficiary) throw new Error('reward claim beneficiary mismatch');
    if(Number(required(event.amount,'amount'))!==reward.amount) throw new Error('reward claim amount mismatch');
    state.rewards.set(rewardId,freeze({
      ...reward,
      status:reward.released===true?'PAID':'CLAIMED',
      claimed:true
    }));
    return rewardLifecycleView(state,{rewardId});
  }

  if(name==='RewardReleased'){
    const rewardId=String(required(event.rewardId,'rewardId'));
    const reward=state.rewards.get(rewardId);
    if(!reward) throw new Error('reward release missing canonical accrual');
    if(String(required(event.campaignId,'campaignId'))!==reward.campaignId) throw new Error('reward release campaign mismatch');
    if(String(required(event.beneficiary,'beneficiary'))!==reward.beneficiary) throw new Error('reward release beneficiary mismatch');
    if(Number(required(event.amount,'amount'))!==reward.amount) throw new Error('reward release amount mismatch');

    state.rewards.set(rewardId,freeze({...reward,status:'PAID',claimed:true,released:true}));
    const contribution=state.contributions.get(reward.contributionId);
    if(contribution) state.contributions.set(reward.contributionId,freeze({...contribution,status:'PAID'}));
    return rewardLifecycleView(state,{rewardId});
  }

  throw new Error(`unsupported reward lifecycle event: ${name}`);
}

export function rewardLifecycleView(state,{contributionId,rewardId}={}){
  const reward=rewardId ? state.rewards.get(String(rewardId)) ?? null : null;
  const contribution=contributionId
    ? state.contributions.get(String(contributionId)) ?? null
    : reward
      ? state.contributions.get(reward.contributionId) ?? null
      : null;

  return freeze({
    contribution,
    reward,
    contributionSubmitted:contribution!==null,
    rewardAccrued:reward!==null,
    rewardReserved:reward?.reserved===true,
    claimConfirmed:reward?.claimed===true,
    rewardPaid:reward?.released===true,
    localMayMarkPaid:reward?.released===true,
    authoritative:true,
  });
}

export function prepareRewardClaimIntent({reward,rewardDistributor,account}={}){
  if(!reward||typeof reward!=='object') throw new Error('canonical reward required');
  if(!['ACCRUED','RESERVED'].includes(String(reward.status))) throw new Error('reward is not claimable');
  const beneficiary=String(required(reward.beneficiary,'reward.beneficiary'));
  const claimant=String(required(account,'account'));
  if(claimant.toLowerCase()!==beneficiary.toLowerCase()) throw new Error('claim account must match canonical beneficiary');

  return freeze({
    contract:String(required(rewardDistributor,'rewardDistributor')).toLowerCase(),
    method:'claim',
    args:Object.freeze([String(required(reward.rewardId,'reward.rewardId')),beneficiary]),
    requiresWalletConfirmation:true,
    canonicalWrite:true,
    marksPaidLocally:false,
    beneficiary,
    authoritative:false,
  });
}
