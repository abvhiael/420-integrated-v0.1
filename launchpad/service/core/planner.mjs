import {encodeStatic,wordHex,wordUint,wordAddress,decodeUint,decodeBool} from './abi.mjs';

function bytes32(v){const s=String(v||'').replace(/^0x/,'');if(!/^[0-9a-fA-F]{64}$/.test(s))throw new Error('bytes32 required');return s.toLowerCase();}
export async function participantState(rpc,runtime,saleId,account){
  const sale=bytes32(saleId),addr=wordAddress(account),target=runtime.allocationRegistryAddress;
  const contributedSel=await rpc.selector('contributed(bytes32,address)');
  const claimedSel=await rpc.selector('claimed(bytes32,address)');
  const refundedSel=await rpc.selector('refunded(bytes32,address)');
  const args=[sale,addr];
  return {
    contributed:decodeUint(await rpc.ethCall(target,encodeStatic(contributedSel,args))).toString(),
    claimed:decodeUint(await rpc.ethCall(target,encodeStatic(claimedSel,args))).toString(),
    refunded:decodeBool(await rpc.ethCall(target,encodeStatic(refundedSel,args)))
  };
}
export async function prepareParticipant(rpc,runtime,kind,payload){
  const sale=bytes32(payload.saleId),target=runtime.allocationRegistryAddress;
  if(kind==='contribute'){
    const amount=BigInt(payload.amount);if(amount<=0n||amount>(2n**128n-1n))throw new Error('invalid contribution amount');
    const payment=bytes32(payload.paymentId),sel=await rpc.selector('contribute(bytes32,uint128,bytes32)');
    return review(kind,target,encodeStatic(sel,[sale,wordUint(amount),payment]),'Record contribution against canonical settled 420Pay payment');
  }
  if(kind==='claim'){
    const delivery=bytes32(payload.deliveryCommitment),sel=await rpc.selector('claim(bytes32,bytes32)');
    return review(kind,target,encodeStatic(sel,[sale,delivery]),'Record successful-sale claim with delivery commitment');
  }
  if(kind==='refund'){
    const sel=await rpc.selector('prepareRefund(bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale]),'Prepare canonical refund batch after 420Pay refund settlement');
  }
  throw new Error('unsupported participant transaction kind');
}
function review(kind,to,data,summary){return {schema:'420-launchpad-transaction-review-v1',canonical:true,kind,summary,transaction:{to,data,value:'0x0'}};}
export function creatorRequest(payload,runtime){
  const allowed=new Set(['setCampaignMode','activate','finalize','cancel']);
  const action=String(payload.action||'');if(!allowed.has(action))throw new Error('unsupported creator request');
  if(!/^0x[0-9a-fA-F]{40}$/.test(payload.account||''))throw new Error('creator account required');
  return {
    schema:'420-launchpad-creator-request-v1',canonical:true,action,requester:payload.account,
    projectId:String(payload.projectId||''),saleId:String(payload.saleId||''),metadataHash:String(payload.metadataHash||''),mode:String(payload.mode||''),
    requiresGovernance:true,authorityTarget:action==='setCampaignMode'?runtime.crowdfundingIntegrationAddress:runtime.saleRegistryAddress,
    notice:'Launchpad project registration and sale lifecycle are governance-only. This request grants no direct mutation authority.'
  };
}
