import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalSportsbookEngine,makeLocalQuoteSigner,grossPayout}
 from '../server/sportsbook-engine.mjs';
import {openLocalSportsbookJournal} from '../server/sportsbook-journal.mjs';

const sig=makeLocalQuoteSigner('approved-local-test-signing-key-not-production');
const basePolicy={ticketStakeMax:'1000',ticketGrossMax:'4000',
 playerGrossMax:'7000',marketGrossMax:'10000',eventGrossMax:'12000',
 correlationGrossMax:'12000',operatorGrossMax:'15000',
 vaultGrossMax:'15000',playerDailyStakeMax:'2500',
 playerDailyLossMax:'2500',capitalSafetyReserve:'1000'};
let time=1762790400000;
const args=(override={})=>({chainId:'420',assetId:'test-420',vaultId:'vault-1',
 operatorId:'operator-1',capital:'16000',policy:basePolicy,
 signQuote:sig.sign,verifyQuote:sig.verify,
 authorizePlayer:async({quote,authorization})=>authorization?.signature==='player-approved'&&
  authorization.playerId===quote.playerId&&authorization.quoteHash===quote.nonce,
 checkEligibility:async()=>true,
 verifyResult:async({authority})=>authority.sourceDigest==='a'.repeat(64),
 clock:()=>time,...override});
const terms=(id='moneyline',type='moneyline2',selection=['home','away'],extras={})=>({
 id,eventId:'event-1',operatorId:'operator-1',assetId:'test-420',vaultId:'vault-1',
 competitionId:'nhl',correlationGroup:'event-1',rulesVersion:'approved-v1',type,
 period:'REGULATION',overtime:'EXCLUDE',tiePolicy:'PUSH',
 line2:type==='spread'||type==='total'?'0':null,
 selections:selection,startsAt:time+86400000,cutoffAt:time+3600000,state:'DRAFT',
 ...extras
});
const approved=m=>({role:'marketController',approved:true,termsHash:m.termsHash,
 sourceHealthy:true,capitalApproved:true});
async function openMarket(engine,m){
 const r=await engine.registerMarket(m,{role:'registrar',approved:true});
 const p=await engine.transition(r.id,'approve',{role:'riskApprover',approved:true,
  termsHash:r.termsHash});
 await engine.transition(r.id,'open',approved(p));
 return engine.view().markets[r.id];
}
async function place(engine,marketId,playerId='player-1',stake='100',nonce='nonce-1',
 selection='home',odds=['19','10']){
 const quote=await engine.issueQuote({marketId,selection,playerId,stake,nonce,
 numerator:odds[0],denominator:odds[1],issuedAt:time,expiresAt:time+20000,
 observedAt:time-1000},{role:'quoteSigner',approved:true});
 const ticket=await engine.acceptTicket(quote,{playerId,signature:'player-approved',quoteHash:nonce});
 return {quote,ticket};
}
async function result(engine,marketId,facts,sequence=1,previousDigest=null){
 await engine.transition(marketId,'close',approved(engine.view().markets[marketId]));
 const proposed=await engine.proposeResult(marketId,facts,{role:'factReporter',
  approved:true,sourceDigest:'a'.repeat(64),sequence,previousDigest});
 return proposed;
}
const scores=(home,away)=>({status:'FINAL',period:'REGULATION',overtime:'EXCLUDE',
 home2:String(home),away2:String(away)});
test('exact rational gross arithmetic refuses floats, zero odds and uint256 overflow',()=>{
 assert.equal(grossPayout('100','19','10'),'190');
 assert.equal(grossPayout('101','19','10'),'191');
 for(const [s,n,d] of [['10.1','19','10'],['10','0','1'],
  ['10','1','0'],['10','1','1'],['-1','19','10'],
  [(2n**256n-1n).toString(),'1000000','1']])
  assert.throws(()=>grossPayout(s,n,d),/sportsbook/);
});
test('fixed signed quote creates exactly one ticket with independent gross reserve and escrow',async()=>{
 const e=createLocalSportsbookEngine(args());
 await openMarket(e,terms());
 const {quote,ticket}=await place(e,'moneyline');
 assert.equal(ticket.gross,'190');
 assert.equal(e.view().operatorReserved,'190');
 assert.equal(e.view().freeCapital,'15810');
 assert.equal(e.view().playerEscrow,'100');
 await assert.rejects(e.acceptTicket(quote,{playerId:'player-1',
  signature:'player-approved',quoteHash:'nonce-1'}),/already accepted|nonce replay/);
 assert.equal(e.view().operatorReserved,'190');
 const tampered={...quote,gross:'191'};
 await assert.rejects(e.acceptTicket(tampered,{playerId:'player-1',
  signature:'player-approved',quoteHash:'nonce-1'}),/quote altered/);
});
test('correlated cross-market cap, player daily cap and zero partial mutation on failed risk checks',async()=>{
 const e=createLocalSportsbookEngine(args({policy:{...basePolicy,correlationGrossMax:'300'}}));
 await openMarket(e,terms());
 await openMarket(e,terms('spread','spread',['home','away'],{line2:'-1'}));
 await place(e,'moneyline','player-1','100','nonce-1');
 const before=JSON.stringify(e.view());
 await assert.rejects(place(e,'spread','player-2','100','nonce-2'),/correlation group exposure cap/);
 assert.equal(JSON.stringify(e.view()),before,'failed acceptance partially reserved');
});
test('insufficient independently funded operator capital refuses player escrow consumption',async()=>{
 const e=createLocalSportsbookEngine(args({capital:'1000'}));
 await openMarket(e,terms());
 const before=JSON.stringify(e.view());
 await assert.rejects(place(e,'moneyline'),/insufficient independently reserved operator capital/);
 assert.equal(JSON.stringify(e.view()),before);
});
test('win settlement exactly once, freezes accepted odds and conserves escrow/reservations',async()=>{
 const e=createLocalSportsbookEngine(args());
 const m=await openMarket(e,terms());
 const {ticket}=await place(e,m.id);
 const proposed=await result(e,m.id,scores(4,2));
 await assert.rejects(e.finalizeResult(m.id,{role:'independentFinalizer',approved:true,
  digest:proposed.digest}),/challenge hold/);
 time+=86400001;
 await e.finalizeResult(m.id,{role:'independentFinalizer',approved:true,digest:proposed.digest});
 const auth={role:'settlementExecutor',approved:true,finalDigest:proposed.digest};
 const receipt=await e.settleTicket(ticket.ticketId,auth);
 assert.equal(receipt.outcome,'WIN');assert.equal(receipt.payout,'190');
 assert.equal(e.view().operatorReserved,'0');assert.equal(e.view().playerEscrow,'0');
 assert.equal(e.view().freeCapital,'16000');
 assert.equal(e.view().operatorPL,'-90');
 assert.deepEqual(await e.settleTicket(ticket.ticketId,auth),receipt);
 await assert.rejects(e.settleTicket(ticket.ticketId,{...auth,finalDigest:'other'}),/conflicting settlement replay/);
});
test('regulation three-way draw pays draw; spread/total ties push without fees',async()=>{
 for(const scenario of [
  {type:'moneyline3',selections:['home','draw','away'],selection:'draw',line2:null,
   scores:scores(4,4),outcome:'WIN',payout:'190'},
  {type:'spread',selections:['home','away'],selection:'home',line2:'-3',
   scores:scores(7,4),outcome:'PUSH',payout:'100'},
  {type:'total',selections:['over','under'],selection:'over',line2:'9',
   scores:scores(2,2),outcome:'LOSS',payout:'0'},
  {type:'total',selections:['over','under'],selection:'over',line2:'8',
   scores:scores(2,2),outcome:'PUSH',payout:'100'}
 ]){
  const e=createLocalSportsbookEngine(args()),m=await openMarket(e,
   terms('m-'+scenario.type,scenario.type,scenario.selections,{line2:scenario.line2}));
  const {ticket}=await place(e,m.id,'player-1','100','nonce-'+scenario.type,
   scenario.selection);
  const proposed=await result(e,m.id,scenario.scores);
  time+=86400001;
  await e.finalizeResult(m.id,{role:'independentFinalizer',approved:true,digest:proposed.digest});
  const r=await e.settleTicket(ticket.ticketId,{role:'settlementExecutor',approved:true,
   finalDigest:proposed.digest});
  assert.equal(r.outcome,scenario.outcome);assert.equal(r.payout,scenario.payout);
  assert.equal(r.fee,'0');assert.equal(e.view().playerEscrow,'0');
 }
});
test('cancelled event voids and refunds full stake, no unilateral operator winner',async()=>{
 const e=createLocalSportsbookEngine(args());await openMarket(e,terms());
 const {ticket}=await place(e,'moneyline');
 const p=await result(e,'moneyline',{status:'CANCELLED'});
 await assert.rejects(e.settleTicket(ticket.ticketId,{role:'settlementExecutor',
  approved:true,finalDigest:p.digest}),/unfinished settlement/);
 time+=86400001;
 await e.finalizeResult('moneyline',{role:'independentFinalizer',approved:true,digest:p.digest});
 const r=await e.settleTicket(ticket.ticketId,{role:'settlementExecutor',
  approved:true,finalDigest:p.digest});
 assert.equal(r.outcome,'VOID');assert.equal(r.payout,'100');
 assert.equal(e.view().operatorPL,'0');
});
test('dispute blocks finalization; stale signed quote after suspension cannot bypass epoch',async()=>{
 const e=createLocalSportsbookEngine(args()),m=await openMarket(e,terms());
 const q=await e.issueQuote({marketId:m.id,selection:'away',playerId:'player-1',
  stake:'100',nonce:'n1',numerator:'2',denominator:'1',issuedAt:time,
  observedAt:time-1000,expiresAt:time+10000},{role:'quoteSigner',approved:true});
 await e.transition(m.id,'suspend',approved(e.view().markets[m.id]));
 await e.transition(m.id,'resume',approved(e.view().markets[m.id]));
 await assert.rejects(e.acceptTicket(q,{signature:'player-approved',playerId:'player-1',
  quoteHash:'n1'}),/quote stale/);
 const p=await result(e,m.id,scores(1,2));
 await e.challengeResult(m.id,{role:'disputeClaimant',approved:true,resultDigest:p.digest});
 time+=86400001;
 await assert.rejects(e.finalizeResult(m.id,{role:'independentFinalizer',approved:true,
  digest:p.digest}),/challenge hold/);
 const revised=await e.proposeResult(m.id,scores(1,1),{role:'factReporter',
  approved:true,sourceDigest:'a'.repeat(64),sequence:2,previousDigest:p.digest});
 assert.equal(revised.sequence,2);
});
test('journal reopens with same ticket reservation and exact-once terminal receipt; second writer barred',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'book-v1-'));
 const path=join(dir,'sportsbook.json');let e;
 try{
  e=await openLocalSportsbookJournal({path,...args()});
  await openMarket(e,terms());
  const {ticket}=await place(e,'moneyline');
  await assert.rejects(openLocalSportsbookJournal({path,...args()}),/EEXIST/);
  await e.close();e=null;
  e=await openLocalSportsbookJournal({path,...args()});
  assert.equal(e.view().operatorReserved,'190');
  assert.equal(Object.keys(e.view().tickets).length,1);
  const p=await result(e,'moneyline',scores(0,2));
  time+=86400001;
  await e.finalizeResult('moneyline',{role:'independentFinalizer',approved:true,digest:p.digest});
  await e.settleTicket(ticket.ticketId,{role:'settlementExecutor',approved:true,finalDigest:p.digest});
  await e.close();e=null;
  e=await openLocalSportsbookJournal({path,...args()});
  assert.equal(e.view().receipts[ticket.ticketId].payout,'0');
  assert.equal(e.view().operatorReserved,'0');
  assert.equal(e.view().playerEscrow,'0');
  const file=JSON.parse(await readFile(path,'utf8'));
  assert.equal(file.sequence,e.view().sequence);
 }finally{if(e)await e.close();await rm(dir,{recursive:true,force:true});}
});
test('persist failure never acknowledges ticket or modifies caller-visible state',async()=>{
 let breakWrites=false;
 const e=createLocalSportsbookEngine(args({persistState:async()=>{if(breakWrites)throw Error('injected disk fsync failure')}}));
 await openMarket(e,terms());
 const q=await e.issueQuote({marketId:'moneyline',selection:'home',playerId:'player-1',
  stake:'100',nonce:'n1',numerator:'2',denominator:'1',issuedAt:time,
  observedAt:time-1000,expiresAt:time+10000},{role:'quoteSigner',approved:true});
 const previous=JSON.stringify(e.view());
 breakWrites=true;
 await assert.rejects(e.acceptTicket(q,{signature:'player-approved',
  playerId:'player-1',quoteHash:'n1'}),/fsync failure/);
 assert.equal(JSON.stringify(e.view()),previous);
});
