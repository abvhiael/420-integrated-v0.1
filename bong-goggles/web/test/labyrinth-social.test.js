import test from 'node:test';
import assert from 'node:assert/strict';
import {LabyrinthSocialController,verifyLabyrinthHistory,renderLabyrinthSocial} from '../core/labyrinth-social.js';
import {LABYRINTH_RULES_HASH} from '../core/labyrinth-session.js';
import {LABYRINTH_RULES_VERSION} from '../core/labyrinth-cribbage-ui.js';

const member='30000000-3333-4333-8333-333333333333';
const friend='40000000-4444-4444-8444-444444444444';
const match='10000000-1111-4111-8111-111111111111';
const room='20000000-2222-4222-8222-222222222222';
const session=(variantId='labyrinth-4p-individual')=>({
 id:match,roomId:room,gameId:'labyrinth-cribbage',rulesVersion:LABYRINTH_RULES_VERSION,
 rulesHash:LABYRINTH_RULES_HASH,seatCount:4,viewerSeat:2,sequence:2,
 status:'resigned',turnSeat:null,winnerSeat:0,
 scores:[80,45,25,0],updatedAt:'2026-11-23T22:40:00Z',variantId
});
const envelope=(v=session())=>({status:200,data:{onChain:false,wager:false,rewards:false,history:{
 matches:[v],invitations:[{roomId:room,seat:1,inviter:friend,expiresAt:'2026-11-24T22:00:00Z'}],
 stats:{sampleSize:1,completed:0,wins:0,losses:1}
}}});
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
test('BC-2.6 accepts only 325-point, zero-wager history and immutable team variants',()=>{
 assert.ok(verifyLabyrinthHistory(envelope()));
 assert.ok(verifyLabyrinthHistory(envelope(session('labyrinth-4p-partners'))));
 assert.equal(verifyLabyrinthHistory(envelope({...session(),rulesHash:'0'.repeat(64)})),null);
 assert.equal(verifyLabyrinthHistory(envelope({...session(),variantId:'unexpected'})),null);
 assert.equal(verifyLabyrinthHistory(envelope({...session(),deck:[1,2]}))?.matches[0].deck,undefined);
 assert.equal(verifyLabyrinthHistory({...envelope(),data:{...envelope().data,rewards:true}}),null);
 assert.equal(verifyLabyrinthHistory(envelope({...session(),scores:[1,2]})),null);
 assert.equal(verifyLabyrinthHistory(envelope({...session(),updatedAt:'bad timestamp'})),null);
});
test('BC-2.6 individual results never claim a partnership victory and invitations are in-app notifications',()=>{
 const state={status:'ready',viewer:member,history:verifyLabyrinthHistory(envelope()),friends:[{subject:friend,displayName:'My Friend'}]};
 const html=renderLabyrinthSocial(state);
 assert.match(html,/Another seat won/);
 assert.doesNotMatch(html,/Your side won/);
 assert.match(html,/My Friend/);
 assert.match(html,/pending invitation/);
 assert.match(html,/Past matches and statistics/);
 assert.match(html,/games\/rooms/);
 assert.doesNotMatch(html,/privateView|seed|deck|opponentHand|on-chain payout/);
 const partner=renderLabyrinthSocial({...state,history:verifyLabyrinthHistory(envelope(session('labyrinth-4p-partners')))});
 assert.match(partner,/Your side won/);
});
test('BC-2.6 verified friend challenge binds authenticated actor and rejects optimistic rooms',async()=>{
 let actor=member,body,requests=0;
 const social={onChain:false,wager:false,rewards:false,playable:false,room:{
  id:room,host:member,gameId:'labyrinth-cribbage',visibility:'private',seatCount:2,status:'open',
  revision:1,variantId:'labyrinth-2p',
  seats:[{index:0,controller:'human',subject:member,team:0},{index:1,controller:'invited',subject:friend,team:1}],
  invites:[{id:'60000000-6666-4666-8666-666666666666',seat:1,target:friend,status:'pending'}]
 }};
 const fetchImpl=async(url,options={})=>{
  const path=new URL(url,'https://local.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return json({walletRequired:false,profile:{subject:actor}});
  if(path==='/v1/classic-sessions/history-labyrinth')return json(envelope().data);
  if(path==='/v1/classic-rooms/friends')return json({onChain:false,friends:[{subject:friend,displayName:'My Friend'}]});
  if(path==='/v1/classic-sessions/challenge-labyrinth'){
   requests++;body=JSON.parse(options.body);assert.equal(options.method,'POST');
   return json(social,201);
  }
  throw Error(path);
 };
 const ctl=new LabyrinthSocialController({enabled:true,fetchImpl});
 await ctl.refresh();assert.equal(ctl.state.status,'ready');
 await assert.rejects(ctl.invite('challenge',member),/Mutual/);
 assert.equal(requests,0);
 assert.equal(await ctl.invite('challenge',friend),room);
 assert.equal(body.target,friend);assert.ok(body.requestId);
 actor=friend;
 assert.equal(await ctl.invite('challenge',friend),null);
 assert.equal(requests,2);
});
test('BC-2.6 revoked 420ID invalidates private history and suppresses notices',async()=>{
 let valid=true;
 const ctl=new LabyrinthSocialController({enabled:true,fetchImpl:async url=>{
  const path=new URL(url,'https://local.test').pathname.replace(/^\/social-api/,'');
  if(path==='/v1/me')return valid?json({walletRequired:false,profile:{subject:member}}):json({},401);
  if(path==='/v1/classic-sessions/history-labyrinth')return json(envelope().data);
  if(path==='/v1/classic-rooms/friends')return json({onChain:false,friends:[]});
  throw Error(path);
 }});
 await ctl.refresh();assert.equal(ctl.state.history.matches.length,1);
 valid=false;await ctl.refresh();
 assert.equal(ctl.state.status,'guest');assert.equal(ctl.state.history,null);
 assert.doesNotMatch(renderLabyrinthSocial(ctl.state),/scores|My Friend|pending invitation/);
});
