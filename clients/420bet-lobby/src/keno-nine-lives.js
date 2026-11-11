// Practice-only candidate. NOT a canonical on-chain paytable or approved betting ruleset.
import { proposedGrossMultiplier } from './keno-candidate-paytable.js';
export const NINE_LIVES_TARGET=9;
export const NINE_LIVES_RTP_TARGET=0.95;
// Stationary-state scaling for the nine-hit meter: earn hits across rounds;
// on reaching nine, wait until the NEXT paid draw, double it, then reset.
// Factors rounded to six decimals; calculated using exact hypergeometric hit probabilities.
export const NINE_LIVES_SCALES=Object.freeze({
  1:0.959596,2:0.713191,3:0.781890,4:0.809573,5:0.662866,
  6:0.715326,7:0.606766,8:0.630586,9:0.660881,10:0.588899
});
export function nineLivesCandidateMultiplier(picks,hits){
 const base=Number(proposedGrossMultiplier(picks,hits));
 return Number((base*NINE_LIVES_SCALES[picks]).toFixed(4));
}
export function advanceNineLives(progress,hits,pays){
 if(!Number.isInteger(progress)||progress<0||progress>9||!Number.isInteger(hits)||hits<0||hits>10)
  throw new Error('Invalid Nine Lives transition');
 if(progress===9){
  return pays?{progress:0,bonusApplied:true,bonusReady:false}:{progress:9,bonusApplied:false,bonusReady:true};
 }
 const newProgress=Math.min(9,progress+hits);
 return {progress:newProgress,bonusApplied:false,bonusReady:newProgress===9};
}
export function nineLivesRound(progress,picks,hits){
 const baseMultiplier=nineLivesCandidateMultiplier(picks,hits);
 const transition=advanceNineLives(progress,hits,baseMultiplier>0);
 return {...transition,baseMultiplier,effectiveMultiplier:Number((baseMultiplier*(transition.bonusApplied?2:1)).toFixed(4))};
}
export function hypergeometricProbability(picks,hits){
 if(!Number.isInteger(picks)||picks<1||picks>10||!Number.isInteger(hits)||hits<0||hits>picks)throw Error('Invalid Keno probability row');
 const choose=(n,k)=>{let value=1;for(let i=1;i<=k;i++)value=value*(n-i+1)/i;return value;};
 return choose(picks,hits)*choose(80-picks,20-hits)/choose(80,20);
}
// Analytic long-run RTP: Markov stationary distribution across ten meter states.
export function nineLivesExpectedRtp(picks){
 const rows=Array.from({length:picks+1},(_,h)=>({hits:h,probability:hypergeometricProbability(picks,h),pay:nineLivesCandidateMultiplier(picks,h)}));
 let distribution=[1,0,0,0,0,0,0,0,0,0];
 for(let i=0;i<20000;i++){
  const next=Array(10).fill(0);
  for(let state=0;state<10;state++)for(const row of rows){
   const destination=state===9?(row.pay>0?0:9):Math.min(9,state+row.hits);
   next[destination]+=distribution[state]*row.probability;
  }
  const difference=Math.max(...next.map((v,i)=>Math.abs(v-distribution[i])));
  distribution=next;
  if(difference<1e-14)break;
 }
 const base=rows.reduce((sum,row)=>sum+row.probability*row.pay,0);
 return {base,bonus:base*distribution[9],combined:base*(1+distribution[9]),bonusReadyProbability:distribution[9]};
}
