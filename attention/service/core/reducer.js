import {assertPublicAttentionValue420} from './privacy.js';
const STATES=['NONE','DRAFT','ACTIVE','PAUSED','CLOSED','CANCELLED'];
const REWARD=['NONE','RESERVED','PAID'];
const identity=e=>`${e.chainId}:${e.blockNumber}:${e.transactionIndex}:${e.logIndex}`;
const position=e=>({chainId:String(e.chainId),blockNumber:String(e.blockNumber),blockHash:String(e.blockHash),transactionHash:String(e.transactionHash),transactionIndex:Number(e.transactionIndex),logIndex:Number(e.logIndex)});
const lower=v=>String(v||'').toLowerCase();
const decimal=(v,n)=>{const s=String(v??'');if(!/^\d+$/.test(s))throw new Error('invalid '+n);return s;};
const text=(v,n)=>{const s=String(v??'');if(!s)throw new Error('missing '+n);return s;};
function source(e){return position(e);}
export class AttentionProjection420{
  constructor(chainId){this.chainId=String(chainId);this.reset();}
  reset(){this.campaigns=new Map();this.consentGlobal=new Map();this.consentCampaign=new Map();this.proofs=new Map();this.rewards=new Map();this.events=[];this.latest=null;}
  rebuild(events){
    this.reset();const sorted=[...events].sort((a,b)=>BigInt(a.blockNumber)<BigInt(b.blockNumber)?-1:BigInt(a.blockNumber)>BigInt(b.blockNumber)?1:a.transactionIndex-b.transactionIndex||a.logIndex-b.logIndex);
    const seen=new Map();
    for(const e of sorted){if(String(e.chainId)!==this.chainId)throw new Error('Attention projection wrong chain');assertPublicAttentionValue420(e.fields);const id=identity(e);const prior=seen.get(id);const fingerprint=JSON.stringify([e.blockHash,e.transactionHash,e.contractAddress,e.eventName,e.fields]);if(prior&&prior!==fingerprint)throw new Error('conflicting canonical event identity');if(prior)continue;seen.set(id,fingerprint);this.apply(e);this.events.push(e);this.latest=source(e);}
    return this;
  }
  apply(e){
    const f=e.fields||{},ev=e.eventName;
    if(ev==='CampaignCreated'){
      const id=text(f.campaignId,'campaignId');this.campaigns.set(lower(id),{campaignId:id,sponsor:lower(f.sponsor),verifier:lower(f.verifier),metadataHash:text(f.metadataHash,'metadataHash'),audiencePolicyHash:text(f.audiencePolicyHash,'audiencePolicyHash'),declaredBudget:decimal(f.declaredBudget,'declaredBudget'),rewardPerUnit:decimal(f.rewardPerUnit,'rewardPerUnit'),maxRewardPerAccount:decimal(f.maxRewardPerAccount,'maxRewardPerAccount'),startsAt:Number(decimal(f.startsAt,'startsAt')),endsAt:Number(decimal(f.endsAt,'endsAt')),state:'DRAFT',funded:'0',reserved:'0',paid:'0',refunded:'0',closed:false,source:source(e)});
      return;
    }
    if(['CampaignActivated','CampaignPaused','CampaignClosed','CampaignCancelled'].includes(ev)){
      const c=this.campaigns.get(lower(f.campaignId));if(!c)throw new Error('campaign lifecycle precedes creation');c.state={CampaignActivated:'ACTIVE',CampaignPaused:'PAUSED',CampaignClosed:'CLOSED',CampaignCancelled:'CANCELLED'}[ev];if(ev==='CampaignClosed'||ev==='CampaignCancelled')c.closed=true;c.source=source(e);return;
    }
    if(ev==='CampaignFunded'){const c=this.campaigns.get(lower(f.campaignId));if(!c)throw new Error('funding precedes campaign');c.funded=(BigInt(c.funded)+BigInt(decimal(f.amount,'amount'))).toString();c.source=source(e);return;}
    if(ev==='RewardReserved'){const c=this.campaigns.get(lower(f.campaignId));if(!c)throw new Error('reserve precedes campaign');c.reserved=(BigInt(c.reserved)+BigInt(decimal(f.amount,'amount'))).toString();c.source=source(e);return;}
    if(ev==='RewardReleased'){const c=this.campaigns.get(lower(f.campaignId));if(!c)throw new Error('release precedes campaign');const a=BigInt(decimal(f.amount,'amount'));c.reserved=(BigInt(c.reserved)-a).toString();c.paid=(BigInt(c.paid)+a).toString();c.source=source(e);return;}
    if(ev==='CampaignRefunded'){const c=this.campaigns.get(lower(f.campaignId));if(!c)throw new Error('refund precedes campaign');c.refunded=(BigInt(c.refunded)+BigInt(decimal(f.amount,'amount'))).toString();c.source=source(e);return;}
    if(ev==='GlobalConsentSet'){this.consentGlobal.set(lower(f.account),{enabled:!!f.enabled,revision:decimal(f.revision,'revision'),policyHash:text(f.policyHash,'policyHash'),source:source(e)});return;}
    if(ev==='CampaignConsentSet'){this.consentCampaign.set(lower(f.account)+':'+lower(f.campaignId),{campaignId:text(f.campaignId,'campaignId'),enabled:!!f.enabled,revision:decimal(f.revision,'revision'),policyHash:text(f.policyHash,'policyHash'),source:source(e)});return;}
    if(ev==='AttentionProofCommitted'){const id=lower(f.proofId);if(this.proofs.has(id))throw new Error('proof replay in projection');this.proofs.set(id,{proofId:text(f.proofId,'proofId'),campaignId:text(f.campaignId,'campaignId'),account:lower(f.account),verifier:lower(f.verifier),observedAt:Number(decimal(f.observedAt,'observedAt')),attentionUnits:decimal(f.attentionUnits,'attentionUnits'),evidenceHash:text(f.evidenceHash,'evidenceHash'),source:source(e)});return;}
    if(ev==='RewardAccrued'){const id=lower(f.rewardId);if(this.rewards.has(id))throw new Error('reward replay in projection');this.rewards.set(id,{rewardId:text(f.rewardId,'rewardId'),campaignId:text(f.campaignId,'campaignId'),proofId:text(f.proofId,'proofId'),account:lower(f.account),amount:decimal(f.amount,'amount'),state:'RESERVED',source:source(e)});return;}
    if(ev==='RewardClaimed'){const r=this.rewards.get(lower(f.rewardId));if(!r)throw new Error('claim precedes reward');r.state='PAID';r.source=source(e);return;}
  }
  campaign(id){return this.campaigns.get(lower(id))??null;}
  proof(id){return this.proofs.get(lower(id))??null;}
  reward(id){return this.rewards.get(lower(id))??null;}
  account(address){
    const a=lower(address),global=this.consentGlobal.get(a)??{enabled:false,revision:'0',policyHash:null,source:this.latest};const campaigns=[...this.consentCampaign.entries()].filter(([k])=>k.startsWith(a+':')).map(([,v])=>v);const proofs=[...this.proofs.values()].filter(v=>v.account===a);const rewards=[...this.rewards.values()].filter(v=>v.account===a);
    return {address:a,consent:{global,campaigns,summary:global.enabled?'Global consent enabled':'Global consent disabled'},proofs,rewards};
  }
  listCampaigns(){return [...this.campaigns.values()].sort((a,b)=>BigInt(a.source.blockNumber)<BigInt(b.source.blockNumber)?1:BigInt(a.source.blockNumber)>BigInt(b.source.blockNumber)?-1:0);}
}
export {STATES,REWARD};
