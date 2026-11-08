// Reproducible large-sample RTP and extreme-tail audit for Best Buds.
// Reads the real practice engine, including paid bets, sequential Hold & Win,
// queued Free Rides, actual cent rounding, and the whole-round payout cap.
// Usage: node tests/best-buds-rtp-analysis.mjs [paidSpins] [seed]
import {pathToFileURL} from 'node:url';
import {initialState,nextSpin,MAX_WIN_MULTIPLIER} from '../src/best-buds-engine.js';
export const seededRandom=(initial=20261107)=>{
 let seed=initial|0;
 return ()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
};
export function runRtpAudit(paidSpins=1_000_000,seed=20261107){
 if(!Number.isSafeInteger(paidSpins)||paidSpins<1)throw Error('paidSpins must be a positive integer');
 const rng=seededRandom(seed),state=initialState();
 // Balance is not a constraint on a statistical RNG audit.
 let s={...state,balance:1e12};
 const totals={base:0,hold:0,free:0},triggers={hold:0,free:0},tail={capped:0,over100:0,over1000:0,maxRound:0,maxHold:0,maxFree:0,maxRespins:0};
 const awards=[];let mean=0,m2=0,winSpins=0,holdRespins=0,holdRounds=0;
 for(let i=0;i<paidSpins;i++){
  let base=0,hold=0,free=0,holdWasTriggered=false,freeWasTriggered=false,respins=0;
  s=nextSpin(s,{rng});
  base=s.lastWin;
  if(s.mode==='hold'){holdWasTriggered=true;triggers.hold++;}
  if(s.mode==='free'){freeWasTriggered=true;triggers.free++;}
  while(s.mode==='hold'){
   s=nextSpin(s,{rng});respins++;
   hold+=s.lastWin;
   if(respins>250)throw Error('HOTBOX feature did not terminate');
  }
  if(s.mode==='free'){
   if(!freeWasTriggered){triggers.free++;freeWasTriggered=true;}
   let freeSpins=0;
   while(s.mode==='free'){
    s=nextSpin(s,{rng});freeSpins++;free+=s.lastWin;
    if(freeSpins>50)throw Error('Free Rides feature did not terminate');
   }
   if(freeSpins!==8)throw Error('Free Rides must play exactly eight spins');
  }
  if(s.mode!=='base')throw Error('Paid round did not settle');
  const award=Math.round((base+hold+free)*100)/100;
  if(award>MAX_WIN_MULTIPLIER*s.roundBet+1e-6)throw Error('Round cap exceeded');
  totals.base+=base;totals.hold+=hold;totals.free+=free;
  if(hold>tail.maxHold)tail.maxHold=hold;if(free>tail.maxFree)tail.maxFree=free;
  if(respins>tail.maxRespins)tail.maxRespins=respins;
  if(holdWasTriggered){holdRespins+=respins;holdRounds++;}
  if(award>tail.maxRound)tail.maxRound=award;
  if(award>=MAX_WIN_MULTIPLIER*s.roundBet)tail.capped++;
  if(award>=100*s.roundBet)tail.over100++;
  if(award>=1000*s.roundBet)tail.over1000++;
  if(award>0)winSpins++;
  const mult=award/s.roundBet;awards.push(mult);
  const delta=mult-mean;mean+=delta/(i+1);m2+=delta*(mult-mean);
 }
 awards.sort((a,b)=>a-b);
 const q=p=>awards[Math.min(awards.length-1,Math.floor((awards.length-1)*p))];
 const sd=Math.sqrt(m2/Math.max(1,paidSpins-1)),se=sd/Math.sqrt(paidSpins);
 return {paidSpins,seed,rtp:{
  base:100*totals.base/(paidSpins*s.roundBet),
  hold:100*totals.hold/(paidSpins*s.roundBet),
  free:100*totals.free/(paidSpins*s.roundBet),
  total:100*(totals.base+totals.hold+totals.free)/(paidSpins*s.roundBet),
  standardErrorPercent:100*se,normalApprox95CI:[100*(mean-1.96*se),100*(mean+1.96*se)]
 },triggerRates:{holdEvery:paidSpins/triggers.hold,freeEvery:paidSpins/triggers.free,...triggers},
  feature:{meanHoldRespins:holdRespins/Math.max(1,holdRounds)},
  tail:{...tail,p99:q(.99),p999:q(.999),p9999:q(.9999)},
  paidWinRate:winSpins/paidSpins};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const spins=Number(process.argv[2]??1_000_000),seed=Number(process.argv[3]??20261107);
 console.log(JSON.stringify(runRtpAudit(spins,seed),null,2));
}
