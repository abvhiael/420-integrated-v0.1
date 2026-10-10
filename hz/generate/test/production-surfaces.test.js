import test from "node:test";
import assert from "node:assert/strict";
import {createProductionSurfaces420} from "../src/production-surfaces.js";
import {Charts420} from "../src/charts.js";
const source={creator:id=>({id,status:"ACTIVE",visibility:"PUBLIC"}),recording:id=>({id,status:"ACTIVE",visibility:"PUBLIC"})};
const deps=()=>({
 wallet:{verifySession:()=>true,verifyCommunitySession:()=>true},
 creative:{verifyAuthorization:()=>true},
 provider:{verifyResult:()=>true},
 identity:{verifyEligibility:()=>({eligible:false})},
 replayStore:{consumeOnce:()=>true},rateStore:{consumeQuota:()=>true},
 communitySource:source,chartRecording:id=>({id,status:"PUBLISHED",visibility:"PUBLIC",creatorId:"artist"}),
 chartCreator:id=>({id,visibility:"PUBLIC"}),awardDomain:{},
 awardSource:()=>({status:"PUBLISHED",visibility:"PUBLIC"}),
 awardAuthorize:()=>true,abuse:{verifyAction:()=>true},
 playback:{verifyQualifiedPlay:()=>true},checkpoint:{verifyFinalized:()=>true},
 crossService:{verifySource:()=>true,authorizePrivate:()=>false},
 moderation:{allowCommunityEvent:()=>false}
});
test("M4 production graph fails closed if any trust boundary is absent",()=>{
 for(const [part,key] of [["wallet","verifyCommunitySession"],["playback","verifyQualifiedPlay"],["checkpoint","verifyFinalized"],["crossService","verifySource"],["crossService","authorizePrivate"],["moderation","allowCommunityEvent"],["abuse","verifyAction"]]){
  const x=deps();delete x[part][key];assert.throws(()=>createProductionSurfaces420(x),/REQUIRED/);
 }
 assert.throws(()=>new Charts420({recording:()=>null,creator:()=>null,production:true}),/PRODUCTION_CHART_AUTHORITIES_REQUIRED/);
});
test("M4 production graph enforces session, anti-fraud play and social suppression",()=>{
 const x=deps();x.wallet.verifyCommunitySession=()=>false;x.playback.verifyQualifiedPlay=()=>false;
 const graph=createProductionSurfaces420(x);
 const session={verified:true,scope:"420hz:community:write",accountRef:"alice",domain:"420hz",expiresAt:Date.now()+100000};
 assert.throws(()=>graph.createCommunity().follow(session,"artist"),/SESSION_UNVERIFIED/);
 const chart=graph.createCharts();
 assert.throws(()=>chart.ingest({id:"play1",recordingId:"song",signal:"QUALIFIED_PLAY",at:1,checkpoint:"cp",listenerToken:"listener",public:true}),/UNVERIFIED_QUALIFICATION/);
 const projections=graph.createCrossService();
 projections.ingest({id:"social",objectId:"artist",type:"FOLLOW_ACTIVITY",sourceCheckpoint:"cp",at:1,visibility:"PUBLIC",finalized:true,sourceReady:true});
 assert.equal(projections.rebuild({checkpoint:"cp"}).notifications.length,0);
 assert.equal(projections.rebuild({checkpoint:"cp"}).publicAnalytics.community.activities,0);
});
