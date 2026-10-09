import { createHash } from "node:crypto";
const hash=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const types=new Set(["GENERATION_COMPLETED","GENERATION_FAILED","PROJECT_READY_FOR_REVIEW","RELEASE_PUBLISHED","FOLLOW_ACTIVITY","COMMUNITY_ACTIVITY","NOMINATION_RECEIVED","NOMINATION_ACCEPTED","VOTING_OPENED","VOTING_CLOSING","AWARD_WON","PRIZE_SETTLEMENT_STATUS"]);
const publicEvent=x=>x.visibility==="PUBLIC"&&x.finalized===true&&x.deleted!==true&&x.sourceReady===true;
const validRef=x=>typeof x==="string"&&/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(x);
const clean=x=>structuredClone(x);
export class HzCrossService420 {
 constructor({verifySource,authorizePrivate=null,production=false,allowCommunityEvent=null}={}){if(typeof verifySource!=="function")throw Error("SOURCE_VERIFIER_REQUIRED");if(production&&typeof allowCommunityEvent!=="function")throw Error("COMMUNITY_POLICY_REQUIRED");this.verifySource=verifySource;this.authorizePrivate=authorizePrivate;this.production=production;this.allowCommunityEvent=allowCommunityEvent;this.events=new Map();this.checkpoints=new Map();}
 ingest(input){
  if(!input||!validRef(input.id)||!validRef(input.objectId)||!validRef(input.sourceCheckpoint)||!types.has(input.type)||!Number.isSafeInteger(input.at)||input.at<0||!["PUBLIC","PRIVATE","UNLISTED"].includes(input.visibility))throw Error("INVALID_EVENT");
  // Never allow callers to assert source authority using only a local object label.
  if(this.verifySource(input)!==true)throw Error("UNVERIFIED_SOURCE");
  const item={id:input.id,objectId:input.objectId,type:input.type,at:input.at,visibility:input.visibility,finalized:input.finalized===true,sourceReady:input.sourceReady===true,deleted:input.deleted===true,sourceCheckpoint:input.sourceCheckpoint,recordingId:input.recordingId||null,creatorId:input.creatorId||null,disclosure:input.disclosure||null,awardCategory:input.awardCategory||null,recipientAccount:input.recipientAccount||null,status:input.status||null,commitment:input.commitment||null};
  for(const k of ["recordingId","creatorId","recipientAccount"]){if(item[k]!==null&&!validRef(item[k]))throw Error("INVALID_REFERENCE")}
  if(item.disclosure!==null&&!["HUMAN","AI_ASSISTED","AI_GENERATED","AI_DERIVATIVE"].includes(item.disclosure))throw Error("INVALID_DISCLOSURE");
  const prev=this.events.get(item.id);if(prev){if(hash(prev)!==hash(item))throw Error("REPLAY_CONFLICT");return false}
  this.events.set(item.id,item);return true;
 }
 rebuild({checkpoint,sourceReady=true,includePrivateForAccount=null}={}){
  if(!validRef(checkpoint)||!sourceReady)throw Error("STALE_CHECKPOINT");
  const eligible=[...this.events.values()].filter(x=>x.sourceCheckpoint===checkpoint&&x.finalized&&x.sourceReady&&!x.deleted).filter(x=>{if(!["FOLLOW_ACTIVITY","COMMUNITY_ACTIVITY"].includes(x.type))return true;if(!this.production)return true;return this.allowCommunityEvent({objectId:x.objectId,creatorId:x.creatorId,recipientAccount:x.recipientAccount,type:x.type,checkpoint})===true;}).sort((a,b)=>a.at-b.at||a.id.localeCompare(b.id,"en"));
  const notifications=[],search=[],explorer=[],analytics={generation:{completed:0,failed:0,reviewReady:0},community:{activities:0},awards:{nominations:0,votes:0,wins:0,prizeStatuses:0}};
  for(const x of eligible){
   const isPublic=publicEvent(x), recipient=x.recipientAccount;
   const audience=isPublic?"PUBLIC":recipient&&recipient===includePrivateForAccount&&typeof this.authorizePrivate==="function"&&this.authorizePrivate({account:recipient,eventId:x.id,checkpoint})===true?"ACCOUNT":"NONE";
   if(audience!=="NONE")notifications.push({id:x.id,type:x.type,objectId:x.objectId,audience,sourceCheckpoint:checkpoint});
   if(x.type==="GENERATION_COMPLETED")analytics.generation.completed++;
   if(x.type==="GENERATION_FAILED")analytics.generation.failed++;
   if(x.type==="PROJECT_READY_FOR_REVIEW")analytics.generation.reviewReady++;
   if(["FOLLOW_ACTIVITY","COMMUNITY_ACTIVITY"].includes(x.type))analytics.community.activities++;
   if(x.type==="NOMINATION_RECEIVED")analytics.awards.nominations++;
   if(x.type==="AWARD_WON")analytics.awards.wins++;
   if(x.type==="PRIZE_SETTLEMENT_STATUS")analytics.awards.prizeStatuses++;
   if(!isPublic)continue;
   if(x.type==="RELEASE_PUBLISHED"&&x.recordingId)search.push({objectId:x.objectId,recordingId:x.recordingId,creatorId:x.creatorId,disclosure:x.disclosure,kind:"RECORDING",sourceCheckpoint:checkpoint});
   if(x.type==="AWARD_WON")search.push({objectId:x.objectId,recordingId:x.recordingId,creatorId:x.creatorId,awardCategory:x.awardCategory,kind:"AWARD_RESULT",sourceCheckpoint:checkpoint});
   if(["RELEASE_PUBLISHED","AWARD_WON","PRIZE_SETTLEMENT_STATUS"].includes(x.type))explorer.push({objectId:x.objectId,type:x.type,commitment:x.commitment,sourceCheckpoint:checkpoint,status:x.status});
  }
  // Public Analytics never exposes a private audience or individual recording.
  const pub=eligible.filter(publicEvent);
  const aggregate={generation:{completed:pub.filter(x=>x.type==="GENERATION_COMPLETED").length,failed:pub.filter(x=>x.type==="GENERATION_FAILED").length},community:{activities:pub.filter(x=>["FOLLOW_ACTIVITY","COMMUNITY_ACTIVITY"].includes(x.type)).length},awards:{nominations:pub.filter(x=>x.type==="NOMINATION_RECEIVED").length,wins:pub.filter(x=>x.type==="AWARD_WON").length,prizeStatuses:pub.filter(x=>x.type==="PRIZE_SETTLEMENT_STATUS").length}};
  const result={checkpoint,notifications,search,explorer,publicAnalytics:aggregate,sourceStatus:"FINALIZED"};
  return {...clean(result),resultCommitment:hash(result)};
 }
}
