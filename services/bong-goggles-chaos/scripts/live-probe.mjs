// Non-secret, non-mutating public acceptance probe. No login token, session
// cookie, SSO callback or game move is sent. Real two-account play still needs
// independent interactive sign-in acceptance.
import {fileURLToPath} from 'node:url';
const SITE='https://bonggoggles.420integrated.org';
const AUTH='https://auth.420integrated.org';
function target(origin){
 const u=new URL(origin);
 if(u.protocol!=='https:'||!u.hostname.endsWith('.onrender.com')||
  u.username||u.password||u.search||u.hash||u.pathname!=='/')
  throw Error('Provide the exact verified HTTPS Render game origin');
 return u.origin;
}
export async function checkPublicChaos({chaosOrigin,fetchImpl=fetch}){
 const game=target(chaosOrigin),results=[];
 const checks=[
  ['420ID health',AUTH+'/healthz',200],
  ['Account Social health',SITE+'/social-api/healthz',200],
  ['Dedicated game health',game+'/healthz',200],
  ['Direct unsigned game rejection',game+'/v1/chaos/rooms',401],
  ['Same-origin unsigned room rejection',SITE+'/social-api/v1/chaos/rooms',401],
  ['SSO login initiation',SITE+'/social-api/auth/start',303]
 ];
 for(const [name,url,status] of checks){
  let response;
  try{response=await fetchImpl(url,{method:'GET',redirect:'manual',
    credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(12000)});}
  catch{throw Error(name+': network unavailable');}
  results.push({name,status:response.status,expected:status});
  if(response.status!==status)throw Error(name+': HTTP '+response.status+' (expected '+status+')');
  if(name==='SSO login initiation'){
   const location=response.headers.get('location')||'';
   if(!location.startsWith(AUTH+'/sso/authorize?'))
    throw Error('SSO login initiation: noncanonical redirect');
   if(!(response.headers.get('set-cookie')||'').includes('__Host-bg_social_flow='))
    throw Error('SSO login initiation: secure flow cookie missing');
  }
 }
 return results;
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 checkPublicChaos({chaosOrigin:process.env.CHAOS_PUBLIC_ORIGIN}).then(rows=>{
  for(const row of rows)console.log(row.name+': HTTP '+row.status);
  console.log('Public probes passed. Two distinct 420ID accounts still require browser acceptance.');
 }).catch(error=>{console.error('CCC release BLOCKED: '+error.message);process.exitCode=1;});
}
