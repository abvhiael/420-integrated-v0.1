import {Interface} from 'ethers';
const consent=new Interface(['function setGlobal(address account,bool enabled,bytes32 policyHash)','function setCampaign(address account,bytes32 campaignId,bool enabled,bytes32 policyHash)']);
const reward=new Interface(['function claim(bytes32 rewardId,address account)']);
const campaign=new Interface(['function createCampaign(bytes32 metadataHash,bytes32 audiencePolicyHash,address verifier,uint256 declaredBudget,uint256 rewardPerUnit,uint256 maxRewardPerAccount,uint64 startsAt,uint64 endsAt)','function activate(bytes32 campaignId)','function pause(bytes32 campaignId)','function close(bytes32 campaignId)','function cancel(bytes32 campaignId)']);
const treasury=new Interface(['function fundCampaign(bytes32 campaignId) payable']);
function target(config,key){const v=config.contracts?.[key];if(!v)throw new Error('canonical target unresolved: '+key);return v;}
function base(kind,to,data,value,source){return {schema:'420-attention-transaction-review-v1',canonical:true,authoritative:false,kind,summary:'Review '+kind.replaceAll('-',' '),source,transaction:{to,data,value}};}
export function prepareAttentionTransaction420(config,kind,payload,source){
  const account=payload.account;
  if(!/^0x[0-9a-fA-F]{40}$/.test(String(account||'')))throw new Error('valid account required');
  if(kind==='set-global-consent')return base(kind,target(config,'consentRegistry'),consent.encodeFunctionData('setGlobal',[account,!!payload.enabled,payload.policyHash]),'0x0',source);
  if(kind==='set-campaign-consent')return base(kind,target(config,'consentRegistry'),consent.encodeFunctionData('setCampaign',[account,payload.campaignId,!!payload.enabled,payload.policyHash]),'0x0',source);
  if(kind==='claim-reward')return base(kind,target(config,'rewardRegistry'),reward.encodeFunctionData('claim',[payload.rewardId,account]),'0x0',source);
  if(kind==='create-campaign')return base(kind,target(config,'campaignRegistry'),campaign.encodeFunctionData('createCampaign',[payload.metadataHash,payload.audiencePolicyHash,payload.verifier,payload.declaredBudget,payload.rewardPerUnit,payload.maxRewardPerAccount,payload.startsAt,payload.endsAt]),'0x0',source);
  if(kind==='fund-campaign'){const value='0x'+BigInt(String(payload.amount)).toString(16);if(value==='0x0')throw new Error('funding amount must be positive');return base(kind,target(config,'attentionTreasury'),treasury.encodeFunctionData('fundCampaign',[payload.campaignId]),value,source);}
  const methods={'activate-campaign':'activate','pause-campaign':'pause','close-campaign':'close','cancel-campaign':'cancel'};if(methods[kind])return base(kind,target(config,'campaignRegistry'),campaign.encodeFunctionData(methods[kind],[payload.campaignId]),'0x0',source);
  throw new Error('unsupported Attention transaction kind');
}
