import {resolveLaunchpad} from './rpc.mjs';
import {participantState,prepareParticipant,creatorRequest} from './planner.mjs';
function ok(body,status=200){return {status,body};}
function fail(error){return {status:error.statusCode||400,body:{error:error.message||String(error)}};}
export function createApp({rpc,projection,registryAddress='0x0000000000000000000000000000000000000434',chainId}={}){
  async function runtime(){const resolved=await resolveLaunchpad(rpc,{registryAddress});return {schema:'420-launchpad-runtime-v1',canonical:true,chainId,...resolved};}
  return async function dispatch({method='GET',path='/',body=null}={}){
    try{
      if(method==='GET'&&path==='/v1/launchpad/runtime')return ok(await runtime());
      if(method==='GET'&&path==='/v1/launchpad/campaigns')return ok(projection.campaigns());
      let m=path.match(/^\/v1\/launchpad\/campaigns\/([^/]+)$/);
      if(method==='GET'&&m)return ok(projection.campaign(decodeURIComponent(m[1])));
      m=path.match(/^\/v1\/launchpad\/campaigns\/([^/]+)\/participants\/(0x[0-9a-fA-F]{40})$/);
      if(method==='GET'&&m){const rt=await runtime();return ok({schema:'420-launchpad-projection-v1',canonical:true,source:{chainId,blockHash:'DIRECT_CHAIN_READ'},participant:await participantState(rpc,rt,decodeURIComponent(m[1]),m[2])});}
      m=path.match(/^\/v1\/launchpad\/prepare\/(contribute|claim|refund)$/);
      if(method==='POST'&&m){const rt=await runtime();return ok(await prepareParticipant(rpc,rt,m[1],body||{}));}
      if(method==='POST'&&path==='/v1/launchpad/creator-requests'){const rt=await runtime();return ok(creatorRequest(body||{},rt),202);}
      return ok({error:'not found'},404);
    }catch(e){return fail(e);}
  };
}
