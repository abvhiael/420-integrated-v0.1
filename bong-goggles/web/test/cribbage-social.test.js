import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCribbageHistory,verifyCribbageFriends,CribbageSocialController,
 renderCribbageSocial} from '../core/classic-cribbage-social.js';
import {renderCribbageRoute} from '../core/cribbage-ui.js';
import {CRIBBAGE_RULES_HASH} from '../core/cribbage-session.js';
const me='10000000-1111-4111-8111-111111111111';
const friend='20000000-2222-4222-8222-222222222222';
const room='30000000-3333-4333-8333-333333333333';
const match='40000000-4444-4444-8444-444444444444';
const flags={onChain:false,wager:false,rewards:false};
const matchItem=()=>({id:match,roomId:room,gameId:'cribbage',seatCount:2,
 status:'resigned',rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,
 sequence:2,viewerSeat:1,turnSeat:null,winnerSeat:1,scores:[0,0],
 updatedAt:'2026-11-22T22:00:00Z'});
const history=()=>({status:200,data:{...flags,history:{
 matches:[matchItem()],invitations:[{roomId:room,inviter:me,seat:1,expiresAt:'2026-11-23T22:00:00Z'}],
 stats:{sampleSize:1,completed:0,wins:1,losses:0}
}}});
const friends=()=>({status:200,data:{onChain:false,friends:[{subject:friend,displayName:'Friend <script>evil()</script>'}]}});
const response=(status,data)=>({status,ok:status>=200&&status<300,
 headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});
test('BC-1.6 only verified off-chain result summaries and escaped friend labels are rendered',()=>{
 const data=history(),safe=verifyCribbageHistory(data);
 assert.ok(safe);
 assert.equal(verifyCribbageHistory({...data,data:{...data.data,onChain:true}}),null);
 const changed=history();changed.data.history.matches[0].rulesHash='x';
 assert.equal(verifyCribbageHistory(changed),null);
 const poisoned=history();poisoned.data.history.matches[0].privateView={hand:[1,2],secret:'CANARY'};
 const normalized=verifyCribbageHistory(poisoned);
 assert.ok(normalized);assert.equal(normalized.matches[0].privateView,undefined);
 const peerList=verifyCribbageFriends(friends());
 const page=renderCribbageSocial({status:'ready',history:normalized,friends:peerList,viewer:me});
 assert.match(page,/Invite rematch/);
 assert.ok(!page.includes('CANARY')&&!page.includes('<script>'));
 assert.ok(page.includes('&lt;script&gt;'));
 const route=renderCribbageRoute({screen:'history',state:{status:'idle',social:{
  status:'ready',history:normalized,friends:peerList,viewer:me
 }}});
 assert.ok(route.includes('Pending invitations')&&!route.includes('CANARY'));
});
test('BC-1.6 420ID principal recheck, authenticated challenge and no POST retry',async()=>{
 const calls=[];
 const roomDetail={id:room,host:me,gameId:'cribbage',visibility:'private',seatCount:2,
 status:'open',revision:1,seats:[{index:0,controller:'human',subject:me,team:0},
 {index:1,controller:'invited',subject:friend,team:1}],invites:[{id:match,seat:1,target:friend,status:'pending'}]};
 const fetchImpl=async(url,opt)=>{
  calls.push({url,opt});
  const path=url.replace('/social-api','');
  if(path==='/v1/me')return response(200,{walletRequired:false,profile:{subject:me}});
  if(path==='/v1/classic-sessions/history')return response(200,history().data);
  if(path==='/v1/classic-rooms/friends')return response(200,friends().data);
  if(path==='/v1/classic-sessions/challenge')return response(201,{...flags,playable:false,room:roomDetail});
  throw Error('unknown path '+path);
 };
 const ctl=new CribbageSocialController({enabled:true,fetchImpl});
 await ctl.refresh();assert.equal(ctl.state.status,'ready');
 assert.equal(await ctl.invite('challenge',friend),room);
 const posts=calls.filter(c=>c.opt.method==='POST');
 assert.equal(posts.length,1);
 assert.equal(JSON.parse(posts[0].opt.body).target,friend);
 assert.equal(posts[0].opt.credentials,'same-origin');
 assert.ok(!('subject' in JSON.parse(posts[0].opt.body)));
 const switched=new CribbageSocialController({enabled:true,fetchImpl:async(url)=>{
  if(url.includes('/v1/me'))return response(200,{walletRequired:false,profile:{subject:friend}});
  throw Error('unexpected call');
 }});
 await switched.refresh();assert.equal(switched.state.status,'unavailable');
 assert.notEqual(switched.state.viewer,me);
});
