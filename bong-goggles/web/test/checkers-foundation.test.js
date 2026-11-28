import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCheckersState,checkersActivation} from '../core/checkers-protocol.js';
import {renderClassicGamePage} from '../core/games-ui.js';
import {resolveRoute} from '../core/routes.js';
import {validateRuntimeConfig} from '../core/runtime-config.js';
import {readFileSync} from 'node:fs';
const state=()=>({schema:'bg-checkers-state-v1',gameId:'checkers',rulesVersion:'v1',variant:'english-draughts',revision:0,board:Array.from({length:64},(_,i)=>(Math.floor(i/8)+i%8)%2===0?'':i<24?'b':i>=40?'r':''),phase:'active',turn:'black',winner:null,continuation:null});
test('Checkers state boundary rejects malformed and unauthorized-shaped projections',()=>{
 const s=state();const result=normalizeCheckersState(s);assert.ok(result);assert.ok(Object.isFrozen(result.board));
 for(const patch of [{schema:'v2'},{revision:-1},{board:[]},{turn:'white'},{winner:'red'},{continuation:40},{seed:'private'},{phase:'finished'}])assert.equal(normalizeCheckersState({...s,...patch}),null);
 const bad=state();bad.board[0]='b';assert.equal(normalizeCheckersState(bad),null);
 const sparse=state();delete sparse.board[0];assert.equal(normalizeCheckersState(sparse),null);
});
test('all Checkers routes render registered, non-playable artwork and shared account surface',()=>{
 for(const screen of ['intro','rules','play','setup','table','results','history','rematch']){
  const route=resolveRoute('/games/checkers'+(screen==='intro'?'':'/'+screen));
  assert.equal(route.gameId,'checkers');
  const html=renderClassicGamePage(route.gameId,{screen:route.screen,accountIdentityEnabled:true,accountIdentityState:{status:'error',temporary:true}});
  assert.match(html,/Gameplay not released/);assert.match(html,/checkers-board-coordinates.webp/);
  assert.match(html,/Reconnecting to your existing 420ID session/);
  assert.doesNotMatch(html,/data-checkers-start|data-checkers-move/);
 }
 assert.equal(resolveRoute('/games/checkers/unknown').id,'not-found');
});
test('public and production opt-ins fail closed',()=>{
 for(const mode of [undefined,'','disabled'])assert.equal(checkersActivation(mode),false);
 for(const mode of ['true','production','restricted-acceptance'])assert.throws(()=>checkersActivation(mode));
 const config=JSON.parse(readFileSync(new URL('../runtime-config.example.json',import.meta.url),'utf8'));
 config.features={...config.features,accountSocial:true,accountGames:true,classicRooms:true,classicCommunications:true,checkersProduction:true};
 assert.equal(validateRuntimeConfig(config).features.checkersProduction,false);
});
