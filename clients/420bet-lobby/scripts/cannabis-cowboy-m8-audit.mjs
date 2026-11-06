// Cannabis Cowboy M8 standalone deterministic math audit.
// Does not import any UI code or alter a player's state. Practice only.
import {makeScatterBoard,resolveRound,resolveEndlessHarvest,awardedFreeSpins,countScatters,countRoadTickets,ROAD_TRIGGER_COUNT,
 SCATTER_CHANCE,ROAD_CHANCE,MAX_CASCADES,MAX_CLUSTER_MULTIPLIER,MAX_FREE_SPINS,
 BET_CHOICES} from '../src/cannabis-cowboy-engine.js';
import {createRoadTrip,ROAD_CASE_MULTIPLIERS} from '../src/cannabis-cowboy-road-trip.js';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
const args=process.argv.slice(2);
const arg=(name,otherwise)=>{const x=args.indexOf('--'+name);return x<0?otherwise:Number(args[x+1]);};
const sampleCount=arg('samples',4000),seed=arg('seed',0xC4202026),bet=arg('bet',20);
if(!Number.isSafeInteger(sampleCount)||sampleCount<1||!Number.isSafeInteger(seed)||!BET_CHOICES.includes(bet))throw Error('Invalid qualification options');
const rng=(initial)=>{let state=initial>>>0;return ()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);};
const moments=()=>({n:0,sum:0,sumSq:0,max:0});
function add(m,value){m.n++;m.sum+=value;m.sumSq+=value*value;m.max=Math.max(m.max,value);}
function stat(m){const mean=m.sum/m.n,variance=m.n>1?Math.max(0,(m.sumSq-m.sum*mean)/(m.n-1)):null;return {...m,mean,stderr:variance===null?null:Math.sqrt(variance/m.n),payoutOverBet:mean/bet,ci95:variance===null?null:[(mean-1.96*Math.sqrt(variance/m.n))/bet,(mean+1.96*Math.sqrt(variance/m.n))/bet]};}
const binomial=(n,p,k)=>{
 let c=1;for(let i=1;i<=k;i++)c=c*(n-i+1)/i;
 return c*Math.pow(p,k)*Math.pow(1-p,n-k);
};
const scatterTriggerExact=Array.from({length:49},(_,i)=>i).filter(k=>k>=3).reduce((s,k)=>s+binomial(48,SCATTER_CHANCE,k),0);
const roadTriggerExact=Array.from({length:49},(_,i)=>i).filter(k=>k>=3).reduce((s,k)=>s+binomial(48,ROAD_CHANCE,k),0);
const roadMeanMultiplier=ROAD_CASE_MULTIPLIERS.reduce((a,b)=>a+b,0)/ROAD_CASE_MULTIPLIERS.length;
const roadExpectedPerTrigger=roadMeanMultiplier*5;
const base=moments(),bonus=moments(),road=moments(),total=moments(),baseConditional=moments(),bonusConditional=moments();
const errorTypes={},events={scatters3:0,road3:0,dual:0,freeSpins:0,bonusMaxSpins:0,cascades:0,maxCascades:0,wildCluster:0,maxClusterMultiplier:0,maxSpinPay:0,rounds:0,errors:0};
const seedBias=0x9e3779b9;
for(let i=0;i<sampleCount;i++){
 const spinRng=rng((seed + Math.imul(i+1,seedBias))>>>0);
 try{
  const board=makeScatterBoard(spinRng);
  const round=resolveRound(board,bet,spinRng);
  const scatters=countScatters(board),tickets=countRoadTickets(board),freeSpins=awardedFreeSpins(scatters);
  let feature=null;
  if(freeSpins)feature=resolveEndlessHarvest(freeSpins,bet,spinRng);
  // Road Trip: selected case is uniform among three case values determined
  // before choice; selecting case zero gives identical EV when cases are iid.
  let roadPayout=0;
  if(tickets>=ROAD_TRIGGER_COUNT)roadPayout=createRoadTrip(bet,spinRng).stops.reduce((a,stop)=>a+stop.caseValues[0],0);
  const bonusPay=feature?.total??0;
  const overall=round.total+bonusPay+roadPayout;
  add(base,round.total);add(bonus,bonusPay);add(road,roadPayout);add(total,overall);
  if(freeSpins){events.scatters3++;events.freeSpins+=feature.played;events.bonusMaxSpins=Math.max(events.bonusMaxSpins,feature.played);add(bonusConditional,bonusPay);}
  if(tickets>=ROAD_TRIGGER_COUNT)events.road3++;
  if(freeSpins&&tickets>=ROAD_TRIGGER_COUNT)events.dual++;
  if(round.total)add(baseConditional,round.total);
  events.cascades+=round.steps.length;events.maxCascades=Math.max(events.maxCascades,round.steps.length);
  for(const step of round.steps)for(const cluster of step.clusters){
   if(cluster.wildCount)events.wildCluster++;
   events.maxClusterMultiplier=Math.max(events.maxClusterMultiplier,cluster.multiplier);
  }
  events.maxSpinPay=Math.max(events.maxSpinPay,overall);
  events.rounds++;
 }catch(error){events.errors++;const code=String(error?.message??error);errorTypes[code]=(errorTypes[code]??0)+1;}
}
if(!events.rounds)throw Error('No valid rounds');
const exact={
 scatterTriggerProbability:scatterTriggerExact,roadTicketProbability:roadTriggerExact,
 roadConditionalReturnInBets:roadExpectedPerTrigger,
 roadUnconditionalRtp:roadTriggerExact*roadExpectedPerTrigger,
 roadMeanMultiplier
};
const result={
 label:'Cannabis Cowboy M8 uncalibrated diagnostic',timestamp:new Date().toISOString(),
 inputs:{samples:sampleCount,seed,bet,scatterChance:SCATTER_CHANCE,roadChance:ROAD_CHANCE},
 exact,
 observed:{base:stat(base),bonus:stat(bonus),road:stat(road),total:stat(total),baseWinConditional:stat(baseConditional),featureTriggerConditional:stat(bonusConditional)},
 events,errorTypes,
 accounting:{observedTotalRtp:stat(total).payoutOverBet,combinedComponentRtp:(base.sum+bonus.sum+road.sum)/total.n/bet},
 policy:{targetMin:0.95,targetMax:0.96,qualified:events.errors===0&&stat(total).ci95[0]>=.95&&stat(total).ci95[1]<=.96},
 notes:['Reports valid-round RTP only; rejects tracked separately. Do not silently discard rejected rounds in certification.',
 'Exact trigger probabilities use a 48-position binomial model; joint scatter+road events are not independent.',
 'Theoretical conditional Road Trip EV assumes uniformly random one-of-three case selection and iid predetermined case values.',
 'Normal-approximation confidence bounds are descriptive only; heavy tails require separate extreme-event qualifications.']
};
const json=JSON.stringify(result,null,2);
console.log('COWBOY_M8_AUDIT='+JSON.stringify({inputs:result.inputs,exact,observed:{base:result.observed.base.payoutOverBet,bonus:result.observed.bonus.payoutOverBet,road:result.observed.road.payoutOverBet,total:result.observed.total.payoutOverBet,ci95:result.observed.total.ci95},events,errorTypes,qualified:result.policy.qualified}));
const outIndex=args.indexOf('--output');
if(outIndex>=0){const file=args[outIndex+1];mkdirSync(dirname(file),{recursive:true});writeFileSync(file,json);}
