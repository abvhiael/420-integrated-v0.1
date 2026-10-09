import {createHash} from "node:crypto";
const sha=x=>createHash("sha256").update(JSON.stringify(x)).digest("hex");
const required=x=>{if(typeof x!=="string"||!x||x.length>128)throw Error("INVALID_KEY");return x;};
export class AwardVoting420 {
 constructor({domain,source,authorize,verifyIdentity,verifyJury,publicSupport,verifyAbuse=null,production=false}={}){
  if(!domain||typeof source!=="function"||typeof authorize!=="function")throw Error("DEPENDENCIES_REQUIRED");
  if(production&&typeof verifyAbuse!=="function")throw Error("ABUSE_VERIFIER_REQUIRED");Object.assign(this,{domain,source,authorize,verifyIdentity,verifyJury,publicSupport,verifyAbuse,production});this.nominationKeys=new Map();this.voteKeys=new Map();this.accepted=new Map();this.audit=[];
 }
 actor(context,action){if(this.authorize(context,action)!==true)throw Error("UNAUTHORIZED");return required(context.account);}
 policy(categoryId){const c=this.domain.get(this.domain.categories,categoryId);const p=this.domain.get(this.domain.policies,c.policyId);const r=p.rules;
  for(const k of ["nominationMode","selfNomination","maxNominationsPerNominator","voterEligibility","quorumMode","quorumValue","winnerMode","winnerValue","tieMode","allowAbstain"]){if(r[k]===undefined)throw Error("INCOMPLETE_POLICY");}
  if(!["OPEN_SUBMISSION","CURATED_SUBMISSION","COMMUNITY_THRESHOLD"].includes(r.nominationMode)||!["ALLOWED","DISALLOWED"].includes(r.selfNomination)||!["WALLET_ONE_ACCOUNT_ONE_VOTE","IDENTITY_UNIQUE_ONE_VOTE","JURY_ONE_MEMBER_ONE_VOTE"].includes(r.voterEligibility)||!Number.isSafeInteger(r.maxNominationsPerNominator)||r.maxNominationsPerNominator<1||!Number.isSafeInteger(r.quorumValue)||r.quorumValue<1||!["MIN_VALID_VOTES","MIN_PARTICIPATION_BPS"].includes(r.quorumMode)||!["PLURALITY","MIN_SHARE_BPS"].includes(r.winnerMode)||!Number.isSafeInteger(r.winnerValue)||r.winnerValue<0||r.winnerValue>10000||!["CO_WINNERS","NO_WINNER","RUNOFF_REQUIRED"].includes(r.tieMode)||typeof r.allowAbstain!=="boolean")throw Error("INVALID_POLICY");
  if(r.nominationMode==="COMMUNITY_THRESHOLD"&&(!Number.isSafeInteger(r.thresholdValue)||r.thresholdValue<1||!required(r.thresholdType)))throw Error("INVALID_THRESHOLD");
  if(r.quorumMode==="MIN_PARTICIPATION_BPS"&&r.quorumValue>10000)throw Error("INVALID_QUORUM");
  if(r.voterEligibility==="IDENTITY_UNIQUE_ONE_VOTE"&&typeof this.verifyIdentity!=="function")throw Error("IDENTITY_NOT_QUALIFIED");
  if(r.voterEligibility==="JURY_ONE_MEMBER_ONE_VOTE"&&typeof this.verifyJury!=="function")throw Error("JURY_NOT_QUALIFIED");
  return {category:c,policy:p,rules:r};
 }
 eligible(category,targetId,at){const item=this.source(category.targetType,required(targetId));if(!item||(category.targetType==="RECORDING" ? item.status!=="PUBLISHED" : item.status!=="ACTIVE")||item.visibility!=="PUBLIC"||item.rightsBlocked||item.deleted||!Number.isSafeInteger(at))throw Error("SOURCE_NOT_ELIGIBLE");const r=this.policy(category.id).rules;
  if(category.targetType==="CREATOR_PROFILE"&&item.hasEligiblePublishedRecording!==true)throw Error("CREATOR_PUBLICATION_REQUIRED");
  if(r.releaseStart!==undefined&&(item.publishedAt<r.releaseStart||item.publishedAt>r.releaseEnd))throw Error("OUTSIDE_RELEASE_WINDOW");
  const compatible=r.aiClasses||null;if(compatible&&(!Array.isArray(compatible)||!compatible.includes(item.disclosure)))throw Error("DISCLOSURE_MISMATCH");
  return item;
 }
 nominate(context,{id,categoryId,targetId,at}){
  const actor=this.actor(context,"nominate"),{category:c,rules:r}=this.policy(categoryId),season=this.domain.get(this.domain.seasons,c.seasonId);
  if(season.state!=="NOMINATIONS_OPEN"||at<season.nominationStart||at>season.nominationEnd)throw Error("NOMINATIONS_CLOSED");
  const target=this.eligible(c,targetId,at);
  if(this.production&&this.verifyAbuse({action:"NOMINATE",actor,categoryId,targetId,at,seasonId:season.id})!==true)throw Error("NOMINATION_ABUSE");
  if(r.selfNomination==="DISALLOWED"&&target.owner===actor)throw Error("SELF_NOMINATION");
  if(r.nominationMode==="CURATED_SUBMISSION"&&context.curatorAuthorized!==true)throw Error("CURATOR_REQUIRED");
  if(r.nominationMode==="COMMUNITY_THRESHOLD"&&(typeof this.publicSupport!=="function"||this.publicSupport({category:c,targetId,at,thresholdType:r.thresholdType})<r.thresholdValue))throw Error("THRESHOLD_NOT_MET");
  const key=JSON.stringify([season.id,c.id,c.targetType,targetId,actor]);const previous=this.nominationKeys.get(key);
  if(previous){if(previous!==id)throw Error("DUPLICATE_NOMINATION");return this.domain.get(this.domain.nominations,id);}
  const prior=[...this.domain.nominations.values()].filter(n=>n.categoryId===categoryId&&n.nominatorRef===actor).length;
  if(prior>=r.maxNominationsPerNominator)throw Error("NOMINATION_CAP");
  const nomination=this.domain.nomination("admin",{id,seasonId:season.id,categoryId,targetType:c.targetType,targetId,eligibilityCommitment:sha([targetId,itemFingerprint(target)]),submittedAt:at,nominatorRef:actor});
  this.nominationKeys.set(key,id);return nomination;
 }
 accept(context,nominationId){this.actor(context,"curate");const n=this.domain.get(this.domain.nominations,nominationId);const s=this.domain.get(this.domain.seasons,n.seasonId);if(s.state!=="NOMINATIONS_OPEN"&&s.state!=="NOMINATIONS_CLOSED")throw Error("NOMINATIONS_LOCKED");this.eligible(this.domain.get(this.domain.categories,n.categoryId),n.targetId,s.nominationEnd);return this.domain.change("admin","nomination",n.id,"ACCEPTED");}
 freeze(context,{id,categoryId}){this.actor(context,"freeze");const {category:c}=this.policy(categoryId);const s=this.domain.get(this.domain.seasons,c.seasonId);if(s.state!=="NOMINATIONS_CLOSED")throw Error("NOMINATIONS_OPEN");
  const targets=new Map();for(const n of this.domain.nominations.values())if(n.categoryId===categoryId&&n.state==="ACCEPTED"){this.eligible(c,n.targetId,s.nominationEnd);const old=targets.get(n.targetId);if(!old||n.id.localeCompare(old)<0)targets.set(n.targetId,n.id);}
  if(!targets.size)throw Error("EMPTY_BALLOT");
  const b=this.domain.ballot("admin",{id,seasonId:s.id,categoryId,candidateIds:[...targets.values()]});return this.domain.change("admin","ballot",b.id,"FROZEN");
 }
 vote(context,{id,ballotId,targetId,at,proof}){
  const actor=this.actor(context,"vote"),b=this.domain.get(this.domain.ballots,ballotId),{rules:r,policy:p}=this.policy(b.categoryId),s=this.domain.get(this.domain.seasons,b.seasonId);
  if(b.state!=="OPEN"||s.state!=="VOTING_OPEN"||at<s.votingStart||at>s.votingEnd)throw Error("VOTE_CLOSED");
  const ids=b.candidateIds.map(n=>this.domain.get(this.domain.nominations,n).targetId);
  if(targetId!=="ABSTAIN"&&!ids.includes(targetId)||targetId==="ABSTAIN"&&!r.allowAbstain)throw Error("INVALID_CHOICE");
  if(this.production&&this.verifyAbuse({action:"VOTE",actor,ballotId,targetId,at,policyCommitment:p.commitment})!==true)throw Error("VOTE_ABUSE");
  let key=actor;
  const req={proof,actor,ballotId,policyCommitment:p.commitment,audience:"420hz-awards",at};
  if(r.voterEligibility==="IDENTITY_UNIQUE_ONE_VOTE"){const x=this.verifyIdentity(req);if(x?.eligible!==true||x.ballotId!==ballotId||x.policyCommitment!==p.commitment||x.audience!=="420hz-awards"||x.expiresAt<at||x.revoked)throw Error("IDENTITY_INVALID");key=required(x.nullifier);}
  if(r.voterEligibility==="JURY_ONE_MEMBER_ONE_VOTE"){const x=this.verifyJury(req);if(x?.eligible!==true||x.ballotId!==ballotId)throw Error("JURY_INVALID");key=required(x.memberKey);}
  const replay=JSON.stringify([ballotId,key]);const old=this.voteKeys.get(replay);if(old){if(old.targetId!==targetId||old.id!==id)throw Error("VOTE_REPLAY");return structuredClone(old);}
  const record=this.domain.vote("admin",{id,ballotId,voterEligibilityRef:sha([ballotId,key]),choiceCommitment:sha([ballotId,targetId,id]),replayDomain:sha([ballotId,p.commitment]),submittedAt:at});
  const fact={id:record.id,ballotId,targetId};this.voteKeys.set(replay,fact);this.accepted.set(id,{...fact,voter:sha([ballotId,key])});return structuredClone(fact);
 }
 finalize(context,{resultId,ballotId,at}){
  this.actor(context,"finalize");const b=this.domain.get(this.domain.ballots,ballotId),s=this.domain.get(this.domain.seasons,b.seasonId),{rules:r}=this.policy(b.categoryId);
  if(b.state!=="CLOSED"||s.state!=="VOTING_CLOSED"||at<s.votingEnd)throw Error("NOT_FINALIZABLE");
  for(const nominationId of b.candidateIds){const n=this.domain.get(this.domain.nominations,nominationId);this.eligible(this.domain.get(this.domain.categories,b.categoryId),n.targetId,at);}
  const votes=[...this.accepted.values()].filter(v=>v.ballotId===ballotId);const cast=votes.filter(v=>v.targetId!=="ABSTAIN");
  const count=new Map();for(const v of cast)count.set(v.targetId,(count.get(v.targetId)||0)+1);
  if(r.quorumMode==="MIN_VALID_VOTES"&&cast.length<r.quorumValue)throw Error("NO_QUORUM");
  if(r.quorumMode==="MIN_PARTICIPATION_BPS"){if(!Number.isSafeInteger(r.eligibleElectorate)||r.eligibleElectorate<1||votes.length*10000<r.quorumValue*r.eligibleElectorate)throw Error("NO_QUORUM");}
  const max=Math.max(0,...count.values());let winners=[...count].filter(([,n])=>n===max&&n>0).map(([id])=>id).sort();
  if(r.winnerMode==="MIN_SHARE_BPS"&&max*10000<r.winnerValue*cast.length)winners=[];
  if(winners.length>1){if(r.tieMode==="NO_WINNER")winners=[];if(r.tieMode==="RUNOFF_REQUIRED")throw Error("RUNOFF_REQUIRED");}
  const result=this.domain.result("admin",{id:resultId,ballotId,winnerTargetIds:winners,resultCommitment:sha([ballotId,cast.map(x=>x.id).sort(),winners,b.policyCommitment]),finalizedAt:at});
  this.domain.change("admin","ballot",ballotId,"FINALIZED");return result;
 }
}
function itemFingerprint(x){return [x.id,x.status,x.visibility,x.disclosure,x.publishedAt];}
