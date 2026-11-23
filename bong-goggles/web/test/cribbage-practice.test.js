import test from 'node:test';
import assert from 'node:assert/strict';
import {startCribbagePractice,renderCribbagePractice,bindCribbagePractice}
 from '../core/classic-cribbage-practice.js';
import {CRIBBAGE_RULES_HASH} from '../core/cribbage-session.js';

const id=n=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const owner=id(1),roomID=id(2),sessionID=id(3);
const flags={onChain:false,wager:false,rewards:false};
function room(status,level){
 return {id:roomID,host:owner,gameId:'cribbage',seatCount:2,
  status,visibility:'private',revision:status==='open'?0:1,
  seats:[{index:0,controller:'human',subject:owner},
   {index:1,controller:status==='open'?'empty':'bot',difficulty:level??''}]};
}
function session(){
 return {id:sessionID,roomId:roomID,gameId:'cribbage',seatCount:2,
  status:'active',rulesVersion:'v1.0',rulesHash:CRIBBAGE_RULES_HASH,
  sequence:1,turnSeat:0,deadline:null,winnerSeat:null,viewerSeat:0,
  privateView:{gameId:'cribbage',variant:'standard-2p',round:1,phase:'discard',
   dealer:1,turn:0,seat:0,scores:[0,0],hand:[0,4,13,25,37,48],
   cardCounts:[6,6],cribCount:0,discarded:[false,false],starter:-1,
   pegCount:0,pegPile:[],pegged:[[],[]],saidGo:[false,false],
   lastShow:[],lastAwards:[],losers:[],winner:null}};
}
function mock(level,{poison=null,identityChangeAt=Infinity,unexpectedStatus=null}={}){
 const calls=[];
 let reads=0;
 const client={enabled:true,async request(path,opts={}){
  calls.push({path,method:opts.method||'GET',body:opts.body});
  if(path==='/v1/me')return {status:200,data:{
   walletRequired:false,profile:{subject:++reads>=identityChangeAt?id(4):owner}}};
  if(path==='/v1/classic-rooms'){
   assert.deepEqual(opts.body,{gameId:'cribbage',visibility:'private',seatCount:2});
   return {status:201,data:{...flags,playable:false,room:room('open')}};
  }
  if(path==='/v1/classic-rooms/'+roomID+'/change'){
   assert.deepEqual(opts.body,{action:'bot',seat:1,difficulty:level,expectedRevision:0});
   const value=room('ready',level);poison?.(value,'bot');
   return {status:200,data:{...flags,playable:false,room:value}};
  }
  if(path==='/v1/classic-sessions'){
   assert.deepEqual(opts.body,{roomId:roomID});
   const value=session();poison?.(value,'session');
   return {status:unexpectedStatus??201,data:{...flags,session:value}};
  }
  throw Error('unexpected '+path);
 }};
 return {client,calls};
}
test('BC-1.8 selector displays Easy/Medium/Hard with honest unavailable state',()=>{
 const disabled=renderCribbagePractice({status:'disabled'});
 assert.match(disabled,/Play against the computer/);
 for(const level of ['Easy','Medium','Hard'])assert.match(disabled,new RegExp(level));
 assert.match(disabled,/<button type="submit" disabled>/);
 assert.match(disabled,/not activated/);
 assert.match(renderCribbagePractice({status:'guest'}),/Sign in with 420ID/);
 const ready=renderCribbagePractice({status:'idle',practiceDifficulty:'hard'});
 assert.match(ready,/<option value="hard" selected>/);
 assert.doesNotMatch(ready,/<button type="submit" disabled>/);
 assert.match(renderCribbagePractice({status:'idle',practiceError:true}),/not confirmed|unconfirmed/i);
});
test('BC-1.8 real bot start creates only a private room and a canonical server match',async()=>{
 for(const level of ['easy','medium','hard']){
  const {client,calls}=mock(level);
  assert.equal(await startCribbagePractice(client,level),sessionID);
  assert.deepEqual(calls.map(x=>x.path),[
   '/v1/me','/v1/classic-rooms','/v1/me',
   '/v1/classic-rooms/'+roomID+'/change','/v1/me',
   '/v1/classic-sessions','/v1/me']);
  assert.equal(calls.filter(x=>x.path==='/v1/classic-sessions').length,1);
 }
});
test('BC-1.8 never starts without live identity, bot authorization or correct rules',async()=>{
 const cases=[
  {level:'invalid'},
  {level:'easy',opts:{identityChangeAt:2}},
  {level:'easy',opts:{identityChangeAt:3}},
  {level:'easy',opts:{identityChangeAt:4}},
  {level:'easy',opts:{poison:(x,phase)=>{if(phase==='bot')x.seats[1].difficulty='hard';}}},
  {level:'easy',opts:{poison:(x,phase)=>{if(phase==='session')x.rulesHash='0'.repeat(64);}}},
  {level:'easy',opts:{poison:(x,phase)=>{if(phase==='session')x.privateView.opponentHand=[12];}}},
  {level:'easy',opts:{unexpectedStatus:409}}
 ];
 for(const c of cases){
  const {client,calls}=mock(c.level,c.opts);
  await assert.rejects(startCribbagePractice(client,c.level));
  if(c.opts?.identityChangeAt===2)assert.ok(!calls.some(x=>x.path.endsWith('/change')));
  if(c.opts?.identityChangeAt===3)assert.ok(!calls.some(x=>x.path==='/v1/classic-sessions'));
  if(c.level==='invalid')assert.equal(calls.length,0);
 }
 await assert.rejects(startCribbagePractice({enabled:false},'easy'));
});
test('BC-1.8 real form guards double submit, fails closed and preserves difficulty',async()=>{
 let submit,change,navigated='',calls=0;
 const picker={value:'medium',addEventListener:(type,cb)=>{if(type==='change')change=cb;}};
 const form={querySelector:()=>picker,addEventListener:(type,cb)=>{if(type==='submit')submit=cb;}};
 const controller={state:{status:'idle'},client:{enabled:true,async request(){calls++;return {status:401};}},
  emit(delta){this.state={...this.state,...delta};}};
 bindCribbagePractice({querySelector:()=>form},controller,{navigate:url=>{navigated=url;}});
 assert.ok(submit);
 await Promise.all([submit({preventDefault(){}}),submit({preventDefault(){}})]);
 assert.equal(calls,1);
 assert.equal(navigated,'');
 assert.equal(controller.state.practiceError,true);
 picker.value='hard';change();assert.equal(controller.state.practiceDifficulty,'hard');
});
