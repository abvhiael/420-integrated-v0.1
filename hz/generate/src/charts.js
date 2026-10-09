import { createHash } from "node:crypto";
const families=new Set(["TOP_RECORDINGS","TRENDING_RECORDINGS","NEW_RECORDINGS","TOP_ARTISTS","COMMUNITY_FAVORITES"]);
const windows={DAILY:86400000,WEEKLY:604800000,MONTHLY:2592000000};
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const validId=x=>typeof x==="string" && /^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(x);
const compare=(a,b)=>b.score-a.score||a.id.localeCompare(b.id,"en");
export class Charts420 {
 constructor({recording,creator,policyVersion="1",qualification,verifyCheckpoint=null,production=false}={}){
  if(typeof recording!=="function"||typeof creator!=="function")throw Error("SOURCE_REQUIRED");
  if(policyVersion!=="1")throw Error("UNSUPPORTED_POLICY");
  if(production&&(typeof qualification!=="function"||typeof verifyCheckpoint!=="function"))throw Error("PRODUCTION_CHART_AUTHORITIES_REQUIRED");
  this.production=production;this.recording=recording;this.creator=creator;this.qualification=qualification;this.verifyCheckpoint=verifyCheckpoint;
  this.events=new Map();this.history=new Map();
 }
 ingest(event){
  if(!event||!validId(event.id)||!validId(event.recordingId)||!Number.isSafeInteger(event.at)||event.at<0||!validId(event.checkpoint))throw Error("INVALID_EVENT");
  if(!["RAW_PLAY","QUALIFIED_PLAY","DISTINCT_LISTENER","PUBLIC_FAVORITE","PUBLIC_PLAYLIST_ADD","PUBLIC_FOLLOW","PUBLIC_SHARE","AWARD_VOTE","SEARCH_CLICK","GENERATE_COUNT"].includes(event.signal))throw Error("UNKNOWN_SIGNAL");
  if(event.signal==="QUALIFIED_PLAY"){
   // Trusted ingest adapter MUST supply a positive cryptographic/source qualification result.
   // No client-asserted booleans or RAW_PLAY can become QUALIFIED_PLAY.
   if(typeof this.qualification!=="function"||this.qualification(event)!==true)throw Error("UNVERIFIED_QUALIFICATION");
   if(!validId(event.listenerToken))throw Error("MISSING_PRIVACY_TOKEN");
   if(event.actorAccount&&event.sourceOwner&&event.actorAccount===event.sourceOwner)throw Error("SELF_INFLATION");
  }
  const committed={id:event.id,recordingId:event.recordingId,signal:event.signal,at:event.at,checkpoint:event.checkpoint,listenerToken:event.listenerToken||null,public:event.public===true,fixture:event.fixture===true};
  const previous=this.events.get(event.id);
  if(previous){if(hash(previous)!==hash(committed))throw Error("REPLAY_CONFLICT");return false;}
  this.events.set(event.id,committed);return true;
 }
 eligible(id){const r=this.recording(id);return r&&r.status==="PUBLISHED"&&r.visibility==="PUBLIC"&&!r.rightsBlocked&&!r.deleted&&validId(r.creatorId)?r:null;}
 discover({genre,mood,disclosure,category,newOnly=false,asOf=Date.now()}={}){
  if(typeof this.recording.list!=="function")throw Error("DISCOVERY_SOURCE_REQUIRED");
  if(!Number.isSafeInteger(asOf))throw Error("INVALID_TIME");
  return this.recording.list().filter(x=>this.eligible(x.id)&&(!genre||x.genre===genre)&&(!mood||x.mood===mood)&&(!disclosure||x.disclosure===disclosure)&&(!category||x.category===category)&&(!newOnly||(x.publishedAt<=asOf&&x.publishedAt>asOf-windows.MONTHLY))).sort((a,b)=>b.publishedAt-a.publishedAt||a.id.localeCompare(b.id,"en")).map(x=>({id:x.id,creatorId:x.creatorId,publishedAt:x.publishedAt,genre:x.genre,mood:x.mood,disclosure:x.disclosure,category:x.category}));
 }
 snapshot({family="TOP_RECORDINGS",window="WEEKLY",windowEnd,checkpoint,stale=false,sourceFinal=true,sourceReady=true}={}){
  if(!families.has(family)||!(window in windows)||!Number.isSafeInteger(windowEnd)||windowEnd<0||!validId(checkpoint))throw Error("INVALID_SNAPSHOT");
  if(!sourceFinal||!sourceReady||stale||this.verifyCheckpoint&&this.verifyCheckpoint(checkpoint)!==true)throw Error("STALE_SOURCE");
  const start=windowEnd-windows[window],count=new Map(),listeners=new Map(),seenListener=new Set();
  const records=[...this.events.values()].sort((a,b)=>a.id.localeCompare(b.id,"en"));
  for(const e of records){
   if(e.at<start||e.at>=windowEnd||e.fixture||!e.public||e.checkpoint!==checkpoint)continue;
   const r=this.eligible(e.recordingId);if(!r)continue;
   if(e.signal!=="QUALIFIED_PLAY")continue; // No score conversion for RAW_PLAY, AwardVote, follows, shares or private signals.
   const key=JSON.stringify([e.recordingId,e.listenerToken,window]);
   // Conservative V1 abuse cap: only one qualified play per listener/recording/window.
   if(seenListener.has(key))continue;seenListener.add(key);
   count.set(e.recordingId,(count.get(e.recordingId)||0)+1);
   listeners.set(e.recordingId,(listeners.get(e.recordingId)||0)+1);
  }
  let rows=[];
  if(family==="NEW_RECORDINGS"){
   rows=this.discover({asOf:windowEnd}).filter(r=>r.publishedAt>=start&&r.publishedAt<windowEnd).map(r=>({id:r.id,score:0,publishedAt:r.publishedAt})).sort((a,b)=>b.publishedAt-a.publishedAt||a.id.localeCompare(b.id,"en"));
  }else if(family==="TOP_ARTISTS"){
   const totals=new Map();for(const [id,n] of count){const r=this.eligible(id);if(r&&this.creator(r.creatorId)?.visibility==="PUBLIC")totals.set(r.creatorId,(totals.get(r.creatorId)||0)+n+(listeners.get(id)||0));}
   rows=[...totals].map(([id,score])=>({id,score})).sort(compare);
  }else if(family==="COMMUNITY_FAVORITES"){
   // V1 favorite weight is zero: present eligible public recordings without fabricating favoriting.
   rows=[...count].map(([id])=>({id,score:0})).sort(compare);
  }else {
   rows=[...count].map(([id,n])=>({id,score:n+(listeners.get(id)||0),qualifiedPlays:n,distinctListeners:listeners.get(id)||0})).sort(compare);
  }
  rows=rows.map((r,i)=>({...r,rank:i+1}));
  const base={family,policyVersion:"1",window,windowStart:start,windowEnd,checkpoint,rows,stale:false};
  const resultCommitment=hash(base);const snap={...base,resultCommitment};
  const key=JSON.stringify([family,window,start,windowEnd,checkpoint]),old=this.history.get(key)||[];
  if(old.length&&old.at(-1).resultCommitment===resultCommitment)return structuredClone(old.at(-1));
  const final={...snap,supersedes:old.at(-1)?.resultCommitment||null};
  this.history.set(key,[...old,final]);return structuredClone(final);
 }
 historyFor({family,window,windowEnd,checkpoint}){return structuredClone(this.history.get(JSON.stringify([family,window,windowEnd-windows[window],windowEnd,checkpoint]))||[]);}
}
