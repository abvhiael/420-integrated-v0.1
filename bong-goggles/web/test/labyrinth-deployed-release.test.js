import test from 'node:test';
import assert from 'node:assert/strict';
import {BC28_LABYRINTH_HASH,verifyBC28LabyrinthLiveView,legalBC28LabyrinthMove}
 from './live-classics/labyrinth-cribbage.mjs';
import {verifyBC28PublicPreflight,BC28_ORIGIN} from './live-classics/labyrinth-public-preflight.mjs';
const id='10000000-1111-4111-8111-111111111111';
const room='20000000-2222-4222-8222-222222222222';
const view=()=>({id,roomId:room,gameId:'labyrinth-cribbage',
 rulesVersion:'v2.0',rulesHash:BC28_LABYRINTH_HASH,seatCount:2,sequence:1,
 status:'active',viewerSeat:0,turnSeat:0,winnerSeat:null,
 privateView:{seat:0,variant:'labyrinth-2p',scores:[0,0],phase:'discard',
 hand:[0,1,2,3,4,5,6,7,8],pegCount:0}});
const fail=fn=>assert.throws(fn,/BC-2.8 real Labyrinth Cribbage acceptance/);
test('BC-2.8 production live adapter recognizes only pinned 325-point two-human rule identity',()=>{
 const s=view();assert.equal(verifyBC28LabyrinthLiveView(s),s);
 assert.deepEqual(legalBC28LabyrinthMove(s),{type:'discard',cards:[0,1,2]});
 fail(()=>verifyBC28LabyrinthLiveView({...s,rulesVersion:'v1.0'}));
 fail(()=>verifyBC28LabyrinthLiveView({...s,rulesHash:'f'.repeat(64)}));
 fail(()=>verifyBC28LabyrinthLiveView({...s,seatCount:4}));
 fail(()=>verifyBC28LabyrinthLiveView({...s,privateView:{...s.privateView,variant:'labyrinth-4p-individual'}}));
 fail(()=>verifyBC28LabyrinthLiveView({...s,privateView:{...s.privateView,seed:'hidden'}}));
 fail(()=>verifyBC28LabyrinthLiveView({...s,privateView:{...s.privateView,hand:[0,0,1]}}));
});
test('BC-2.8 live adapter never submits opponent, non-turn, malformed or forged cards',()=>{
 const s=view();
 fail(()=>legalBC28LabyrinthMove({...s,turnSeat:1}));
 fail(()=>legalBC28LabyrinthMove({...s,privateView:{...s.privateView,hand:[0,1,52]}}));
 assert.deepEqual(legalBC28LabyrinthMove({...s,privateView:{...s.privateView,
  phase:'peg',hand:[0,3],pegCount:30}}),{type:'play',card:0});
 assert.deepEqual(legalBC28LabyrinthMove({...s,privateView:{...s.privateView,
  phase:'peg',hand:[9,10],pegCount:30}}),{type:'go'});
});
const fake=(flags={accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true},
 ready=true)=>async url=>{
 const path=url.slice(BC28_ORIGIN.length);
 const body=path==='/runtime-config.json'?JSON.stringify({appOrigin:BC28_ORIGIN,features:flags}):
  path==='/social-api/healthz'?JSON.stringify({ready}):'<main>Labyrinth Cribbage</main>';
 return new Response(body,{status:200,headers:{'content-type':path==='/games/labyrinth-cribbage'?'text/html':'application/json'}});
};
test('BC-2.8 public target preflight is READ-ONLY and never grants release authorization',async()=>{
 const result=await verifyBC28PublicPreflight({fetchImpl:fake()});
 assert.equal(result.notLiveMatchEvidence,true);
 assert.equal(result.publicRoute,true);
 assert.equal(result.workerReady,true);
});
test('BC-2.8 refuses Pages flags off, dead Worker, invalid origin and non-JSON responses',async()=>{
 await assert.rejects(verifyBC28PublicPreflight({fetchImpl:fake({accountSocial:true,
  accountGames:true,classicRooms:false,classicCommunications:true})}),/classicRooms/);
 await assert.rejects(verifyBC28PublicPreflight({fetchImpl:fake(undefined,false)}),/not ready/);
 await assert.rejects(verifyBC28PublicPreflight({fetchImpl:fake(),origin:'https://attacker.invalid'}),/hostname/);
 await assert.rejects(verifyBC28PublicPreflight({fetchImpl:async()=>new Response('offline',{status:503})}),/HTTP 200/);
});
