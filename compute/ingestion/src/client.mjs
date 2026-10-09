import {createHash} from 'node:crypto';
import {isIP} from 'node:net';

export class IngestionError extends Error { constructor(code){super(code);this.code=code;} }
const deny=code=>{throw new IngestionError(code)};
const privateHost=h=>h==='localhost'||h.endsWith('.localhost')||h.endsWith('.local')||h.endsWith('.internal')||h.endsWith('.onion');
export function publicIp(ip){
 const type=isIP(ip); if(!type)return false;
 if(type===4){let a=ip.split('.').map(Number);return !(a[0]===0||a[0]===10||a[0]===127||a[0]>=224||a[0]===169&&a[1]===254||a[0]===172&&a[1]>=16&&a[1]<=31||a[0]===192&&a[1]===168||a[0]===100&&a[1]>=64&&a[1]<=127||a[0]===192&&a[1]===0||a[0]===198&&a[1]>=18&&a[1]<=19||a[0]===192&&a[1]===0&&a[2]===2||a[0]===198&&a[1]===51&&a[2]===100||a[0]===203&&a[1]===0&&a[2]===113||a[0]>=240);
 }
 const v=ip.toLowerCase();return !(v==='::'||v==='::1'||v.startsWith('fc')||v.startsWith('fd')||v.startsWith('fe8')||v.startsWith('fe9')||v.startsWith('fea')||v.startsWith('feb')||v.startsWith('ff')||v.startsWith('2001:db8:')||v.startsWith('::ffff:'));
}
export function guardedUrl(url,allowedOrigin,allowedPath){
 let u;try{u=new URL(url)}catch{deny('BAD_URL')}
 if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443'||u.search||u.hash||!u.hostname||privateHost(u.hostname)||isIP(u.hostname))deny('UNSAFE_URL');
 if(u.origin!==allowedOrigin||u.pathname!==allowedPath)deny('UNAPPROVED_SOURCE');
 return u;
}
export function makeReadClient({policy,fetchImpl=fetch,resolveHost,clock=()=>Date.now(),maxBytes=1024*1024,timeoutMs=7000}){
 if(!policy||policy.enabled!==true||policy.permissionApproved!==true||policy.sourceApproval!==true)deny('SOURCE_DISABLED');
 if(!resolveHost||typeof resolveHost!=='function')deny('DNS_VERIFICATION_REQUIRED');
 if(!Number.isSafeInteger(policy.minPollMs)||policy.minPollMs<3600000||!policy.origin||!policy.path||!policy.schemaVersion)deny('POLICY_INVALID');
 const approved=guardedUrl(policy.origin+policy.path,policy.origin,policy.path);
 if(maxBytes>2*1024*1024||timeoutMs>15000||maxBytes<1||timeoutMs<1)deny('BOUNDS');
 let lastAttempt=-Infinity, consecutive=0, cursor=null;
 return {async read(nextCursor=null){
  const now=clock(); if(!Number.isFinite(now)||now<lastAttempt||now-lastAttempt<Math.min(3600000*2**Math.min(consecutive,4),86400000))deny('RATE_LIMITED');
  if(nextCursor!==null&&(!/^[a-zA-Z0-9_-]{1,120}$/.test(nextCursor)||nextCursor!==cursor))deny('INVALID_CURSOR');
  lastAttempt=now;
  const ips=await resolveHost(approved.hostname);if(!Array.isArray(ips)||ips.length===0||ips.some(x=>!publicIp(x)))deny('DNS_UNSAFE');
  const abort=new AbortController();const timeout=setTimeout(()=>abort.abort(),timeoutMs);
  try{
   const response=await fetchImpl(approved.href,{method:'GET',redirect:'manual',credentials:'omit',signal:abort.signal,headers:{accept:policy.accept||'application/json','user-agent':'420Compute-science-readonly/1'}});
   if(response.status>=300&&response.status<400)deny('REDIRECT_BLOCKED');
   if(!response.ok)deny('SOURCE_HTTP_'+response.status);
   const type=response.headers.get('content-type')||'';if(!type.toLowerCase().includes(policy.contentType))deny('SCHEMA_DRIFT_CONTENT_TYPE');
   const len=Number(response.headers.get('content-length'));if(response.headers.get('content-length')&&(!Number.isSafeInteger(len)||len>maxBytes))deny('TOO_LARGE');
   if(!response.body)deny('EMPTY_BODY');
   const reader=response.body.getReader();let pieces=[],bytes=0;
   try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>maxBytes)deny('TOO_LARGE');pieces.push(value)}}finally{reader.releaseLock()}
   if(bytes===0)deny('EMPTY_BODY');
   const raw=Buffer.concat(pieces);const digest=createHash('sha256').update(raw).digest('hex');
   const result=policy.parse(raw.toString('utf8'));if(!result||typeof result!=='object'||!Array.isArray(result.records)||result.records.length>500)deny('SCHEMA_DRIFT');
   consecutive=0;cursor=createHash('sha256').update(digest+':'+String(now)).digest('base64url').slice(0,43);
   return {schemaVersion:'420-science-observation-v1',provider:policy.system,sourceId:policy.id,observedAt:new Date(now).toISOString(),digest,cursor,records:result.records,authoritative:false,rewardEligible:false,externalEvidenceVerified:false,freshness:'OBSERVED_ONLY',sourceStatus:'UNVERIFIED_AGGREGATE'};
  }catch(e){consecutive++;if(e instanceof IngestionError)throw e;deny('SOURCE_UNAVAILABLE')}finally{clearTimeout(timeout)}
 }};
}
