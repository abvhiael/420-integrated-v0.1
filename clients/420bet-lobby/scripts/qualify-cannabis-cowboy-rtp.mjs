// Reproducible practice-engine RTP / extreme-tail qualification.
// Usage: node scripts/qualify-cannabis-cowboy-rtp.mjs --spins=1000000 --seed=20261107 --bet=20
// Does not change gameplay or contact a wallet, provider, or live service.
import {makeScatterBoard,resolveRound,resolveEndlessHarvest,awardedFreeSpins,countScatters,countRoadTickets,ROAD_CHANCE,CELL_COUNT,MAX_FREE_SPINS,BASE_PAY_SCALE,HARVEST_PAY_SCALE} from '../src/cannabis-cowboy-engine.js';
import {createRoadTrip,chooseRoadCase,ROAD_CASE_MULTIPLIERS,ROAD_STACKABLE_MULTIPLIERS} from '../src/cannabis-cowboy-road-trip.js';
const arg=(name,def)=>{const pair=process.argv.find(x=>x.startsWith('--'+name+'='));return pair?Number(pair.slice(name.length+3)):def;};
const spins=arg('spins',1000000),seed=arg('seed',20261107),bet=arg('bet',20);
if(!Number.isSafeInteger(spins)||spins<1000||spins>10000000||!Number.isSafeInteger(seed)||!Number.isSafeInteger(bet)||![10,20,30,40,50].includes(bet))throw new Error('Invalid calibration arguments');
let state=seed>>>0;
const rng=()=>((state=(Math.imul(1664525,state)+1013904223)>>>0)/4294967296);
const totals=[],counts={attempts:spins,accepted:0,rejected:0,reasons:{},base:0,harvest:0,road:0,harvestTriggers:0,roadTriggers:0,harvestSpins:0,harvestRetriggers:0,zeroWins:0,losses:0,paid100x:0,paid250x:0,paid500x:0,paid1000x:0,maxBase:0,maxHarvest:0,maxRoad:0,maxRound:0,roadMultiplierMax:0,harvestCapHits:0};
for(let n=0;n<spins;n++){
 try{
  const board=makeScatterBoard(rng),base=resolveRound(board,bet,rng).total;
  let harvest=0,road=0;
  const free=awardedFreeSpins(countScatters(board));
  if(free){
   const feature=resolveEndlessHarvest(free,bet,rng);
   harvest=feature.total;counts.harvestTriggers++;counts.harvestSpins+=feature.played;
   counts.harvestRetriggers+=feature.played-free;
   if(feature.capReached)counts.harvestCapHits++;
  }
  if(countRoadTickets(board)>=3){
   const trip=createRoadTrip(bet,rng);let picks=[],result;
   for(let stop=0;stop<5;stop++){result=chooseRoadCase(trip,picks,Math.floor(rng()*3));picks=result.picks;}
   road=result.total;counts.roadTriggers++;
   counts.roadMultiplierMax=Math.max(counts.roadMultiplierMax,result.stackedMultiplier);
  }
  const total=base+harvest+road;
  if(!Number.isSafeInteger(total))throw new Error('Unsafe combined award');
  counts.accepted++;counts.base+=base;counts.harvest+=harvest;counts.road+=road;
  counts.maxBase=Math.max(counts.maxBase,base);counts.maxHarvest=Math.max(counts.maxHarvest,harvest);
  counts.maxRoad=Math.max(counts.maxRoad,road);counts.maxRound=Math.max(counts.maxRound,total);
  if(!total)counts.zeroWins++;
  if(total<bet)counts.losses++;
  if(total>=100*bet)counts.paid100x++;
  if(total>=250*bet)counts.paid250x++;
  if(total>=500*bet)counts.paid500x++;
  if(total>=1000*bet)counts.paid1000x++;
  totals.push(total/bet);
 }catch(error){counts.rejected++;const message=String(error);counts.reasons[message]=(counts.reasons[message]??0)+1;}
}
totals.sort((a,b)=>a-b);
const quantile=q=>totals.length?totals[Math.min(totals.length-1,Math.ceil(q*totals.length)-1)]:null;
const sum=counts.base+counts.harvest+counts.road;
const totalRtp=sum/(spins*bet);
const sumSquares=totals.reduce((acc,n)=>acc+n*n,0);
const standardError=Math.sqrt(Math.max(0,sumSquares/spins-totalRtp*totalRtp)/spins);
const topShare=f=>{const start=Math.floor(totals.length*(1-f));return totals.slice(start).reduce((a,b)=>a+b,0)/((sum/bet)||1);};
const pRoad=ROAD_CHANCE,p0=(1-pRoad)**CELL_COUNT,p1=p0*CELL_COUNT*pRoad/(1-pRoad),p2=p1*(CELL_COUNT-1)*pRoad/(2*(1-pRoad));
const roadTriggerProbability=1-p0-p1-p2;
const creditAverage=ROAD_CASE_MULTIPLIERS.reduce((sum,m)=>sum+Math.round(m*bet),0)/ROAD_CASE_MULTIPLIERS.length;
const multiplierAverage=ROAD_STACKABLE_MULTIPLIERS.reduce((sum,m)=>sum+m,0)/ROAD_STACKABLE_MULTIPLIERS.length;
const expectedRoadCredits=5*4*(2/3)*(1/3)*creditAverage*multiplierAverage + (2/3)**5*5*creditAverage;
const roadTripExactRtp=roadTriggerProbability*expectedRoadCredits/bet;
// Enumerate five-stop theoretical max (credits on n stops, largest available multiplier on others).
const maxCaseCredit=Math.max(...ROAD_CASE_MULTIPLIERS.map(m=>Math.round(m*bet)));
const roadTripMaximum=Math.max(...Array.from({length:6},(_,multiplierPicks)=>maxCaseCredit*(5-multiplierPicks)*(multiplierPicks?multiplierPicks*Math.max(...ROAD_STACKABLE_MULTIPLIERS):1)));
const output={seed,spins,bet,calibration:{baseScale:BASE_PAY_SCALE,harvestScale:HARVEST_PAY_SCALE},rtp:{base:counts.base/(spins*bet),endlessHarvest:counts.harvest/(spins*bet),roadTrip:counts.road/(spins*bet),combined:totalRtp,standardError,approx95CI:[totalRtp-1.96*standardError,totalRtp+1.96*standardError]},roadTripCheck:{analyticalTriggerProbability:roadTriggerProbability,analyticalRtp:roadTripExactRtp,maximumPossibleAwardCredits:roadTripMaximum},counts,tail:{p95x:quantile(.95),p99x:quantile(.99),p999x:quantile(.999),p9999x:quantile(.9999),topOnePercentWinShare:topShare(.01),topPointOnePercentWinShare:topShare(.001)}};
console.log(JSON.stringify(output,null,2));
if(counts.rejected)process.exitCode=1;
