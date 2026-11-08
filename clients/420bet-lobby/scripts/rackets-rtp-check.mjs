// Reproducible practice-mode Monte Carlo using the actual Slot #7 engine.
// Run from clients/420bet-lobby: node scripts/rackets-rtp-check.mjs 1000000
import {spinBoard,evaluate,MAX_WIN} from '../src/rackets-trash-stash.js';
const count=Number(process.argv[2]??1000000);
if(!Number.isSafeInteger(count)||count<1000||count>10000000)throw new Error('Specify between 1,000 and 10,000,000 paid spins');
let seed=0x7bda420;
function random(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;}
const result={paidSpins:count,baseOrdinary:0,basePrizes:0,freeOrdinary:0,freePrizes:0,wildCollection:0,bonuses:0,freeSpins:0,retriggers:0,maxSession:0,baseMaxSpin:0,freeMaxSpin:0,bonusByScatter:{3:0,4:0,5:0}};
let baseTotal=0,freeTotal=0;
const sumWins=(record)=>record.wins.reduce((acc,w)=>{if(w.kind==='match')acc.ordinary+=w.amount;else acc.prizes+=w.amount;return acc;},{ordinary:0,prizes:0});
for(let i=0;i<count;i++){
 const b=evaluate(spinBoard('base',random));
 const baseWins=sumWins(b);baseTotal+=b.total;
 result.baseOrdinary+=baseWins.ordinary;result.basePrizes+=baseWins.prizes;
 result.baseMaxSpin=Math.max(result.baseMaxSpin,b.total);
 if(!b.trigger)continue;
 result.bonuses++;result.bonusByScatter[String(b.bonusReels)]++;
 let left=b.trigger,retriggers=0,multiplier=1,wildProgress=0,session=0;
 while(left>0){
  const f=evaluate(spinBoard('free',random),1,'free',multiplier);
  const freeWins=sumWins(f);
  result.freeOrdinary+=freeWins.ordinary;result.freePrizes+=freeWins.prizes;
  result.wildCollection+=f.collection;freeTotal+=f.total;session+=f.total;
  result.freeSpins++;result.freeMaxSpin=Math.max(result.freeMaxSpin,f.total);
  left--;wildProgress+=f.qualifyingWilds;
  while(wildProgress>=4&&retriggers<3){
   wildProgress-=4;retriggers++;result.retriggers++;
   left+=10;multiplier=[1,2,3,10][retriggers];
  }
  if(retriggers===3)wildProgress=Math.min(wildProgress,3);
 }
 result.maxSession=Math.max(session,result.maxSession);
}
const pct=n=>Number((100*n/count).toFixed(4));
console.log(JSON.stringify({
 sample:{paidSpins:count,seed:'0x7bda420',bonuses:result.bonuses,freeSpins:result.freeSpins,retriggers:result.retriggers,bonusByScatter:result.bonusByScatter},
 rtp:{baseOrdinary:pct(result.baseOrdinary),basePrize:pct(result.basePrizes),freeOrdinary:pct(result.freeOrdinary),freePrize:pct(result.freePrizes),wildCollection:pct(result.wildCollection),overall:pct(baseTotal+freeTotal)},
 extremes:{maxBaseSpin:result.baseMaxSpin,maxFreeSpin:result.freeMaxSpin,maxFeature:result.maxSession,winCap:MAX_WIN},
 note:'Simulation only, not certified theoretical RTP. Bonus Tests are excluded.'
},null,2));
