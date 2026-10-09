// COM-7 external readiness check. No sensitive customer information is emitted.
// A deployment orchestrator may invoke this on a schedule and alert on nonzero exit.
export function validateCommerceHealth(response,{chainId,now=Date.now(),maxAgeMs=120000,maxUnfinalizedBlocks=64}={}) {
  if(!response||typeof response!=='object'||response.schema!=='420-commerce-api-v1')throw Error('invalid_health_envelope');
  const h=response.data;
  if(!h||h.authoritative!==false||String(h.chainId)!==String(chainId))throw Error('health_authority_mismatch');
  if(h.state!=='ready')throw Error('commerce_unavailable');
  for(const n of [h.height,h.finalizedHeight,h.updatedAt])if(!Number.isSafeInteger(n))throw Error('health_noninteger');
  if(h.height<0||h.finalizedHeight<0||h.finalizedHeight>h.height)throw Error('health_invalid_heights');
  if(!Number.isSafeInteger(maxAgeMs)||maxAgeMs<=0||!Number.isSafeInteger(maxUnfinalizedBlocks)||maxUnfinalizedBlocks<0)throw Error('invalid_monitor_config');
  if(h.updatedAt>now+10000||now-h.updatedAt>maxAgeMs)throw Error('health_stale');
  if(h.height-h.finalizedHeight>maxUnfinalizedBlocks)throw Error('health_finality_lag');
  return {state:'ready',chainId:String(chainId),height:h.height,finalizedHeight:h.finalizedHeight};
}
export async function checkCommerceHealth({endpoint,chainId,now=Date.now(),fetcher=fetch}={}) {
  const url=new URL(endpoint);
  if(url.protocol!=='https:'&&!(url.protocol==='http:'&&url.hostname==='127.0.0.1'))throw Error('monitor_insecure_origin');
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/v1/health')throw Error('monitor_invalid_url');
  const response=await fetcher(url,{method:'GET',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('health_http_failure');
  return validateCommerceHealth(await response.json(),{chainId,now});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href) {
  try{
    const result=await checkCommerceHealth({endpoint:process.env.COMMERCE_HEALTH_URL,chainId:process.env.COMMERCE_CHAIN_ID});
    process.stdout.write(JSON.stringify({event:'commerce_health_ready',...result})+'\n');
  }catch(error){
    process.stderr.write(JSON.stringify({event:'commerce_health_alert',code:error.message})+'\n');
    process.exitCode=1;
  }
}
