import { createRewardLifecycleProjection, applyRewardLifecycleEvent } from './rewardLifecycleProjection.js';

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

export function buildRewardAccountingProjection({events=[],campaignBudgets={}}={}){
  if(!Array.isArray(events)) throw new Error('events must be an array');
  const lifecycle=createRewardLifecycleProjection();
  const seen=new Set();

  for(const event of events){
    const replayKey=String(required(event.replayKey,'event.replayKey'));
    if(seen.has(replayKey)) continue;
    seen.add(replayKey);
    applyRewardLifecycleEvent(lifecycle,event);
  }

  const byCampaign={};
  for(const reward of lifecycle.rewards.values()){
    const id=reward.campaignId;
    if(!byCampaign[id]) byCampaign[id]={accrued:0,paid:0,rewardCount:0,paidRewardCount:0};
    byCampaign[id].accrued+=safeInt(reward.amount,'reward.amount');
    byCampaign[id].rewardCount+=1;
    if(reward.released===true){
      byCampaign[id].paid+=safeInt(reward.amount,'reward.amount');
      byCampaign[id].paidRewardCount+=1;
    }
  }

  for(const [campaignId,budget] of Object.entries(campaignBudgets??{})){
    const totalBudget=safeInt(budget,'campaign budget');
    const row=byCampaign[campaignId]??{accrued:0,paid:0,rewardCount:0,paidRewardCount:0};
    if(row.accrued>totalBudget) throw new Error(`campaign ${campaignId} accrued exceeds canonical budget`);
    byCampaign[campaignId]={
      ...row,
      totalBudget,
      remainingBudget:totalBudget-row.accrued,
    };
  }

  const submittedContributions=lifecycle.contributions.size;
  const accruedRewards=lifecycle.rewards.size;
  const paidRewards=[...lifecycle.rewards.values()].filter((reward)=>reward.released===true).length;
  const accruedAmount=[...lifecycle.rewards.values()].reduce((sum,reward)=>sum+safeInt(reward.amount,'reward.amount'),0);
  const paidAmount=[...lifecycle.rewards.values()].filter((reward)=>reward.released===true).reduce((sum,reward)=>sum+safeInt(reward.amount,'reward.amount'),0);

  return freeze({
    submittedContributions,
    accruedRewards,
    paidRewards,
    accruedAmount,
    paidAmount,
    byCampaign,
    replayKeys:[...seen].sort(),
    authoritative:false,
  });
}

export function reconcileRewardAccounting({projection,canonical}={}){
  if(!projection||typeof projection!=='object') throw new Error('projection required');
  if(!canonical||typeof canonical!=='object') throw new Error('canonical accounting required');

  const mismatches=[];
  for(const field of ['submittedContributions','accruedRewards','paidRewards','accruedAmount','paidAmount']){
    if(safeInt(projection[field],`projection.${field}`)!==safeInt(canonical[field],`canonical.${field}`)){
      mismatches.push(field);
    }
  }

  const canonicalCampaigns=canonical.byCampaign??{};
  const projectionCampaigns=projection.byCampaign??{};
  const campaignIds=[...new Set([...Object.keys(canonicalCampaigns),...Object.keys(projectionCampaigns)])].sort();
  for(const campaignId of campaignIds){
    const a=projectionCampaigns[campaignId]??{};
    const b=canonicalCampaigns[campaignId]??{};
    for(const field of ['accrued','paid','remainingBudget']){
      if((a[field]??0)!==(b[field]??0)) mismatches.push(`campaign:${campaignId}:${field}`);
    }
  }

  if(mismatches.length) throw new Error(`reward accounting reconciliation mismatch: ${mismatches.join(',')}`);
  return freeze({reconciled:true,mismatches:[],authoritative:false});
}

export function exportSanitizedRewardAccounting(projection){
  if(!projection||typeof projection!=='object') throw new Error('projection required');
  return freeze({
    submittedContributions:projection.submittedContributions,
    accruedRewards:projection.accruedRewards,
    paidRewards:projection.paidRewards,
    accruedAmount:projection.accruedAmount,
    paidAmount:projection.paidAmount,
    byCampaign:projection.byCampaign,
    containsPrivateWalletData:false,
    containsSecrets:false,
    authoritative:false,
  });
}
