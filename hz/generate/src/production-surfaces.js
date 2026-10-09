// Explicit fail-closed composition for repository-side 420Hz M4 surfaces.
// These adapters are contracts, not deployed canonical service implementations.
import {createProductionSecurity420} from "./production-security.js";
import {CommunityStore420} from "./community.js";
import {Charts420} from "./charts.js";
import {AwardVoting420} from "./award-voting.js";
import {HzCrossService420} from "./cross-service.js";

const need=(fn,name)=>{if(typeof fn!=="function")throw Error(name+"_REQUIRED");return fn;};
export function createProductionSurfaces420({wallet,creative,provider,identity,replayStore,rateStore,communitySource,chartRecording,chartCreator,awardDomain,awardSource,awardAuthorize,abuse,playback,checkpoint,crossService,moderation,clock}={}){
 const core=createProductionSecurity420({wallet,creative,provider,identity,replayStore,rateStore,clock});
 const verifyCommunity=need(wallet?.verifyCommunitySession,"COMMUNITY_SESSION_AUTHORITY");
 const verifyPlay=need(playback?.verifyQualifiedPlay,"QUALIFIED_PLAY_AUTHORITY");
 const verifyCheckpoint=need(checkpoint?.verifyFinalized,"CHECKPOINT_AUTHORITY");
 const verifyEvent=need(crossService?.verifySource,"CROSS_SERVICE_AUTHORITY");
 const verifyPrivate=need(crossService?.authorizePrivate,"PRIVATE_READ_AUTHORITY");
 const allowSocial=need(moderation?.allowCommunityEvent,"COMMUNITY_MODERATION_AUTHORITY");
 const verifyAbuse=need(abuse?.verifyAction,"ABUSE_AUTHORITY");
 const authorizeAward=need(awardAuthorize,"AWARDS_AUTHORIZATION");
 const getAwardSource=need(awardSource,"AWARDS_SOURCE");
 if(!communitySource||!awardDomain)throw Error("DOMAIN_SOURCES_REQUIRED");
 return Object.freeze({
  security:core,
  createCommunity:()=>new CommunityStore420({source:communitySource,production:true,verifySession:req=>verifyCommunity(req)===true,now:clock}),
  createCharts:()=>new Charts420({recording:chartRecording,creator:chartCreator,qualification:e=>verifyPlay({...e,audience:"420hz-charts"})===true,verifyCheckpoint:cp=>verifyCheckpoint({checkpoint:cp,audience:"420hz-charts"})===true,production:true}),
  createAwards:()=>new AwardVoting420({domain:awardDomain,source:getAwardSource,authorize:(context,action)=>authorizeAward({context,action,audience:"420hz-awards"})===true,verifyIdentity:req=>core.verifyIdentity(req),verifyAbuse:req=>verifyAbuse({...req,audience:"420hz-awards"})===true,production:true}),
  createCrossService:()=>new HzCrossService420({verifySource:event=>verifyEvent({...event,audience:"420hz-cross-service"})===true,authorizePrivate:req=>verifyPrivate({...req,audience:"420hz-cross-service"})===true,allowCommunityEvent:req=>allowSocial({...req,audience:"420hz-cross-service"})===true,production:true}),
  createJobManager:opts=>core.createJobManager(opts)
 });
}
