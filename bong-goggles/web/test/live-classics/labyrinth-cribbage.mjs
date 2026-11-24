// BC-2.8 real-service Labyrinth Cribbage adapter for the existing main-only
// BC-0.12 live acceptance harness. Uses two independently authenticated
// browser pages and ACTUAL server-owned rules; no fake responses, local
// scoring, fabricated wins, or web wallet/wager authority.
//
// This module is NOT called by PR/CI fixture tests. Live execution requires
// main, operator-dispatched workflow, two real secret cookies and deployed
// 420ID room+rules+session+bot/social activation.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';

export const BC28_LABYRINTH_HASH='9eed3af244d95dd1757b2ce82c1f66d85581a9b0656e0f36eba825cf8ddbc791';
const hash=BC28_LABYRINTH_HASH;
const prefix='/social-api/v1/';
const stages=new Set(['discard','cut','peg']);
const allowedStates=new Set(['active','finished']);
const maxMoves=2200;
const timeBudgetMs=45*60*1000;
// BC-2.8 uses real 420ID cookies only from protected main dispatch. The
// browser/service owns all scores, cards, outcomes and bot moves.
const fail=m=>{throw Error('BC-2.8 real Labyrinth Cribbage acceptance: '+m)};
const requireResponse=(r,status,path)=>{
 if(r?.status!==status)fail(path+' returned '+r?.status+' (expected '+status+')');
 if(r.data?.onChain!==false||r.data.wager!==false||r.data.rewards!==false)
  fail(path+' lacks zero-wager off-chain evidence');
 return r.data;
};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const rid=id=>{if(!uuid.test(id))fail('unsafe UUID');return id};
export const verifyBC28LabyrinthLiveView=(view,expectedGame='labyrinth-cribbage')=>{
 if(!view||!uuid.test(view.id)||!uuid.test(view.roomId)||
  view.gameId!==expectedGame||view.rulesVersion!=='v2.0'||view.rulesHash!==hash||
  view.seatCount!==2||!Number.isSafeInteger(view.sequence)||
  view.sequence<1||!allowedStates.has(view.status)||
  !Number.isInteger(view.viewerSeat)||view.viewerSeat<0||view.viewerSeat>=view.seatCount)
  fail('invalid server-signed game view');
 if(!view.privateView||view.privateView.seat!==view.viewerSeat||
  !Array.isArray(view.privateView.scores)||
  view.privateView.scores.length!==view.seatCount||
  view.privateView.variant!=='labyrinth-2p'||
  !Array.isArray(view.privateView.hand)||
  !view.privateView.hand.every(c=>Number.isSafeInteger(c)&&c>=0&&c<52)||
  new Set(view.privateView.hand).size!==view.privateView.hand.length)
  fail('server private seat projection not verified');
 for(const field of ['deck','seed','opponentHand','allHands','crib','kept','engineState','initialState']){
  if(Object.hasOwn(view.privateView,field))fail('hidden '+field+' leaked from server');
 }
 return view;
};
const current=verifyBC28LabyrinthLiveView;
const pip=c=>Math.min((c%13)+1,10);
export function legalBC28LabyrinthMove(view){
 const s=view.privateView;
 if(!stages.has(s.phase))fail('unrecognized game phase '+s.phase);
 const cards=s.hand;
 if(!Array.isArray(cards)||!cards.every(x=>Number.isInteger(x)&&x>=0&&x<52)||
  (view.turnSeat!==view.viewerSeat))fail('non-current seat or invalid cards');
 if(s.phase==='discard'){
  const n=view.seatCount===2?3:view.seatCount===3?2:1;
  if(cards.length<n)fail('no legal discard');
  return {type:'discard',cards:cards.slice(0,n)};
 }
 if(s.phase==='cut')return {type:'cut'};
 if(!Number.isInteger(s.pegCount)||s.pegCount<0||s.pegCount>31)fail('invalid pegging count');
 const playable=cards.find(c=>pip(c)+s.pegCount<=31);
 return playable===undefined?{type:'go'}:{type:'play',card:playable};
}
const legalMove=legalBC28LabyrinthMove;
async function get(io,who,id){
 const data=requireResponse(await io.request(io.pages[who],prefix+'classic-sessions/'+rid(id)),200,'session GET');
 return current(data.session);
}
async function move(io,who,view){
 const path=prefix+'classic-sessions/'+rid(view.id)+'/action';
 const payload={requestId:randomUUID(),action:'move',
  expectedSequence:view.sequence+1,move:legalMove(view)};
 const data=requireResponse(await io.request(io.pages[who],path,'POST',payload),200,'signed move');
 const output=current(data.session);
 if(output.id!==view.id||output.viewerSeat!==view.viewerSeat||
   output.sequence!==payload.expectedSequence)fail('unverified or duplicate committed game action');
 return output;
}
async function playHumans(io,id,{stopAt=Infinity,deadlineMs=timeBudgetMs}={}){
 const deadline=Date.now()+deadlineMs;
 let count=0;
 for(;count<maxMoves&&Date.now()<deadline;count++){
  const probe=await get(io,0,id);
  if(probe.status==='finished')return probe;
  const seat=probe.turnSeat;
  if(seat!==0&&seat!==1)fail('unexpected third-party control in two-account match');
  const view=await get(io,seat,id);
  if(view.sequence!==probe.sequence||view.viewerSeat!==seat)fail('stale or cross-seat projection');
  const next=await move(io,seat,view);
  if(next.sequence>=stopAt)return next;
  // Real production social-write rate limits are preserved. No test-only
  // clock adjustment and no relaxation of rate-limit assertions.
  await delay(1100);
 }
 fail('live match exhausted '+maxMoves+' authorized moves or deadline');
}
async function createRoom(io,seatType='human',difficulty=null){
 const a=io.pages[0],b=io.pages[1];
 const data=requireResponse(await io.request(a,prefix+'classic-rooms','POST',{
  gameId:'labyrinth-cribbage',visibility:'public',seatCount:2
 }),201,'create Labyrinth Cribbage lobby');
 let room=data.room;rid(room?.id);
 if(room.gameId!=='labyrinth-cribbage'||room.seatCount!==2||room.status!=='open'||room.visibility!=='public')
  fail('unverified initial lobby');
 if(seatType==='human'){
  const joined=requireResponse(await io.request(b,prefix+'classic-rooms/'+room.id+'/change','POST',{
   action:'join',seat:1,expectedRevision:room.revision
  }),200,'second 420ID admission');
  room=joined.room;
  if(room?.seats?.[1]?.controller!=='human')fail('second principal not seated');
 }else{
  const joined=requireResponse(await io.request(a,prefix+'classic-rooms/'+room.id+'/change','POST',{
   action:'bot',seat:1,difficulty,expectedRevision:room.revision
  }),200,'qualified '+difficulty+' bot registration');
  room=joined.room;
  if(room?.seats?.[1]?.controller!=='bot'||room.seats[1].difficulty!==difficulty)
   fail('bot difficulty or server control changed');
 }
 if(room.status!=='ready')fail('incomplete lobby started without consent');
 const started=requireResponse(await io.request(a,prefix+'classic-sessions','POST',{
  roomId:room.id
 }),201,'host-only Labyrinth Cribbage start');
 const session=current(started.session);
 if(session.roomId!==room.id||session.status!=='active'||session.sequence!==1||
  session.viewerSeat!==0)fail('new Labyrinth Cribbage session not owned by authorized host');
 if(seatType==='human'){
  const other=await get(io,1,session.id);
  if(other.viewerSeat!==1||other.sequence!==1||
   JSON.stringify(other.privateView)===JSON.stringify(session.privateView))
   fail('second 420ID hand is not independently private');
 }
 return session;
}
export async function playToMidpoint(io){
 if(io.game!=='labyrinth-cribbage')fail('incorrect live game adapter');
 const initial=await createRoom(io);
 const mid=await playHumans(io,initial.id,{stopAt:5});
 if(mid.status!=='active'||mid.sequence<5)fail('midpoint before verified canonical turns');
 return {sessionId:initial.id,sequence:mid.sequence};
}
export async function finishAfterReload(io){
 const result=await playHumans(io,io.sessionId);
 if(result.status!=='finished'||!Number.isInteger(result.winnerSeat)||
  Math.max(...result.privateView.scores)<325)fail('no real server-owned 325-point completion');
 for(let i=0;i<2;i++){
  const other=await get(io,i,io.sessionId);
  if(other.status!=='finished'||other.sequence!==result.sequence||
   other.winnerSeat!==result.winnerSeat)fail('cross-account final result divergence');
  const history=requireResponse(await io.request(io.pages[i],prefix+'classic-sessions/history-labyrinth'),200,'signed history');
  const stored=history.history?.matches?.find(m=>m.id===io.sessionId);
  if(!stored||stored.status!=='finished'||stored.winnerSeat!==result.winnerSeat||
   stored.sequence!==result.sequence||stored.scores.length!==2||
   Object.hasOwn(stored,'privateView'))fail('verified private result not persisted per account');
 }
 // The canonical BC-1.6 rematch endpoint requires a fresh private lobby,
 // explicit invitation acceptance and a NEW server-owned session.
 const rematch=requireResponse(await io.request(io.pages[0],
  prefix+'classic-sessions/'+io.sessionId+'/rematch','POST',{requestId:randomUUID()}),201,'rematch');
 const room=rematch.room;rid(room?.id);
 if(room.id===result.roomId||room.status!=='open'||room.visibility!=='private'||
  room.seats?.[1]?.controller!=='invited')fail('rematch silently reused old authority');
 const accepted=requireResponse(await io.request(io.pages[1],
  prefix+'classic-rooms/'+room.id+'/change','POST',{
   action:'accept',seat:1,expectedRevision:room.revision
  }),200,'rematch consent');
 if(accepted.room?.status!=='ready')fail('rematch started without both human consents');
 const activated=requireResponse(await io.request(io.pages[0],prefix+'classic-sessions','POST',{
  roomId:room.id
 }),201,'rematch start');
 if(activated.session?.id===io.sessionId||activated.session?.rulesHash!==hash||
  activated.session?.sequence!==1)fail('not a fresh canonical Labyrinth Cribbage rematch');
 const rematchFinal=await playHumans(io,activated.session.id);
 if(rematchFinal.status!=='finished'||Math.max(...rematchFinal.privateView.scores)<325)
  fail('real rematch not completed to 325');
}
export async function runBotDifficulty(io){
 const difficulty=io.difficulty;
 if(!['easy','medium','hard'].includes(difficulty))fail('unknown bot difficulty');
 const initial=await createRoom(io,'bot',difficulty);
 const id=initial.id;
 let moves=0,botMoves=0,previous=initial.sequence;
 const deadline=Date.now()+timeBudgetMs;
 while(moves++<maxMoves&&Date.now()<deadline){
  const state=await get(io,0,id);
  if(state.status==='finished'){
   if(!Number.isInteger(state.winnerSeat)||Math.max(...state.privateView.scores)<325||
    botMoves<8)fail('bot match not a real finished legal 325-point game');
   const record=requireResponse(await io.request(io.pages[0],prefix+'classic-sessions/history-labyrinth'),200,'bot history');
   if(!record.history?.matches?.some(v=>v.id===id&&v.status==='finished'))
    fail('completed bot match missing from server history');
   return {difficulty,status:'finished',authoritative:true};
  }
  if(state.turnSeat===0){
   await move(io,0,state);
   await delay(1100);
  }else if(state.turnSeat===1){
   // Only the deployed server-owned bot worker may advance an AI turn.
   // Browser scripts never submit the bot's action or see its hand.
   let advanced=false;
   for(let n=0;n<50&&Date.now()<deadline;n++){
    await delay(600);
    const after=await get(io,0,id);
    if(after.sequence>state.sequence){
     if(after.sequence<=previous)fail('nonmonotonic AI sequence');
     botMoves+=after.sequence-state.sequence;previous=after.sequence;advanced=true;break;
    }
   }
   if(!advanced)fail('deployed '+difficulty+' bot worker stalled');
  }else fail('unexpected authoritative turn seat');
 }
 fail('live '+difficulty+' bot never reached server-owned 325-point finish');
}
