import {createHash,timingSafeEqual} from "node:crypto";
const valid=x=>typeof x==="string"&&x.length>0&&x.length<=256;
const h=x=>createHash("sha256").update(x).digest();
const safe=(a,b)=>valid(a)&&valid(b)&&timingSafeEqual(h(a),h(b));
const ipv4Host=x=>{const p=x.split(".");return p.length===4&&p.every(v=>/^\d+$/.test(v)&&+v>=0&&+v<=255)};
const unsafeHost=x=>{const host=x.toLowerCase().replace(/\.$/,"");if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".test")||host.endsWith(".invalid")||host.includes(":")||host.startsWith("[")||/^[0-9]+$/.test(host))return true;if(ipv4Host(host)){const [a,b]=host.split(".").map(Number);return a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===192&&b===0||a===198&&[18,19].includes(b)}return false;};
const badUrl=x=>typeof x!=="string"||x.length>2048||!/^https:\/\//i.test(x)||/\s|[<>"'\\]/.test(x)||(()=>{try{const u=new URL(x);return !!u.username||!!u.password||!u.hostname||unsafeHost(u.hostname)}catch{return true}})();
export class HzSecurityGate420{
 constructor({authorize,verifyCanonical,clock=()=>Date.now(),limit=10,windowMs=60000,replayStore=null,rateStore=null,production=false}={}){if(typeof authorize!=="function"||typeof verifyCanonical!=="function")throw Error("AUTHORITIES_REQUIRED");this.authorize=authorize;this.verifyCanonical=verifyCanonical;this.clock=clock;this.limit=limit;this.windowMs=windowMs;if(production&&(!replayStore||!rateStore))throw Error("DURABLE_STORES_REQUIRED");this.replays=replayStore||new Map();this.requests=rateStore||new Map();}
 guard({actor,scope,id,nonce,expiry,resource,proof,metadata={},mediaUrl=null,contentHash=null,expectedHash=null}){
  if(![actor,scope,id,nonce,resource].every(valid)||!Number.isSafeInteger(expiry)||expiry<this.clock())throw Error("BAD_REQUEST");
  if(this.authorize({actor,scope,id,nonce,expiry,resource,proof})!==true)throw Error("UNAUTHORIZED");
  if(this.verifyCanonical({scope,resource,proof})!==true)throw Error("CANONICAL_PROOF_REQUIRED");
  if(!metadata||typeof metadata!=="object"||Array.isArray(metadata)||Object.keys(metadata).length>32)throw Error("UNSAFE_METADATA");
  if(Object.keys(metadata).some(k=>/token|secret|password|privatekey|credential/i.test(k)))throw Error("SECRET_NOT_ACCEPTED");
  for(const v of Object.values(metadata)){if(typeof v!=="string"||v.length>4096||/<script|onerror\s*=|javascript:|data:text\/html|<iframe/i.test(v))throw Error("UNSAFE_METADATA")}
  if(mediaUrl!==null&&badUrl(mediaUrl))throw Error("UNSAFE_URL");
  if(contentHash!==null||expectedHash!==null){if(!/^[a-f0-9]{64}$/i.test(contentHash||"")||!safe(contentHash,expectedHash))throw Error("INTEGRITY_MISMATCH")}
  const key=JSON.stringify([actor,scope,nonce]);if(this.replays.has(key))throw Error("REPLAY");
  const now=this.clock(),recent=(this.requests.get(actor)||[]).filter(t=>now-t<this.windowMs);if(recent.length>=this.limit)throw Error("RATE_LIMIT");
  this.replays.set(key,{scope,resource,at:now});recent.push(now);this.requests.set(actor,recent);return {accepted:true,resource,scope};
 }
 assertProvider({jobId,outputHash,canonicalProof,providerPayload}){
  if(!valid(jobId)||!/^[a-f0-9]{64}$/i.test(outputHash||"")||this.verifyCanonical({scope:"PROVIDER_OUTPUT",resource:jobId,proof:canonicalProof})!==true)throw Error("PROVIDER_SPOOF");
  if(typeof providerPayload==="string"&&/ignore previous instructions|system prompt|developer message/i.test(providerPayload))throw Error("UNTRUSTED_PROVIDER_INSTRUCTIONS");
  return {verified:true,jobId,outputHash};
 }
 project(event){if(!event||event.finalized!==true||event.sourceReady!==true||event.reorged===true||event.deleted===true||event.visibility!=="PUBLIC"||this.verifyCanonical({scope:"PUBLIC_PROJECTION",resource:event.objectId,proof:event.proof})!==true)throw Error("PRIVATE_OR_STALE");return {objectId:event.objectId,kind:event.kind};}
}
