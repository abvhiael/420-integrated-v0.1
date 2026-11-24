import test from 'node:test';
import assert from 'node:assert/strict';
import {ChessSocialController,verifyChessHistory,renderChessSocial} from '../core/chess-social.js';
import {fixture,actor,id,roomId,envelope} from './chess-fixture.mjs';
const peer='22222222-2222-4222-8222-222222222222',now='2026-11-24T20:00:00Z';
const match={...fixture(),updatedAt:now,status:'finished',turnSeat:null,winnerSeat:0};
delete match.privateView;
const hist={matches:[match],invitations:[{roomId,inviter:peer,seat:1,expiresAt:now}]};
const room={id:roomId,host:actor,gameId:'chess',seatCount:2,visibility:'private',status:'open',revision:1,seats:[{index:0,controller:'human',subject:actor,team:0},{index:1,controller:'invited',subject:peer,team:1}],invites:[]};
test('BC-3.5 validate inbox and bind challenge/rematch to authenticated consent',async()=>{
 let user=actor,posts=[];
 const c=new ChessSocialController({enabled:true,fetchImpl:async(url,o)=>{
  let data,status=200;
  if(url.endsWith('/v1/me')){data={walletRequired:false,profile:{subject:user}};if(!user)status=401;}
  else if(url.endsWith('/history-chess'))data=envelope({history:hist}).data;
  else if(url.endsWith('/friends'))data={onChain:false,friends:[{subject:peer,displayName:'Friend'}]};
  else {posts.push({url,body:JSON.parse(o.body)});status=201;data=envelope({room,playable:false}).data;}
  return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json'}});
 }});
 assert.ok(verifyChessHistory(envelope({history:hist})));
 assert.equal(verifyChessHistory(envelope({history:{...hist,invitations:[{...hist.invitations[0],seat:2}]}})),null);
 await c.refresh();assert.equal(c.state.status,'ready');
 assert.match(renderChessSocial(c.state),/Send Chess challenge/);
 assert.match(renderChessSocial(c.state),/Invite rematch/);
 assert.equal(await c.invite('challenge',actor),null);assert.equal(posts.length,0);
 assert.equal(await c.invite('challenge',peer),roomId);
 assert.equal(posts[0].body.target,peer);
 assert.equal(await c.invite('rematch',id),roomId);
 assert.match(posts[1].url,/\/rematch$/);
 user=null;await c.refresh();assert.equal(c.state.history,null);assert.equal(c.state.friends.length,0);
});
