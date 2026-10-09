import test from "node:test";
import assert from "node:assert/strict";
import {createProductionSecurity420} from "../src/production-security.js";
import {HzCrossService420} from "../src/cross-service.js";
import {Charts420} from "../src/charts.js";
import {RegisterPublishCoordinator420} from "../src/register-publish.js";
import {AwardVoting420} from "../src/award-voting.js";
const deps=()=>({wallet:{verifySession:()=>true},creative:{verifyAuthorization:()=>true},provider:{verifyResult:()=>true},identity:{verifyEligibility:()=>({eligible:true})},replayStore:{consumeOnce:()=>true},rateStore:{consumeQuota:()=>true},clock:()=>100});
test("production composition rejects absent source authorities and non-atomic stores",()=>{
 for(const key of ["wallet","creative","provider","identity","replayStore","rateStore"]){const o=deps();delete o[key];assert.throws(()=>createProductionSecurity420(o),/REQUIRED/);}
});
test("trusted wallet, rights, quota and replay must all pass",()=>{
 const d=deps(),seen=new Set();d.replayStore.consumeOnce=({key})=>!seen.has(key)&&Boolean(seen.add(key));
 const s=createProductionSecurity420(d),req={actor:"a",scope:"generate",id:"g",nonce:"n",expiry:500,resource:"r",proof:"signed",rightsProof:"license"};
 assert.equal(s.guard(req).authorized,true);
 assert.throws(()=>s.guard(req),/REPLAY/);
 d.wallet.verifySession=()=>false;
 assert.throws(()=>createProductionSecurity420(d).guard({...req,nonce:"fresh"}),/UNAUTHORIZED/);
 d.wallet.verifySession=()=>true;
 d.creative.verifyAuthorization=()=>false;
 assert.throws(()=>createProductionSecurity420(d).guard({...req,nonce:"fresh"}),/RIGHTS_UNVERIFIED/);
 d.rateStore.consumeQuota=()=>false;
 assert.throws(()=>createProductionSecurity420({...deps(),rateStore:d.rateStore}).guard({...req,nonce:"fresh"}),/QUOTA_EXCEEDED/);
});
test("private cross-service notification requires an authenticated recipient",()=>{
 const events=new HzCrossService420({verifySource:()=>true});
 events.ingest({id:"ev1",objectId:"obj1",sourceCheckpoint:"cp1",type:"GENERATION_COMPLETED",at:10,visibility:"PRIVATE",finalized:true,sourceReady:true,recipientAccount:"alice"});
 assert.equal(events.rebuild({checkpoint:"cp1",includePrivateForAccount:"alice"}).notifications.length,0);
 const secure=new HzCrossService420({verifySource:()=>true,authorizePrivate:({account})=>account==="alice"});
 secure.ingest({id:"ev1",objectId:"obj1",sourceCheckpoint:"cp1",type:"GENERATION_COMPLETED",at:10,visibility:"PRIVATE",finalized:true,sourceReady:true,recipientAccount:"alice"});
 assert.equal(secure.rebuild({checkpoint:"cp1",includePrivateForAccount:"alice"}).notifications.length,1);
 assert.equal(secure.rebuild({checkpoint:"cp1",includePrivateForAccount:"mallory"}).notifications.length,0);
 assert.equal(secure.rebuild({checkpoint:"cp1"}).search.length,0);
});
test("charts reject untrusted checkpoints and source-owned inflation",()=>{
 const chart=new Charts420({recording:()=>({status:"PUBLISHED",visibility:"PUBLIC",creatorId:"c"}),creator:()=>({visibility:"PUBLIC"}),qualification:()=>true,verifyCheckpoint:()=>false});
 assert.throws(()=>chart.snapshot({windowEnd:1000,checkpoint:"cp1"}),/STALE_SOURCE/);
 assert.throws(()=>chart.ingest({id:"e",recordingId:"r",checkpoint:"cp1",at:10,signal:"QUALIFIED_PLAY",listenerToken:"tok",actorAccount:"a",sourceOwner:"a"}),/SELF_INFLATION/);
});
test("production publish and voting refuse missing trusted authority adapters",()=>{
 assert.throws(()=>new RegisterPublishCoordinator420({production:true}),/Creative rights verifier required/);
 assert.throws(()=>new AwardVoting420({production:true,domain:{},source:()=>true,authorize:()=>true}),/ABUSE_VERIFIER_REQUIRED/);
});
