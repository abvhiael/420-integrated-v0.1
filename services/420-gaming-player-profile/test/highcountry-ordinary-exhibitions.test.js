import test from 'node:test';
import assert from 'node:assert/strict';
import {createOrdinaryExhibitions420} from '../src/highcountry-ordinary-exhibitions.js';
const H='0x'+'a'.repeat(64);
function fixture(){
 let time=1000;
 const seasons=new Map([['season',{organizer:'organizer',opensAt:1100,closesAt:3000,cancelled:false}]]);
 const policies=new Map([['flower:1',{rulesHash:H,walletRequired:false,scope:null}]]);
 const events=new Map(),entries=new Map(),results=new Map(),claims=new Set(),rejections=new Map(),audit=[];
 const key=(e,a)=>e+':'+a;
 const tx={
  season:async id=>seasons.get(id),category:async(c,v)=>policies.get(c+':'+v),
  event:async id=>events.get(id),lockEvent:async id=>events.get(id),
  insertEvent:async e=>{events.set(e.eventId,e);},
  entry:async(e,a)=>entries.has(key(e,a)),entryCount:async e=>[...entries.keys()].filter(v=>v.startsWith(e+':')).length,
  insertEntry:async(e,a)=>{entries.set(key(e,a),true);},
  result:async(e,a)=>results.get(key(e,a)),harvestClaim:async(e,h)=>claims.has(key(e,h)),
  insertResult:async r=>{results.set(key(r.eventId,r.accountId),r);claims.add(key(r.eventId,r.harvestId));},
  results:async e=>[...results.values()].filter(r=>r.eventId===e),
  isAdjudicator:async a=>a==='judge',
  rejectResult:async(e,a,reason)=>{results.get(key(e,a)).rejected=true;rejections.set(key(e,a),reason);},
  recordAdjudication:async o=>{if(audit.some(x=>x.eventId===o.eventId&&x.accountId===o.accountId&&
    (x.disposition.startsWith('POST_FINAL')&&o.disposition.startsWith('POST_FINAL')||x.disposition===o.disposition)))
    throw Error('exhibition-conflict');audit.push({...o});},
  adjudicationHistory:async eventId=>audit.filter(x=>x.eventId===eventId),
  finalizeEvent:async outcome=>{Object.assign(events.get(outcome.eventId),outcome,{finalized:true});}
 };
 const proofs=new Map();
 const svc=createOrdinaryExhibitions420({
  repository:{transaction:async fn=>fn(tx)},
  identity:{verify:async token=>({accountId:token,registered:token!=='guest',revoked:token==='revoked'})},
  harvest:{verifyFinalizedFlower:async({accountId,harvestId})=>{
   const p=proofs.get(harvestId);return p?.accountId===accountId?p:null;}},
  clock:()=>time
 });
 return {svc,proofs,events,audit,setTime:x=>{time=x;},policies,tx};
}
const exhibition={token:'organizer',eventId:'ex1',seasonId:'season',category:'flower',version:1,
 rulesHash:H,opensAt:1200,closesAt:2000,challengeUntil:2200};
const proof=(accountId,harvestId,qualityBps,finalizedAt=1300)=>({accountId,harvestId,qualityBps,finalizedAt,provenanceHash:H});
test('wallet-free registered accounts join, verified harvest scores and deterministic finalization',async()=>{
 const x=fixture();await x.svc.create(exhibition);x.setTime(1300);
 await x.svc.enter({token:'alice',eventId:'ex1'});await x.svc.enter({token:'bob',eventId:'ex1'});
 x.proofs.set('a',proof('alice','a',9000));x.proofs.set('b',proof('bob','b',9000,1301));
 await x.svc.submit({token:'alice',eventId:'ex1',harvestId:'a'});
 x.setTime(1400);await x.svc.submit({token:'bob',eventId:'ex1',harvestId:'b'});
 x.setTime(2200);const result=await x.svc.finalize({eventId:'ex1'});
 assert.equal(result.winner,'alice');assert.equal(result.winnerScore,9000);
 await assert.rejects(x.svc.finalize({eventId:'ex1'}),/finalization-denied/);
});
test('guest registration, duplicate entry, forged and pre-event evidence denied',async()=>{
 const x=fixture();await x.svc.create(exhibition);x.setTime(1300);
 await assert.rejects(x.svc.enter({token:'guest',eventId:'ex1'}),/authentication-denied/);
 await x.svc.enter({token:'alice',eventId:'ex1'});
 await assert.rejects(x.svc.enter({token:'alice',eventId:'ex1'}),/duplicate-entry/);
 await assert.rejects(x.svc.submit({token:'alice',eventId:'ex1',harvestId:'fake'}),/evidence-denied/);
 x.proofs.set('old',proof('alice','old',10000,1199));
 await assert.rejects(x.svc.submit({token:'alice',eventId:'ex1',harvestId:'old'}),/evidence-denied/);
});
test('independent adjudication and revoked finality cannot produce a winner',async()=>{
 const x=fixture();await x.svc.create(exhibition);x.setTime(1300);
 await x.svc.enter({token:'alice',eventId:'ex1'});x.proofs.set('a',proof('alice','a',9000));
 await x.svc.submit({token:'alice',eventId:'ex1',harvestId:'a'});
 await assert.rejects(x.svc.reject({token:'alice',eventId:'ex1',accountId:'alice',reasonHash:H}),/adjudicator-denied/);
 await x.svc.reject({token:'judge',eventId:'ex1',accountId:'alice',reasonHash:H});
 x.setTime(2200);assert.equal((await x.svc.finalize({eventId:'ex1'})).winner,null);
 const y=fixture();await y.svc.create(exhibition);y.setTime(1300);
 await y.svc.enter({token:'alice',eventId:'ex1'});y.proofs.set('a',proof('alice','a',9000));
 await y.svc.submit({token:'alice',eventId:'ex1',harvestId:'a'});y.proofs.delete('a');
 y.setTime(2200);assert.equal((await y.svc.finalize({eventId:'ex1'})).winner,null);
});
test('optional wallet-gated templates and unauthorized event creators rejected',async()=>{
 const x=fixture();
 await assert.rejects(x.svc.create({...exhibition,token:'alice'}),/event-not-eligible/);
 x.policies.set('flower:1',{rulesHash:H,walletRequired:true,scope:'token'});
 await assert.rejects(x.svc.create(exhibition),/event-not-eligible/);
});

test('immutable post-final review records authorization, history and exact provenance',async()=>{
 const x=fixture();await x.svc.create(exhibition);x.setTime(1300);
 await x.svc.enter({token:'alice',eventId:'ex1'});x.proofs.set('a',proof('alice','a',9000));
 await x.svc.submit({token:'alice',eventId:'ex1',harvestId:'a'});
 x.setTime(2200);await x.svc.finalize({eventId:'ex1'});
 await assert.rejects(x.svc.review({token:'alice',eventId:'ex1',accountId:'alice',reasonHash:H}),/adjudicator-denied/);
 x.proofs.delete('a');
 const finding=await x.svc.review({token:'judge',eventId:'ex1',accountId:'alice',reasonHash:H});
 assert.equal(finding.disposition,'POST_FINAL_INVALID');
 assert.equal(finding.originalWinner,'alice');
 assert.equal((await x.svc.status({token:'alice',eventId:'ex1'})).winner,'alice');
 assert.equal((await x.svc.adjudicationHistory({token:'judge',eventId:'ex1'})).length,1);
 await assert.rejects(x.svc.adjudicationHistory({token:'alice',eventId:'ex1'}),/adjudicator-denied/);
 await assert.rejects(x.svc.review({token:'judge',eventId:'ex1',accountId:'alice',reasonHash:H}),/exhibition-conflict/);
});
test('pre-final rejection is audited and late challenges denied',async()=>{
 const x=fixture();await x.svc.create(exhibition);x.setTime(1300);
 await x.svc.enter({token:'alice',eventId:'ex1'});x.proofs.set('a',proof('alice','a',9000));
 await x.svc.submit({token:'alice',eventId:'ex1',harvestId:'a'});
 await x.svc.reject({token:'judge',eventId:'ex1',accountId:'alice',reasonHash:H});
 assert.equal(x.audit[0].disposition,'PRE_FINAL_REJECTION');
 x.setTime(2200);
 await assert.rejects(x.svc.reject({token:'judge',eventId:'ex1',accountId:'alice',reasonHash:H}),/dispute-closed/);
 assert.equal((await x.svc.finalize({eventId:'ex1'})).winner,null);
});
