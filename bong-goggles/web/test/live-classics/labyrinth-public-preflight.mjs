// BC-2.8: read-only public acceptance preflight.
// HTTP health and browser feature flags are necessary, NEVER sufficient,
// to unlock the 325-point live match or release manifest.
export const BC28_ORIGIN='https://bonggoggles.420integrated.org';
const paths=['/games/labyrinth-cribbage','/runtime-config.json','/social-api/healthz'];
const safeJson=(body)=>{try{return JSON.parse(body)}catch{return null}};
const deny=reason=>{throw Error('BC-2.8 deployed acceptance blocked: '+reason)};
export async function verifyBC28PublicPreflight({
 fetchImpl=fetch,origin=BC28_ORIGIN,timeoutMs=12000
}={}){
 if(origin!==BC28_ORIGIN)deny('production hostname is not canonical');
 const output=[];
 for(const path of paths){
  let res,body;
  try{
   res=await fetchImpl(origin+path,{method:'GET',credentials:'omit',redirect:'error',
    cache:'no-store',headers:{Accept:path.endsWith('.json')||path.includes('healthz')?
     'application/json':'text/html'},signal:AbortSignal.timeout(timeoutMs)});
   body=await res.text();
  }catch{deny(path+' is unreachable');}
  if(res.status!==200||body.length>512*1024)deny(path+' did not return bounded HTTP 200');
  output.push({path,contentType:res.headers.get('content-type')||'',body});
 }
 const [page,configResponse,healthResponse]=output;
 if(!/text\/html/i.test(page.contentType)||!/labyrinth|bonggoggles/i.test(page.body))
  deny('published Labyrinth route is missing');
 if(!/application\/json/i.test(configResponse.contentType)||
    !/application\/json/i.test(healthResponse.contentType))
  deny('browser flags or trusted Worker health are not JSON');
 const config=safeJson(configResponse.body),health=safeJson(healthResponse.body);
 if(config?.appOrigin!==origin)deny('browser origin is not canonical');
 for(const flag of ['accountSocial','accountGames','classicRooms','classicCommunications']){
  if(config?.features?.[flag]!==true)deny('published feature '+flag+' is disabled');
 }
 if(health?.ready!==true)deny('same-origin Worker->social service is not ready');
 return Object.freeze({origin,publicRoute:true,workerReady:true,
  browserFlags:true,notLiveMatchEvidence:true,
  inspectedPaths:Object.freeze(paths)});
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 verifyBC28PublicPreflight().then(x=>console.log(
  'BC-2.8 PUBLIC PREFLIGHT PASS (NOT MATCH/RELEASE AUTHORIZATION):',
  JSON.stringify(x))).catch(e=>{console.error(e.message);process.exitCode=1});
}
