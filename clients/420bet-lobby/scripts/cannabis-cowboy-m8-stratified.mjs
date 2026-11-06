// Stratified, exact-trigger-weighted RTP estimate for 6x8 Cannabis Cowboy.
// Unlike random paid-spin Monte Carlo, samples the rare free-spin feature
// directly and combines conditional means with exact trigger probabilities.
import {makeScatterBoard,resolveRound,resolveEndlessHarvest,SCATTER_CHANCE,ROAD_CHANCE,MAX_FEATURE_PAYOUT_BETS,BET_CHOICES} from '../src/cannabis-cowboy-engine.js';
import {ROAD_CASE_MULTIPLIERS} from '../src/cannabis-cowboy-road-trip.js';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const args=process.argv.slice(2);
const num=(name,fallback)=>{const i=args.indexOf('--'+name);return i<0?fallback:Number(args[i+1]);};
const bet=num('bet',20),baseN=num('base',250000),seed=num('seed',7654321);
const allocation=[num('feature3',50000),num('feature4',10000),num('feature5',2000),num('feature6',1000)];
if(!BET_CHOICES.includes(bet)||![baseN,seed,...allocation].every(x=>Number.isSafeInteger(x)&&x>0))throw Error('Invalid stratified inputs');
const rng=(n)=>{let x=n>>>0;return ()=>((x=(Math.imul(x,1664525)+1013904223)>>>0)/4294967296)};
const binomial=(n,p,k)=>{
 let c=1;for(let i=1;i<=k;i++)c=c*(n-i+1)/i;
 return c*p**k*(1-p)**(n-k);
};
const groups=[{k:3,award:8},{k:4,award:12},{k:5,award:16},{k:6,award:20}];
groups.forEach((g,i)=>{g.probability=g.k===6?Array.from({length:43},(_,x)=>binomial(48,SCATTER_CHANCE,x+6)).reduce((a,b)=>a+b,0):binomial(48,SCATTER_CHANCE,g.k);g.samples=allocation[i];});
const moments=()=>({n:0,sum:0,sumSq:0,max:0,capHits:0,cascadeCaps:0});
function record(m,v){m.n++;m.sum+=v;m.sumSq+=v*v;m.max=Math.max(m.max,v);}
function calc(m){const mean=m.sum/m.n,variance=m.n>1?Math.max(0,(m.sumSq-m.sum*m.sum/m.n)/(m.n-1)):0;return {samples:m.n,mean,variance,stderr:Math.sqrt(variance/m.n),max:m.max,capHits:m.capHits,cascadeCaps:m.cascadeCaps};}
const base=moments();let rejections=0;
for(let i=0;i<baseN;i++){
 const r=rng((seed+Math.imul(i+1,0x9e3779b9))>>>0);
 try{record(base,resolveRound(makeScatterBoard(r),bet,r).total);}
 catch(e){rejections++;}
}
const baseStat=calc(base);
let meanBonus=0,bonusVarianceOfMean=0;
for(let index=0;index<groups.length;index++){
 const group=groups[index],stats=moments();
 for(let i=0;i<group.samples;i++){
  const r=rng((seed+Math.imul(i+1,0x85ebca6b)+Math.imul(index+1,0xc2b2ae35))>>>0);
  try{
   const result=resolveEndlessHarvest(group.award,bet,r);
   record(stats,result.total);
   if(result.total>=MAX_FEATURE_PAYOUT_BETS*bet)stats.capHits++;
   stats.cascadeCaps+=result.spins.reduce((n,s)=>n+(s.outcome.bonusCascadeCapped?1:0),0);
  }catch(e){rejections++;}
 }
 group.stat=calc(stats);
 meanBonus+=group.probability*group.stat.mean;
 bonusVarianceOfMean+=group.probability**2*group.stat.variance/group.stat.samples;
}
const exactRoad=Array.from({length:46},(_,k)=>binomial(48,ROAD_CHANCE,k+3)).reduce((a,b)=>a+b,0)*5*ROAD_CASE_MULTIPLIERS.reduce((s,x)=>s+x,0)/ROAD_CASE_MULTIPLIERS.length*bet;
const total=baseStat.mean+meanBonus+exactRoad;
const stderr=Math.sqrt(baseStat.variance/baseStat.samples+bonusVarianceOfMean);
const result={
 inputs:{bet,seed,baseN,featureSamples:allocation,scatterChance:SCATTER_CHANCE,roadChance:ROAD_CHANCE},
 base:baseStat,bonusGroups:groups,expected:{baseRtp:baseStat.mean/bet,bonusRtp:meanBonus/bet,roadRtp:exactRoad/bet,totalRtp:total/bet,ci95:[(total-1.96*stderr)/bet,(total+1.96*stderr)/bet],standardError:stderr/bet},
 rejections,target:[.95,.96],qualified:rejections===0&&(total-1.96*stderr)/bet>=.95&&(total+1.96*stderr)/bet<=.96,
 notes:['Exact binomial trigger weighting; conditional feature means estimated by deterministic independent streams.','Road Trip component uses exact case expected value and exact marginal ticket-trigger probability.','Confidence bounds are normal approximations; extreme tail bounded by feature cap, but separate independent seed checks still required.']
};
console.log('COWBOY_M8_STRATIFIED='+JSON.stringify(result));
const out=args.indexOf('--output');if(out>=0){const filename=args[out+1];mkdirSync(dirname(filename),{recursive:true});writeFileSync(filename,JSON.stringify(result,null,2));}
