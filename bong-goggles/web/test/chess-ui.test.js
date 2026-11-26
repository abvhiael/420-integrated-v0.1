import test from 'node:test';
import assert from 'node:assert/strict';
import {id,roomId,actor,fixture,envelope} from './chess-fixture.mjs';
import {normalizeChessSession,normalizeChessActions,ChessController} from '../core/chess-session.js';
import {renderChessScreen} from '../core/chess-ui.js';
import {renderApplicationShell} from '../core/app-shell.js';
test('BC-3.4 projection, action revision, seat and secret rejection',()=>{
 const s=normalizeChessSession(envelope({session:fixture()}),id);assert.ok(s);
 assert.equal(normalizeChessSession(envelope({session:{...fixture(),privateView:{...fixture().privateView,seed:'secret'}}}),id),null);
 assert.equal(normalizeChessSession(envelope({session:fixture()}),roomId),null);
 assert.equal(normalizeChessActions(envelope({sequence:2,actions:[]}),s),null);
 assert.equal(normalizeChessActions(envelope({sequence:1,actions:[{type:'move',uci:'e2e9'}]}),s),null);
 const black=normalizeChessSession(envelope({session:fixture(1)}),id);
 assert.equal(normalizeChessActions(envelope({sequence:1,actions:[{type:'move',uci:'e7e5'}]}),black),null);
 assert.deepEqual(normalizeChessActions(envelope({sequence:1,actions:[{type:'resign'}]}),black),[{type:'resign'}]);
});
test('BC-3.4 board orientation, legal target, promotion, terminal and release lock',()=>{
 const session=normalizeChessSession(envelope({session:fixture()}),id);
 const state={status:'ready',session,actions:[{type:'move',uci:'e2e4'}],selected:'e2'};
 const html=renderChessScreen('play',state);
 assert.equal((html.match(/data-chess-square=/g)||[]).length,64);
 assert.match(html,/data-chess-square="a8"/);assert.match(html,/class="chess-square dark[^"]*" data-chess-square="a1"/);
 assert.match(html,/class="chess-square [^"]*target[^"]*" data-chess-square="e4"/);
 assert.match(renderChessScreen('play',{...state,flipped:true}),/data-chess-square="h1"/);
 assert.match(renderChessScreen('play',{...state,promotion:[{uci:'a7a8n'}]}),/Knight/);
 const ended=fixture();Object.assign(ended,{status:'finished',turnSeat:null,winnerSeat:0});Object.assign(ended.privateView,{terminal:true,turn:-1,phase:'finished',winner:0,reason:'checkmate'});
 const terminal=normalizeChessSession(envelope({session:ended}),id);assert.ok(terminal);
 assert.match(renderChessScreen('play',{status:'ready',session:terminal,actions:[]}),/White wins/);
 assert.doesNotMatch(renderApplicationShell({pathname:'/games/chess/play',chessState:{status:'disabled'}}),/data-chess-start/);
 assert.match(renderApplicationShell({pathname:'/games/chess/play',chessState:state}),/data-chess-square/);
});
test('BC-3.4 no speculative moves, authoritative refresh and account revocation',async()=>{
 let subject=actor,seq=1,posts=0;
 const c=new ChessController({enabled:true,fetchImpl:async(url,opts)=>{
  let payload,status=200;
  if(url.endsWith('/v1/me')){payload={walletRequired:false,profile:{subject}};if(!subject)status=401;}
  else if(url.endsWith('/chess-actions'))payload=envelope({sequence:seq,actions:seq===1?[{type:'move',uci:'e2e4'}]:[{type:'resign'}]}).data;
  else {if(opts.method==='POST'){posts++;const b=JSON.parse(opts.body);assert.equal(b.expectedSequence,2);assert.deepEqual(b.move,{type:'move',uci:'e2e4'});seq++;}
   const s=fixture();s.sequence=seq;if(seq===2){s.turnSeat=1;s.privateView.turn=1;s.privateView.lastMove='e2e4';s.privateView.lastSAN='e4';}payload=envelope({session:s}).data;}
  return new Response(JSON.stringify(payload),{status,headers:{'content-type':'application/json'}});
 }});
 await c.refresh(id);assert.equal(c.state.status,'ready');
 await c.act({type:'move',uci:'e2e5'});assert.equal(posts,0);
 await c.act({type:'move',uci:'e2e4'});assert.equal(posts,1);assert.equal(c.state.session.sequence,2);
 subject=null;await c.refresh(id);assert.equal(c.state.session,null);assert.deepEqual(c.state.actions,[]);
});

import {validateRuntimeConfig} from '../core/runtime-config.js';
import {readFileSync} from 'node:fs';
test('BC-3 release requires explicit activation and all account dependencies in production',()=>{
 const config=JSON.parse(readFileSync(new URL('../runtime-config.example.json',import.meta.url),'utf8'));
 config.environment='production';
 config.features={...config.features,accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true,chessRestricted:true};
 assert.equal(validateRuntimeConfig(config).features.chessRestricted,true);
 for(const key of ['accountSocial','accountGames','classicRooms','classicCommunications','chessRestricted']){
  assert.equal(validateRuntimeConfig({...config,features:{...config.features,[key]:false}}).features.chessRestricted,false,key);
 }
 const disabled=renderApplicationShell({pathname:'/games/chess',chessState:{status:'disabled'}});
 assert.match(disabled,/not enabled in this deployment/);assert.match(disabled,/data-game-screen="intro"/);assert.doesNotMatch(disabled,/data-chess-start/);
 const setup=renderApplicationShell({pathname:'/games/chess/setup',chessState:{status:'disabled'}});
 assert.match(setup,/<fieldset disabled>/);assert.match(setup,/Seat 2/);assert.doesNotMatch(setup,/data-chess-start/);
});
