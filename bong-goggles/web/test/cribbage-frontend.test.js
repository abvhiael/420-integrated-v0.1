import test from 'node:test';
import assert from 'node:assert/strict';
import {CRIBBAGE_HOLES,CRIBBAGE_FINISH,cribbageHole,cribbageLane,cribbageTeams,
 cribbageNewPegs,cribbageLeap} from '../core/cribbage-board.js';
import {CRIBBAGE_RULES_HASH,CRIBBAGE_ANNOUNCE_MS,cribbageLegalMoves,cribbageCanSubmit,
 normalizeCribbageSnapshot,cribbageAwardAnnouncement,cribbageAnnouncementQueue,
 CribbageSessionController} from '../core/cribbage-session.js';
import {renderCribbageRoute,renderCribbageBoard} from '../core/cribbage-ui.js';
import {renderClassicGamePage} from '../core/games-ui.js';

const id='10000000-1111-4111-8111-111111111111',
 room='20000000-2222-4222-8222-222222222222',
 subject='30000000-3333-4333-8333-333333333333';
const emptyComponents=()=>({fifteens:0,pairs:0,runs:0,flush:0,nobs:0,total:0});
const snapshot=(n=2,stage='discard',seq=1)=>{
 const count=n===2?6:5,hand=[0,4,13,25,37,48].slice(0,count);
 const view={gameId:'cribbage',variant:n===2?'standard-2p':n===3?'standard-3p':'standard-4p-partners',
  round:1,phase:stage,dealer:1,turn:0,seat:0,
  scores:Array(n).fill(0),hand,cardCounts:Array(n).fill(count),
  cribCount:n===3?1:0,discarded:Array(n).fill(false),
  starter:-1,pegCount:0,pegPile:[],pegged:Array.from({length:n},()=>[]),
  saidGo:Array(n).fill(false),lastShow:[],lastAwards:[],losers:[],winner:null};
 if(stage==='cut'){view.starter=-1;view.hand=hand.slice(0,4);
  view.discarded=Array(n).fill(true);view.cribCount=4;view.cardCounts=Array(n).fill(4);}
 if(stage==='peg'){view.hand=hand.slice(0,4);view.starter=11;
  view.discarded=Array(n).fill(true);view.cribCount=4;view.cardCounts=Array(n).fill(4);}
 return {status:200,data:{onChain:false,wager:false,rewards:false,session:{
  id,roomId:room,gameId:'cribbage',seatCount:n,status:'active',rulesVersion:'v1.0',
  rulesHash:CRIBBAGE_RULES_HASH,sequence:seq,turnSeat:0,deadline:null,
  winnerSeat:null,viewerSeat:0,privateView:view
 }}};
};
function accepted(n=2,stage='discard',seq=1){
 const result=normalizeCribbageSnapshot(snapshot(n,stage,seq),subject);
 assert.ok(result,'valid canonical projection rejected');
 return result;
}
const tick=()=>{
 let timer=null,duration=null;
 return {setTimer:(callback,ms)=>{timer=callback;duration=ms;return 1;},
  clearTimer:()=>{timer=null;},
  flush:()=>{assert.ok(timer,'expected pending announcement timer');const f=timer;timer=null;f();},
  duration:()=>duration,active:()=>!!timer};
};
const http=(status,data)=>({status,headers:{get:()=> 'application/json; charset=utf-8'},json:async()=>data});

test('BC-1.4 exactly 120 unique numbered holes per score track, shared 121 and separate 2-peg parks',()=>{
 assert.deepEqual(Object.keys(CRIBBAGE_HOLES),['green','ivory','amber']);
 for(const lane of Object.keys(CRIBBAGE_HOLES)){
  const holes=CRIBBAGE_HOLES[lane];
  assert.equal(holes.length,120);
  assert.deepEqual(holes.map(x=>x.number),Array.from({length:120},(_,i)=>i+1));
  assert.equal(new Set(holes.map(x=>x.x+':'+x.y)).size,120);
  for(const h of holes){assert.ok(h.x>=35&&h.x<=1420&&h.y>=45&&h.y<=1040,'outside approved artwork');}
  assert.deepEqual(cribbageHole(lane,120),holes[119]);
  assert.deepEqual(cribbageHole(lane,121),CRIBBAGE_FINISH);
  assert.notDeepEqual(cribbageHole(lane,0,0),cribbageHole(lane,0,1));
 }
 assert.deepEqual(cribbageTeams(4),[0,1,0,1]);
 assert.deepEqual(cribbageTeams(3),[0,1,2]);
 assert.equal(cribbageLane(2,3),'amber');
 assert.equal(cribbageHole('green',122).number,121,'overshoot is clamped at shared finish');
 assert.equal(cribbageHole('green',-1),null);
});
test('BC-1.4 real physical leapfrog moves the rear peg, not both pegs',()=>{
 let pegs=cribbageNewPegs([0,0],2);
 assert.equal(pegs[0].back,'a');
 pegs=cribbageLeap(pegs,0,2);
 assert.deepEqual([pegs[0].a,pegs[0].b,pegs[0].back,pegs[0].hop.peg],[2,0,'b','a']);
 pegs=cribbageLeap(pegs,0,6);
 assert.deepEqual([pegs[0].a,pegs[0].b,pegs[0].back,pegs[0].hop.peg],[2,6,'a','b']);
 pegs=cribbageLeap(pegs,0,121);
 assert.deepEqual([pegs[0].a,pegs[0].b],[121,6]);
 assert.equal(cribbageHole('green',pegs[0].a).number,121);
 assert.equal(pegs[1].score,0);
});
test('BC-1.4 validates exact qualified rule SHA, 420ID seat, public fields and forbids secret state',()=>{
 for(const n of [2,3,4]){
  const view=accepted(n);
  assert.equal(view.seatCount,n);
  assert.ok(cribbageLegalMoves(view).length>0);
 }
 const corrupt=[
  r=>{r.data.session.privateView.opponentHand=[24,33];},
  r=>{r.data.session.privateView.deck=[0,1];},
  r=>{r.data.session.privateView.crib=[0,1];},
  r=>{r.data.session.privateView.seed='bogus';},
  r=>{r.data.session.rulesHash='0'.repeat(64);},
  r=>{r.data.session.viewerSeat=5;},
  r=>{r.data.session.privateView.scores=[121,0];},
  r=>{r.data.session.privateView.cardCounts=[3];},
  r=>{r.data.session.privateView.hand=[0,0,4,5,8,9];},
  r=>{r.data.session.privateView.variant='noncanonical';},
  r=>{r.data.session.privateView.lastAwards=[{seat:0,team:1,points:6,kind:'+triple',total:6}];},
  r=>{r.data.session.privateView.lastShow=[{seat:1,isCrib:true,cards:[1,2,3,4],
    starter:5,score:{...emptyComponents(),total:10}}];},
  r=>{r.data.rewards=true;}
 ];
 for(const mutate of corrupt){
  const r=snapshot();mutate(r);
  assert.equal(normalizeCribbageSnapshot(r,subject),null,'unauthorized field accepted');
 }
});
test('BC-1.4 all moves use the human/server legal alphabet (2p, 3p, 4p, cut, peg, Go)',()=>{
 for(const n of [2,3,4]){
  const state=accepted(n);
  const actions=cribbageLegalMoves(state);
  assert.equal(actions.length,n===2?15:5);
  assert.ok(actions.every(x=>x.type==='discard'&&x.cards.length===(n===3?1:2)));
  assert.ok(actions.every(x=>cribbageCanSubmit(state,x)));
  assert.equal(cribbageCanSubmit(state,{type:'discard',cards:[51,50]}),false);
 }
 assert.deepEqual(cribbageLegalMoves(accepted(2,'cut')),[{type:'cut'}]);
 const r=snapshot(2,'peg');r.data.session.privateView.pegCount=31;
 const state=normalizeCribbageSnapshot(r);
 assert.deepEqual(cribbageLegalMoves(state),[{type:'go'}]);
 assert.equal(cribbageCanSubmit(state,{type:'play',card:0}),false);
});
test('BC-1.4 canonical announced peg count survives reset, and show counts dealer hand THEN crib',()=>{
 const view=accepted(4,'peg',2).privateView;
 const triple={seat:0,team:0,kind:'+triple',points:6,count:18,total:28};
 assert.deepEqual(cribbageAwardAnnouncement(triple,view),{
  label:'Player 1: 18 for 6, three of a kind',team:0,total:28
 });
 const prev=accepted(4,'peg',1);
 const next=snapshot(4,'peg',2);
 next.data.session.privateView.scores=[28,32,28,32];
 next.data.session.privateView.lastAwards=[triple,
  {seat:0,team:0,kind:'hand',points:8,total:36},
  {seat:1,team:1,kind:'hand',points:4,total:36},
  {seat:1,team:1,kind:'crib',points:2,total:38}];
 next.data.session.privateView.lastShow=[
  {seat:2,isCrib:false,cards:[0,13,26,39],starter:8,score:emptyComponents()},
  {seat:3,isCrib:false,cards:[1,14,27,40],starter:8,score:emptyComponents()},
  {seat:0,isCrib:false,cards:[2,15,28,41],starter:8,score:{...emptyComponents(),fifteens:8,total:8}},
  {seat:1,isCrib:false,cards:[3,16,29,42],starter:8,score:{...emptyComponents(),pairs:4,total:4}},
  {seat:1,isCrib:true,cards:[4,17,30,43],starter:8,score:{...emptyComponents(),pairs:2,total:2}}
 ];
 // The fixture intentionally supplies coherent typed awards and privacy-safe
 // lastShow ordering, but scores are left as the originally derived team totals.
 const queued=cribbageAnnouncementQueue(prev,{...prev,sequence:2,privateView:next.data.session.privateView});
 assert.equal(queued.length,6,'peg award plus five show count announcements');
 assert.match(queued[0].label,/18 for 6/);
 assert.deepEqual(queued.slice(1).map(x=>x.show.seat),[2,3,0,1,1]);
 assert.deepEqual(queued.slice(1).map(x=>x.show.isCrib),[false,false,false,false,true]);
 assert.match(queued.at(-1).label,/crib: 2 points/);
 assert.equal(queued[1].total,null,'zero-point hands do not move pegs');
});
test('BC-1.4 renders real artwork/holes without opponent hand or hidden crib, and isolates full-width table',()=>{
 for(const n of [2,3,4]){
  const s=accepted(n);
  const html=renderCribbageRoute({screen:'play',state:{
   status:'ready',session:s,pegs:cribbageNewPegs(s.privateView.scores,n),
   settings:{motion:'standard',stinkhole:false,announcements:true},selection:[]
  }});
  assert.match(html,/cribbage-layout/);
  assert.match(html,/cribbage-left/);
  assert.match(html,/cribbage-right/);
  assert.match(html,/leaf-board\.svg/);
  assert.equal((html.match(/data-hole="/g)||[]).length,n===3?360:240);
  assert.match(html,/data-cribbage-card="0"/);
  assert.match(html,/Send (1|2) to crib/);
  assert.doesNotMatch(html,/opponentHand|allHands|seed|engineState|privateView/);
  assert.match(html,/Team 1/);
 }
 const generic=renderClassicGamePage('cribbage',{screen:'rules'});
 assert.match(generic,/The crib belongs to the dealer/);
 assert.match(generic,/The dealer’s hand counts last, then the dealer’s crib/);
 assert.doesNotMatch(generic,/Create game.*disabled/);
});
test('BC-1.4 authenticated session posts only a validated server move and holds 1500ms announcement',async()=>{
 const timer=tick();
 const calls=[];
 const response1=snapshot(2,'peg',1);
 response1.data.session.privateView.hand=[0,4,13,25];
 response1.data.session.privateView.starter=11;response1.data.session.privateView.cribCount=4;
 response1.data.session.privateView.discarded=[true,true];
 response1.data.session.privateView.cardCounts=[4,4];
 const response2=structuredClone(response1);
 response2.data.session.sequence=2;response2.data.session.privateView.pegCount=15;
 response2.data.session.privateView.hand=[0,13,25];
 response2.data.session.privateView.cardCounts=[3,4];
 response2.data.session.privateView.pegged=[[4],[]];
 response2.data.session.privateView.pegPile=[4];
 response2.data.session.privateView.lastAwards=[{seat:0,team:0,kind:'fifteen',points:2,count:15,total:2}];
 response2.data.session.privateView.scores=[2,0];
 response2.data.session.turnSeat=1;response2.data.session.privateView.turn=1;
 const fetchImpl=async(path,opts)=>{
  calls.push({path,opts});
  if(path.endsWith('/v1/me'))return http(200,{walletRequired:false,profile:{subject}});
  if(path.endsWith('/action')){
   assert.equal(opts.method,'POST');
   const submitted=JSON.parse(opts.body);
   assert.equal(submitted.action,'move');
   assert.equal(submitted.expectedSequence,2);
   assert.deepEqual(submitted.move,{type:'play',card:4});
   assert.match(submitted.requestId,/^[0-9a-f-]{36}$/);
   return http(200,response2.data);
  }
  return http(200,response1.data);
 };
 const oldCrypto=globalThis.crypto;
 if(!oldCrypto?.randomUUID)return; // older Node lacks randomUUID; CI uses Node 22
 const controller=new CribbageSessionController({enabled:true,fetchImpl,
  onChange:()=>{},setTimer:timer.setTimer,clearTimer:timer.clearTimer});
 await controller.open(id);
 assert.equal(controller.state.status,'ready');
 await controller.act({type:'play',card:4});
 assert.equal(controller.state.announcement,'Player 1: 15 for 2');
 assert.equal(timer.duration(),CRIBBAGE_ANNOUNCE_MS);
 assert.equal(controller.state.pegs[0].score,2);
 assert.equal(controller.state.pegs[0].a,2);
 assert.equal(controller.state.pegs[0].b,0);
 assert.ok(calls.every(x=>x.opts.credentials==='same-origin'&&x.opts.cache==='no-store'&&x.opts.redirect==='error'));
 assert.ok(calls.some(x=>x.path==='/social-api/v1/classic-sessions/'+id+'/action'));
 timer.flush();
 assert.equal(controller.state.announcement,'');
 controller.destroy();
});
