import {encodeStatic,wordHex,wordUint,wordAddress,decodeUint,decodeBool,decodeAddress,hexUtf8} from './abi.mjs';
import {readSale,call,address} from './consumer.mjs';

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
    if(payload.refundCommitment){
      const commitment=bytes32(payload.refundCommitment),sel=await rpc.selector('recordRefund(bytes32,bytes32)');
      return review(kind,runtime.allocationRegistryAddress,encodeStatic(sel,[sale,commitment]),'Record Launchpad refund after canonical refund batch preparation');
    }
    const sel=await rpc.selector('prepareRefund(bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale]),'Prepare canonical refund batch after 420Pay refund settlement');
  }
  if(kind==='bind-identity'){
    const profile=bytes32(payload.profileId),sel=await rpc.selector('bindIdentity(bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[profile]),'Bind an active 420Identity profile owned by the connected account');
  }
  if(kind==='register-intent'){
    const amount=BigInt(payload.amount),nonce=BigInt(payload.nonce);
    if(amount<=0n||amount>2n**128n-1n||nonce<=0n||nonce>=2n**256n)throw new Error('invalid contribution intent');
    const sel=await rpc.selector('registerContributionIntent(bytes32,uint128,uint256)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale,wordUint(amount),wordUint(nonce)]),'Register a sale-bound invoice intent before 420Pay invoice creation');
  }
  if(kind==='link-dispute'){
    const caseId=bytes32(payload.caseId),sel=await rpc.selector('linkDispute(bytes32,bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale,caseId]),'Link a canonical arbitration case with matching claimant and campaign origin');
  }
  if(kind==='open-dispute'){
    const who=address(payload.account),saleRecord=await readSale(rpc,runtime,payload.saleId);
    const project=await call(rpc,runtime.projectRegistryAddress,'project(bytes32)',[wordHex(saleRecord.projectId)]);
    const respondent=decodeAddress(project);
    if(respondent.toLowerCase()===who||/^0x0{40}$/i.test(respondent))throw new Error('invalid dispute respondent');
    const domain=await call(rpc,runtime.crowdfundingIntegrationAddress,'CROWDFUNDING_DOMAIN()');
    const component=await rpc.call('web3_sha3',[hexUtf8('420/COMPONENT/LAUNCHPAD/V1')]);
    const cases=decodeAddress(await call(rpc,runtime.crowdfundingIntegrationAddress,'arbitrationCases()'));
    const sel=await rpc.selector('openCase(bytes32,address,bytes32,bytes32,bytes32,bytes32)');
    const claim=bytes32(payload.claimHash),remedy=bytes32(payload.requestedRemedyHash);
    return review(kind,cases,encodeStatic(sel,[wordHex(domain),wordAddress(respondent),wordHex(component),sale,claim,remedy]),
      'Open a 420Arbitration case; recover the case ID from the confirmed CaseOpened event before linking it');
  }
  if(kind==='publish-outcome'){
    const who=address(payload.account),sel=await rpc.selector('publishFinalizedDisputeOutcome(bytes32,address)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale,wordAddress(who)]),'Publish an already-finalized arbitration ruling as evidence');
  }
  if(kind==='recover-unallocated'){
    const payment=bytes32(payload.paymentId),sel=await rpc.selector('reconcileUnallocatedRefund(bytes32,bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[sale,payment]),'Reconcile an unallocated contribution only after 420Pay has delivered the full refund');
  }
  if(kind==='reconcile-refund'){
    const payment=bytes32(payload.paymentId),sel=await rpc.selector('reconcileRecordedRefund(bytes32)');
    return review(kind,runtime.crowdfundingIntegrationAddress,encodeStatic(sel,[payment]),'Checkpoint a delivered 420Pay principal refund; historical gross funding is unchanged');
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
