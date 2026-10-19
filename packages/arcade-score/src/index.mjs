// ARC-1.9: untrusted client events, never verified scores, entitlements or payouts.
export class ArcadeEventError extends Error {constructor(message){super(message);this.name='ArcadeEventError';}}
const reject=s=>{throw new ArcadeEventError(s);};
const ID=/^420\/GAMING\/GAME\/ARCADE_[A-Z0-9_]+\/V1$/;
const VER=/^[0-9]+\.[0-9]+\.[0-9]+$/;
const SESSION=/^[a-f0-9]{32}$/i;
const ACH=/^[a-z][a-z0-9_-]{0,63}$/;
const types=new Set(['input','score','achievement','complete']);
function clean(value){
 const seen=new WeakSet();
 function check(x,depth){
  if(depth>12)reject('Event nesting exceeded');
  if(x===null||typeof x==='string'||typeof x==='boolean')return x;
  if(typeof x==='number'&&Number.isFinite(x))return x;
  if(!x||typeof x!=='object'||seen.has(x))reject('Untrusted event value');
  seen.add(x);
  if(Array.isArray(x)){if(x.length>256)reject('Array too large');return x.map(v=>check(v,depth+1));}
  if(Object.getPrototypeOf(x)!==Object.prototype||Object.keys(x).length>64)reject('Invalid event object');
  const out=Object.create(null);
  for(const [k,v] of Object.entries(x)){if(['__proto__','prototype','constructor'].includes(k))reject('Forbidden key');out[k]=check(v,depth+1);}
  return out;
 }
 const out=check(value,0);if(JSON.stringify(out).length>16384)reject('Event exceeds size limit');return out;
}
function digestPayload(value){return JSON.stringify(value);}
export class ArcadeSessionEvents {
 #game;#id;#seed;#started;#clock;#events=[];#sequence=0;#status='active';#score=0;#achievements=new Set();#digest=null;
 constructor({game,sessionId,seedProvenance,startedAt,clock=()=>Date.now()}){
  if(!game||!ID.test(game.gameId)||!VER.test(game.rulesetVersion)||!VER.test(game.contentVersion)||game.registration!=='UNREGISTERED'||game.walletRequiredForCore!==false)reject('Unapproved game authority');
  if(!SESSION.test(sessionId)||!Number.isSafeInteger(startedAt)||startedAt<0||typeof clock!=='function')reject('Invalid session envelope');
  if(!seedProvenance||!['local-unverified','server-issued-unverified'].includes(seedProvenance.kind)||typeof seedProvenance.reference!=='string'||seedProvenance.reference.length<1||seedProvenance.reference.length>128)reject('Invalid seed provenance');
  this.#game=Object.freeze({gameId:game.gameId,rulesetVersion:game.rulesetVersion,contentVersion:game.contentVersion});
  this.#id=sessionId;this.#started=startedAt;this.#clock=clock;this.#seed=Object.freeze({...seedProvenance});
 }
 get status(){return this.#status;}get sequence(){return this.#sequence;}
 snapshot(){return structuredClone({sessionId:this.#id,...this.#game,seedProvenance:this.#seed,startedAt:this.#started,events:this.#events,score:this.#score,achievements:[...this.#achievements],status:this.#status,verification:'LOCAL_UNVERIFIED',resultDigest:this.#digest});}
 append(event){
  if(this.#status!=='active')reject('Terminal session');
  if(!event||typeof event!=='object'||Array.isArray(event)||!types.has(event.type)||event.verified!==undefined||event.isVerified!==undefined||event.reward!==undefined||event.payout!==undefined)reject('Forbidden event type or authority');
  if(event.gameId!==undefined&&event.gameId!==this.#game.gameId||event.sessionId!==undefined&&event.sessionId!==this.#id||event.rulesetVersion!==undefined&&event.rulesetVersion!==this.#game.rulesetVersion)reject('Foreign scope or ruleset');
  if(!Number.isSafeInteger(event.sequence)||event.sequence!==this.#sequence+1)reject('Nonmonotonic/replayed event');
  const timestamp=this.#clock();if(!Number.isSafeInteger(timestamp)||timestamp<this.#started)reject('Invalid event clock');
  if(event.type==='score'&&(!Number.isSafeInteger(event.delta)||event.delta<0||this.#score+event.delta>Number.MAX_SAFE_INTEGER))reject('Invalid score');
  if(event.type==='achievement'&&(!ACH.test(event.achievementId)||this.#achievements.has(event.achievementId)))reject('Invalid or duplicate achievement');
  if(event.type==='complete'&&(!Number.isSafeInteger(event.finalScore)||event.finalScore!==this.#score))reject('Inconsistent final score');
  if(event.type==='input'&&(!Array.isArray(event.actions)||event.actions.length>16||event.actions.some(a=>!['up','down','left','right','primary','secondary','pause'].includes(a))))reject('Invalid normalized input');
  const normalized=clean(event);
  const record={...normalized,type:event.type,sequence:event.sequence,timestamp,gameId:this.#game.gameId,sessionId:this.#id,rulesetVersion:this.#game.rulesetVersion};
  if(this.#events.length>=10000)reject('Session event budget exceeded');
  this.#events.push(record);this.#sequence++;
  if(event.type==='score')this.#score+=event.delta;
  if(event.type==='achievement')this.#achievements.add(event.achievementId);
  if(event.type==='complete')this.#status='completed';
  return structuredClone({...record,verification:'LOCAL_UNVERIFIED'});
 }
 async finish(crypto){
  if(this.#status!=='completed'||this.#digest)reject('Session must complete once');
  if(typeof crypto?.subtle?.digest!=='function')reject('SHA-256 digest unavailable');
  const data=new TextEncoder().encode(digestPayload({sessionId:this.#id,...this.#game,seedProvenance:this.#seed,startedAt:this.#started,events:this.#events,score:this.#score,achievements:[...this.#achievements]}));
  const h=await crypto.subtle.digest('SHA-256',data);
  this.#digest=Array.from(new Uint8Array(h),v=>v.toString(16).padStart(2,'0')).join('');
  return this.snapshot();
 }
}
export function validateSubmittedEventStream(snapshot,{game,sessionId}){
 if(!snapshot||snapshot.verification!=='LOCAL_UNVERIFIED'||snapshot.sessionId!==sessionId||snapshot.gameId!==game.gameId||snapshot.rulesetVersion!==game.rulesetVersion||snapshot.contentVersion!==game.contentVersion||!Array.isArray(snapshot.events)||snapshot.events.length>10000)reject('Untrusted session envelope');
 let score=0,sequence=0;const found=new Set();
 for(const e of snapshot.events){
  if(e.sequence!==++sequence||e.gameId!==game.gameId||e.sessionId!==sessionId||e.rulesetVersion!==game.rulesetVersion||!types.has(e.type))reject('Invalid event sequence or identity');
  if(e.type==='score'){if(!Number.isSafeInteger(e.delta)||e.delta<0||score+e.delta>Number.MAX_SAFE_INTEGER)reject('Invalid score');score+=e.delta;}
  if(e.type==='achievement'){if(!ACH.test(e.achievementId)||found.has(e.achievementId))reject('Duplicate achievement');found.add(e.achievementId);}
  if(e.verified!==undefined||e.payout!==undefined||e.reward!==undefined)reject('Untrusted verification claim');
 }
 if(score!==snapshot.score||sequence!==snapshot.events.length||snapshot.achievements?.length!==found.size||snapshot.achievements.some(a=>!found.has(a)))reject('Event aggregate mismatch');
 return Object.freeze({acceptedForLocalDisplay:true,verified:false,score,achievementIds:Object.freeze([...found])});
}
