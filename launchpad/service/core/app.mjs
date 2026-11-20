import {resolveLaunchpad} from './rpc.mjs';
import {decodeAddress} from './abi.mjs';
import {participantState,prepareParticipant,creatorRequest} from './planner.mjs';
import {position,checkoutContext,transactionStatus} from './consumer.mjs';
function ok(body,status=200){return {status,body};}
function fail(error){return {status:error.statusCode||400,body:{error:error.message||String(error)}};}
const param=(q,key)=>q instanceof URLSearchParams?q.get(key):q?.[key];
export function createApp({rpc,projection,registryAddress='0x0000000000000000000000000000000000000434',chainId}={}){
  async function runtime(){
    const actualChainId=await rpc.call('eth_chainId',[]);
    if(chainId&&actualChainId.toLowerCase()!==chainId.toLowerCase())throw new Error('configured chainId does not match RPC');
    const resolved=await resolveLaunchpad(rpc,{registryAddress});
    const arbitrationCasesAddress=decodeAddress(await rpc.ethCall(resolved.crowdfundingIntegrationAddress,await rpc.selector('arbitrationCases()')));
    return {schema:'420-launchpad-runtime-v1',canonical:true,chainId:actualChainId,...resolved,arbitrationCasesAddress};
  }
  return async function dispatch({method='GET',path='/',query={},body=null}={}){
    try{
      if(method==='GET'&&path==='/v1/launchpad/runtime')return ok(await runtime());
      if(method==='GET'&&path==='/v1/launchpad/campaigns')return ok(projection.campaigns({
        search:param(query,'search'),mode:param(query,'mode'),state:param(query,'state'),cursor:param(query,'cursor'),limit:param(query,'limit')||undefined
      }));
      let m=path.match(/^\/v1\/launchpad\/campaigns\/([^/]+)$/);
      if(method==='GET'&&m)return ok(projection.campaign(decodeURIComponent(m[1])));
      m=path.match(/^\/v1\/launchpad\/campaigns\/(0x[0-9a-fA-F]{64})\/position\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m)return ok(await position(rpc,await runtime(),m[1],m[2]));
      m=path.match(/^\/v1\/launchpad\/campaigns\/(0x[0-9a-fA-F]{64})\/checkout$/);
      if(method==='GET'&&m)return ok(await checkoutContext(rpc,await runtime(),m[1],param(query,'account'),param(query,'amount'),param(query,'nonce')));
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
      m=path.match(/^\/v1\/launchpad\/prepare\/(contribute|claim|refund|bind-identity|register-intent|open-dispute|link-dispute|publish-outcome|recover-unallocated|reconcile-refund)$/);
      if(method==='POST'&&m)return ok(await prepareParticipant(rpc,await runtime(),m[1],body||{}));
      if(method==='POST'&&path==='/v1/launchpad/creator-requests')return ok(creatorRequest(body||{},await runtime()),202);
      return ok({error:'not found'},404);
    }catch(e){return fail(e);}
  };
}
