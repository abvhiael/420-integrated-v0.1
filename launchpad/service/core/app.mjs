import {resolveLaunchpad} from './rpc.mjs';
import {decodeAddress} from './abi.mjs';
import {participantState,prepareParticipant,creatorRequest} from './planner.mjs';
import {position,checkoutContext,transactionStatus} from './consumer.mjs';
import {convertedCheckoutQuote,convertedCheckoutReview} from './quote.mjs';
import {prepareCampaignRequest,creatorLifecycle} from './creator.mjs';
import {creatorReport,creatorCampaigns} from './creator-report.mjs';
import {CreatorQueue} from './creator-queue.mjs';
function ok(body,status=200){return {status,body};}
function fail(error){return {status:error.statusCode||400,body:{error:error.message||String(error)}};}
const param=(q,key)=>q instanceof URLSearchParams?q.get(key):q?.[key];
export function createApp({rpc,projection,creatorQueue=new CreatorQueue(process.env.LAUNCHPAD_CREATOR_REQUEST_FILE),
  creatorReportFromBlock=process.env.LAUNCHPAD_CREATOR_REPORT_FROM_BLOCK??null,
  registryAddress='0x0000000000000000000000000000000000000434',chainId}={}){
  async function runtime(){
    const actualChainId=await rpc.call('eth_chainId',[]);
    if(chainId&&actualChainId.toLowerCase()!==chainId.toLowerCase())throw new Error('configured chainId does not match RPC');
    const resolved=await resolveLaunchpad(rpc,{registryAddress});
    const arbitrationCasesAddress=decodeAddress(await rpc.ethCall(resolved.crowdfundingIntegrationAddress,await rpc.selector('arbitrationCases()')));
    const code=await rpc.call('eth_getCode',[arbitrationCasesAddress,'latest']);
    if(!/^0x(?:[0-9a-fA-F]{2})+$/.test(code||''))throw new Error('untrusted Arbitration runtime binding');
    return {schema:'420-launchpad-runtime-v1',canonical:true,chainId:actualChainId,...resolved,arbitrationCasesAddress};
  }
  return async function dispatch({method='GET',path='/',query={},body=null}={}){
    try{
      if(method==='GET'&&path==='/v1/launchpad/runtime')return ok(await runtime());
      if(method==='GET'&&path==='/v1/launchpad/campaigns'){
        const rt=await runtime(),snapshot=await projection.verify(rpc,rt);
        return ok(projection.campaigns({
          search:param(query,'search'),mode:param(query,'mode'),state:param(query,'state'),
          cursor:param(query,'cursor'),limit:param(query,'limit')||undefined
        },snapshot));
      }
      let m=path.match(/^\/v1\/launchpad\/campaigns\/([^/]+)$/);
      if(method==='GET'&&m){const rt=await runtime(),snapshot=await projection.verify(rpc,rt);return ok(projection.campaign(decodeURIComponent(m[1]),snapshot));}
      m=path.match(/^\/v1\/launchpad\/campaigns\/(0x[0-9a-fA-F]{64})\/position\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m)return ok(await position(rpc,await runtime(),m[1],m[2]));
      m=path.match(/^\/v1\/launchpad\/campaigns\/(0x[0-9a-fA-F]{64})\/checkout$/);
      if(method==='GET'&&m)return ok(await checkoutContext(rpc,await runtime(),m[1],param(query,'account'),param(query,'amount'),param(query,'nonce')));
      m=path.match(/^\/v1\/launchpad\/campaigns\/(0x[0-9a-fA-F]{64})\/conversion-quote$/);
      if(method==='GET'&&m)return ok(await convertedCheckoutQuote(rpc,await runtime(),{
        saleId:m[1],account:param(query,'account'),amount:param(query,'amount'),nonce:param(query,'nonce'),
        marketId:param(query,'marketId'),inputAsset:param(query,'inputAsset'),maxInput:param(query,'maxInput'),minOutput:param(query,'minOutput')
      }));
      m=path.match(/^\/v1\/launchpad\/transactions\/(0x[0-9a-fA-F]{64})$/);
      if(method==='GET'&&m)return ok(await transactionStatus(rpc,await runtime(),m[1],param(query,'account')));
      // Audit-5 compatibility endpoint: canonical participant ledger read only.
      m=path.match(/^\/v1\/launchpad\/campaigns\/([^/]+)\/participants\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m){
        const rt=await runtime(),saleId=decodeURIComponent(m[1]);
        const participant=await participantState(rpc,rt,saleId,m[2]);
        const block=await rpc.call('eth_getBlockByNumber',['latest',false]);
        if(!/^0x[0-9a-fA-F]{64}$/.test(block?.hash||''))throw new Error('unverifiable chain head');
        return ok({schema:'420-launchpad-projection-v1',canonical:true,
          source:{chainId:rt.chainId,blockHash:block.hash},participant});
      }
      m=path.match(/^\/v1\/launchpad\/prepare\/(approve-conversion|pay-conversion)$/);
      if(method==='POST'&&m)return ok(await convertedCheckoutReview(rpc,await runtime(),m[1],body||{}));
      m=path.match(/^\/v1\/launchpad\/prepare\/(contribute|claim|refund|bind-identity|register-intent|open-dispute|link-dispute|publish-outcome|recover-unallocated|reconcile-refund)$/);
      if(method==='POST'&&m)return ok(await prepareParticipant(rpc,await runtime(),m[1],body||{}));
      m=path.match(/^\/v1\/launchpad\/creator\/campaigns\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m){const rt=await runtime(),snapshot=await projection.verify(rpc,rt);return ok(await creatorCampaigns(rpc,rt,{read:()=>snapshot},m[1]));}
      m=path.match(/^\/v1\/launchpad\/creator\/report\/(0x[0-9a-fA-F]{40})\/(0x[0-9a-fA-F]{64})$/);
      if(method==='GET'&&m)return ok(await creatorReport(rpc,await runtime(),m[1],m[2],{fromBlock:creatorReportFromBlock}));
      m=path.match(/^\/v1\/launchpad\/creator\/requests\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m)return ok({schema:'420-launchpad-creator-receipts-v1',items:creatorQueue.list(m[1])});
      if(method==='POST'&&path==='/v1/launchpad/creator/prepare'){
        const rt=await runtime(),request=body?.kind==='LIFECYCLE'?
          await creatorLifecycle(rpc,rt,body):
          await prepareCampaignRequest(rpc,rt,body?.draft);
        return ok(request);
      }
      if(method==='POST'&&path==='/v1/launchpad/creator/submit'){
        const rt=await runtime(),request=body?.kind==='LIFECYCLE'?
          await creatorLifecycle(rpc,rt,body):
          await prepareCampaignRequest(rpc,rt,body?.draft);
        if(body?.requestId?.toLowerCase()!==request.requestId.toLowerCase())
          return fail(Object.assign(new Error('creator request changed after Wallet signature'),{statusCode:409}));
        return ok(await creatorQueue.submit(rpc,request,body.signature),202);
      }
      if(method==='POST'&&path==='/v1/launchpad/creator-requests')return ok(creatorRequest(body||{},await runtime()),202);
      return ok({error:'not found'},404);
    }catch(e){return fail(e);}
  };
}
