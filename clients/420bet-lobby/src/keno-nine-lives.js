// Browser-only virtual-credit candidate. NOT an authorized on-chain wagering ruleset.
import {proposedGrossMultiplier} from './keno-candidate-paytable.js';
export const NINE_LIVES_TARGET=9;
export const NINE_LIVES_RTP_TARGET=0.95;
export function hypergeometricProbability(picks,hits){
 if(!Number.isInteger(picks)||picks<1||picks>10||!Number.isInteger(hits)||hits<0||hits>picks)throw Error('Invalid Keno probability row');
 const choose=(n,k)=>{let value=1;for(let i=1;i<=k;i++)value=value*(n-i+1)/i;return value;};
 return choose(picks,hits)*choose(80-picks,20-hits)/choose(80,20);
}
// Only 0- or 1-hit, non-paying draws add ONE life. Non-paying draws with 2+ hits
// leave progress unchanged; any paying draw resets progress to zero.
// A paying draw entered at 9/9 earns 2x and then resets the meter.
export function advanceNineLives(progress,hits,pays){
 if(!Number.isInteger(progress)||progress<0||progress>9||!Number.isInteger(hits)||hits<0||hits>10||typeof pays!=='boolean')throw Error('Invalid Nine Lives transition');
 if(pays)return {progress:0,bonusApplied:progress===9,bonusReady:false};
 const newProgress=Math.min(9,progress+(hits<=1?1:0));
 return {progress:newProgress,bonusApplied:false,bonusReady:newProgress===9};
}
function rawMath(picks){
 if(!Number.isInteger(picks)||picks<1||picks>10)throw Error('Invalid Keno pick count');
 let base=0,lossProbability=0,chargingProbability=0;
 for(let hits=0;hits<=picks;hits++){
  const probability=hypergeometricProbability(picks,hits);
  const payout=Number(proposedGrossMultiplier(picks,hits));
  base+=probability*payout;
  if(payout===0){lossProbability+=probability;if(hits<=1)chargingProbability+=probability;}
 }
 // A paying draw resets; an eligible 0/1-hit nonpaying draw advances;
 // all other nonpaying draws leave the meter unchanged.
 // The embedded chain at change events has charge probability a/(a+w).
 // Its steady-state probability of being full is [a/(a+w)]^9.
 const payingProbability=1-lossProbability;
 const chargeAmongDecisive=chargingProbability/(chargingProbability+payingProbability);
 const readyProbability=chargeAmongDecisive**NINE_LIVES_TARGET;
 return {base,lossProbability,chargingProbability,payingProbability,readyProbability};
}
// Calculate rather than hardcode scaling so each fixed pick count is calibrated
// against its OWN win/no-pay probabilities. The displayed table rounds to 4 dp.
export const NINE_LIVES_SCALES=Object.freeze(Object.fromEntries(
 Array.from({length:10},(_,i)=>{
  const picks=i+1,{base,readyProbability}=rawMath(picks);
  return [picks,NINE_LIVES_RTP_TARGET/(base*(1+readyProbability))];
 })
));
export function nineLivesCandidateMultiplier(picks,hits){
 const base=Number(proposedGrossMultiplier(picks,hits));
 return Number((base*NINE_LIVES_SCALES[picks]).toFixed(4));
}
export function nineLivesRound(progress,picks,hits){
 const baseMultiplier=nineLivesCandidateMultiplier(picks,hits);
 const transition=advanceNineLives(progress,hits,baseMultiplier>0);
 return {...transition,baseMultiplier,effectiveMultiplier:Number((baseMultiplier*(transition.bonusApplied?2:1)).toFixed(4))};
}
export function nineLivesExpectedRtp(picks){
 const {lossProbability,chargingProbability,payingProbability,readyProbability}=rawMath(picks);
 let base=0;
 for(let hits=0;hits<=picks;hits++)base+=hypergeometricProbability(picks,hits)*nineLivesCandidateMultiplier(picks,hits);
 return {base,bonus:base*readyProbability,combined:base*(1+readyProbability),bonusReadyProbability:readyProbability,lossProbability,chargingProbability,payingProbability};
}
