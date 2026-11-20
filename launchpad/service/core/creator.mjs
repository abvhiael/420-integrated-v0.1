import {call,hash,address,readSale} from './consumer.mjs';
import {wordHex,wordAddress,wordUint,decodeAddress,decodeUint,decodeBool,strip0x,hexUtf8,encodeStatic} from './abi.mjs';

export const MODES=Object.freeze(['REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER']);
const ZERO='0x'+'0'.repeat(64),U128=(1n<<128n)-1n,ADDRESS_ZERO='0x'+'0'.repeat(40);
function invalid(message){throw Object.assign(new Error('invalid campaign submission: '+message),{statusCode:400});}
function string(value,name,max=500,{required=true}={}){
  if(typeof value!=='string'||value.length>max||/[\u0000-\u001f]/.test(value))invalid(name);
  const v=value.trim();if(required&&!v)invalid(name);return v;
}
function addr(value,name){try{const v=address(value);if(v===ADDRESS_ZERO)invalid(name);return v;}catch{invalid(name);}}
function bytes(value,name,{nonzero=true}={}){
  try{const v=hash(value);if(nonzero&&v===ZERO)invalid(name);return v;}catch{invalid(name);}
}
function integer(value,name,max,{min=0n}={}){
  if(typeof value!=='string'||!/^(0|[1-9][0-9]*)$/.test(value))invalid(name);
  const n=BigInt(value);if(n<min||n>max)invalid(name);return n.toString();
}
function time(value,name){const n=BigInt(integer(String(value),name,(1n<<64n)-1n,{min:1n}));if(n>BigInt(Number.MAX_SAFE_INTEGER))invalid(name);return Number(n);}
function textUrl(value){if(!value)return '';const s=string(value,'website URL',300);try{const u=new URL(s);if(u.protocol!=='https:'||u.username||u.password)invalid('website URL');return u.href;}catch{invalid('website URL');}}
function tiers(value,mode){
  if(!Array.isArray(value)||value.length>20)invalid('reward tiers');
  if(['REWARD','PRODUCT_PREORDER'].includes(mode)&&value.length===0)invalid('reward tiers required');
  if(mode==='DONATION'&&value.length)invalid('donation tiers not supported');
  const names=new Set();
  return value.map((t,i)=>{
    if(!t||typeof t!=='object')invalid('reward tier');
    const name=string(t.name,'tier name',80),price=integer(t.price,'tier minimum contribution',U128,{min:1n}),
      quantity=integer(t.quantity,'tier quantity',(1n<<32n)-1n,{min:1n});
    const detail=string(t.description||'','tier description',600,{required:false});
    if(names.has(name.toLowerCase()))invalid('duplicate tier');names.add(name.toLowerCase());
    return {name,description:detail,price,quantity};
  });
}
function preorder(value,mode,endsAt){
  if(mode!=='PRODUCT_PREORDER'){if(value&&Object.keys(value).length)invalid('preorder terms only permitted for product preorder');return null;}
  if(!value||typeof value!=='object'||Array.isArray(value))invalid('product preorder terms');
  const estimatedDeliveryAt=time(value.estimatedDeliveryAt,'preorder delivery date');
  if(estimatedDeliveryAt<=endsAt)invalid('delivery must follow sale end');
  return {productName:string(value.productName,'preorder product',120),
    terms:string(value.terms,'preorder fulfillment and cancellation terms',2500),
    shippingRegions:string(value.shippingRegions,'preorder shipping regions',300),
    estimatedDeliveryAt,refundPolicy:string(value.refundPolicy,'preorder refund policy',1200)};
}
export function normalizeCampaignDraft(input){
  if(!input||typeof input!=='object'||Array.isArray(input))invalid('request body');
  const mode=String(input.mode||'').toUpperCase();
  if(!MODES.includes(mode))invalid('unsupported crowdfunding mode');
  const controller=addr(input.controller,'controller');
  const paymentAsset=addr(input.paymentAsset,'ERC20 settlement asset');
  const saleAsset=addr(input.saleAsset,'project asset');
  const proceedsReceiver=addr(input.proceedsReceiver,'proceeds receiver');
  const title=string(input.title,'title',120),summary=string(input.summary,'summary',500);
  const description=string(input.description,'description',5000),website=textUrl(input.website);
  const softCap=integer(input.softCap,'soft cap',U128,{min:1n});
  const hardCap=integer(input.hardCap,'hard cap',U128,{min:1n});
  const perWalletCap=integer(input.perWalletCap,'per-wallet cap',U128,{min:1n});
  const tokenAllocation=integer(input.tokenAllocation,'token allocation',U128,{min:1n});
  if(BigInt(hardCap)<BigInt(softCap)||BigInt(perWalletCap)>BigInt(hardCap))invalid('cap ordering');
  const startsAt=time(input.startsAt,'start time'),endsAt=time(input.endsAt,'end time'),
    claimStartsAt=time(input.claimStartsAt,'claim start time');
  if(endsAt<=startsAt||claimStartsAt<endsAt)invalid('sale schedule');
  const eligibilityPolicyHash=bytes(input.eligibilityPolicyHash,'eligibility policy hash'),
    issuanceCommitment=bytes(input.issuanceCommitment,'project issuance commitment'),
    liquidityCommitment=bytes(input.liquidityCommitment||ZERO,'liquidity commitment',{nonzero:false});
  const rewardTiers=tiers(input.rewardTiers||[],mode);
  const productPreorder=preorder(input.productPreorder,mode,endsAt);
  const milestones=Array.isArray(input.milestones)?input.milestones:[];
  if(milestones.length>15)invalid('milestones');
  const projectMilestones=milestones.map(m=>string(m,'milestone',300));
  if(mode==='COMMUNITY_PROJECT'&&!projectMilestones.length)invalid('community project milestones required');
  const metadata={schema:'420-launchpad-creator-metadata-v1',title,summary,description,website,mode,
    controller,projectAsset:saleAsset,paymentAsset,proceedsReceiver,softCap,hardCap,perWalletCap,tokenAllocation,
    startsAt,endsAt,claimStartsAt,eligibilityPolicyHash,issuanceCommitment,liquidityCommitment,
    rewardTiers,productPreorder,milestones:projectMilestones};
  return metadata;
}
function word(data){const s=strip0x(data);if(!/^[a-fA-F0-9]{64}$/.test(s))throw new Error('invalid canonical identifier response');return '0x'+s.toLowerCase();}
async function canonicalId(rpc,to,signature,args){return word(await call(rpc,to,signature,args));}
export async function prepareCampaignRequest(rpc,rt,input){
  const draft=normalizeCampaignDraft(input),chainId=await rpc.call('eth_chainId',[]);
  if(chainId.toLowerCase()!==rt.chainId.toLowerCase())throw new Error('creator request chain mismatch');
  const metadataJson=JSON.stringify(draft),metadataHash=hash(await rpc.call('web3_sha3',[hexUtf8(metadataJson)]));
  const projectId=await canonicalId(rpc,rt.projectRegistryAddress,'canonicalId(address,address,bytes32,bytes32)',
    [wordAddress(draft.controller),wordAddress(draft.projectAsset),wordHex(metadataHash),wordHex(draft.issuanceCommitment)]);
  const terms=[wordHex(projectId),wordAddress(draft.paymentAsset),wordAddress(draft.proceedsReceiver),
    wordUint(draft.softCap),wordUint(draft.hardCap),wordUint(draft.perWalletCap),wordUint(draft.tokenAllocation),
    wordUint(draft.startsAt),wordUint(draft.endsAt),wordUint(draft.claimStartsAt),
    wordHex(draft.eligibilityPolicyHash),wordHex(draft.liquidityCommitment)];
  const saleId=await canonicalId(rpc,rt.saleRegistryAddress,
    'canonicalId(bytes32,address,address,uint128,uint128,uint128,uint128,uint64,uint64,uint64,bytes32,bytes32)',terms);
  // Requests are proposals for governed execution, not direct transaction authority.
  const registerSelector=await rpc.selector('registerProject(bytes32,address,address,bytes32,bytes32)');
  const createSelector=await rpc.selector('createSale(bytes32,bytes32,address,address,uint128,uint128,uint128,uint128,uint64,uint64,uint64,bytes32,bytes32)');
  const modeSelector=await rpc.selector('setCampaignMode(bytes32,uint8)');
  const calls=[
    {stage:'REGISTER_PROJECT',target:rt.projectRegistryAddress,value:'0x0',
      data:encodeStatic(registerSelector,[wordHex(projectId),wordAddress(draft.controller),wordAddress(draft.projectAsset),
        wordHex(metadataHash),wordHex(draft.issuanceCommitment)])},
    {stage:'CREATE_SALE',target:rt.saleRegistryAddress,value:'0x0',data:encodeStatic(createSelector,[wordHex(saleId),...terms])},
    {stage:'SET_CAMPAIGN_MODE',target:rt.crowdfundingIntegrationAddress,value:'0x0',
      data:encodeStatic(modeSelector,[wordHex(saleId),wordUint(MODES.indexOf(draft.mode)+1)])}
  ];
  const summary={schema:'420-launchpad-creator-request-v1',kind:'CREATE_CAMPAIGN',chainId:chainId.toLowerCase(),
    registry:rt.launchpadRouterAddress,projectRegistry:rt.projectRegistryAddress,
    saleRegistry:rt.saleRegistryAddress,crowdfundingIntegration:rt.crowdfundingIntegrationAddress,
    requester:draft.controller,projectId,saleId,metadataHash,issuanceCommitment:draft.issuanceCommitment,
    campaignMode:draft.mode,calls};
  const requestId=hash(await rpc.call('web3_sha3',[hexUtf8(JSON.stringify(summary))]));
  return {schema:'420-launchpad-creator-preparation-v1',canonical:true,requiresGovernance:true,
    status:'PREPARED_NOT_SUBMITTED',source:{chainId,requestId},requestId,projectId,saleId,metadataHash,
    metadataJson,metadata:draft,governanceRequest:summary,
    note:'Only authorized governance can execute these staged calls; the consumer Wallet cannot directly register, approve, or activate a campaign'};
}
export async function creatorLifecycle(rpc,rt,{account,saleId,action}){
  const requester=addr(account,'requester'),sale=await readSale(rpc,rt,bytes(saleId,'sale ID'));
  const p=await call(rpc,rt.projectRegistryAddress,'project(bytes32)',[wordHex(sale.projectId)]);
  if(decodeAddress(p,0).toLowerCase()!==requester)throw Object.assign(new Error('not the canonical project controller'),{statusCode:403});
  const state=sale.state;
  const actions={activate:state==='SCHEDULED',finalize:state==='ACTIVE',cancel:['SCHEDULED','ACTIVE'].includes(state)};
  if(!Object.hasOwn(actions,action)||!actions[action])invalid('governance action unavailable in canonical lifecycle state');
  const signature=action+'(bytes32)',selector=await rpc.selector(signature);
  const proposed={schema:'420-launchpad-creator-request-v1',kind:'LIFECYCLE',chainId:rt.chainId,
    registry:rt.launchpadRouterAddress,requester,projectId:sale.projectId,saleId:sale.saleId,action,
    canonicalState:state,calls:[{stage:action.toUpperCase(),target:rt.saleRegistryAddress,
      data:encodeStatic(selector,[wordHex(sale.saleId)]),value:'0x0'}]};
  const requestId=hash(await rpc.call('web3_sha3',[hexUtf8(JSON.stringify(proposed))]));
  return {schema:'420-launchpad-creator-preparation-v1',canonical:true,requiresGovernance:true,
    status:'PREPARED_NOT_SUBMITTED',source:{chainId:rt.chainId,requestId},requestId,
    projectId:sale.projectId,saleId:sale.saleId,governanceRequest:proposed,
    note:'Governance must separately authorize execution; this request never broadcasts privileged calldata'};
}
