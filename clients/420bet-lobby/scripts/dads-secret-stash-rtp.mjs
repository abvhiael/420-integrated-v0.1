// Deterministic practice-math RTP audit. Run from clients/420bet-lobby:
// node scripts/dads-secret-stash-rtp.mjs 1000000 20261106
// NOT a certified exact combinatorial RTP or real-money qualification.
import {spin,newGame,FREE_WEIGHTS,FREE_STICKY_LIMIT,FREE_MULTIPLIER_STAGES} from '../src/dads-secret-stash-engine.js';
const spins=Number(process.argv[2]??100000);
const initialSeed=Number(process.argv[3]??20261106)>>>0;
if(!Number.isSafeInteger(spins)||spins<1000||spins>30000000)throw Error('Spin count must be 1000 to 30000000');
let seed=initialSeed||1;
function rng(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
const featureTotals={base:0,jen:0,family:0,keller:0,bud:0,free:0,stash:0,mow:0};
const triggerCounts=Object.fromEntries(Object.keys(featureTotals).map(key=>[key,0]));
let total=0,totalSq=0,capped=0,winning=0,maxWin=0;
const started=Date.now();
for(let i=0;i<spins;i++){
 // Fresh practice state avoids credit depletion and does not alter payout math.
 const state={...newGame(),balance:1e12,bet:1};
 const result=spin(state,rng).last;
 const raw=result.base.units+result.events.reduce((sum,event)=>sum+event.units,0);
 const scale=raw>0?result.win/raw:0;
 featureTotals.base+=result.base.units*scale;
 if(result.base.units>0)triggerCounts.base++;
 for(const event of result.events){
  featureTotals[event.type]+=event.units*scale;
  triggerCounts[event.type]++;
 }
 if(raw>10000)capped++;
 if(result.win>0)winning++;
 maxWin=Math.max(maxWin,result.win);
 total+=result.win;totalSq+=result.win*result.win;
}
const rtp=total/spins;
const variance=Math.max(0,totalSq/spins-rtp*rtp),standardError=Math.sqrt(variance/spins);
const output={
 spins,seed:initialSeed,rtpPercent:rtp*100,
 confidence95Percent:[(rtp-1.96*standardError)*100,(rtp+1.96*standardError)*100],
 standardDeviation:Math.sqrt(variance),capped,winFrequency:winning/spins,maxWin,
 freeWeights:FREE_WEIGHTS,stickyLimit:FREE_STICKY_LIMIT,freeMultipliers:FREE_MULTIPLIER_STAGES,
 contributionPercent:Object.fromEntries(Object.entries(featureTotals).map(([key,v])=>[key,v/spins*100])),
 triggerFrequency:Object.fromEntries(Object.entries(triggerCounts).map(([key,v])=>[key,v/spins])),
 elapsedSeconds:(Date.now()-started)/1000
};
console.log(JSON.stringify(output,null,2));
