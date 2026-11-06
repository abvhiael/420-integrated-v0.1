import {initialState,nextRound,MAX_MULTIPLIER,BASE_STRIPS,FREE_STRIPS,HOTBOX_PAYS} from '../src/sin-city-engine.js';

// Audit the unchanged, authoritative client engine, including whole bonus
// episodes. Each paid initiating spin is exactly one statistical observation.
const samples=Number(process.env.SPINS_PER_SEED||150000);
const seeds=(process.env.RTP_SEEDS||'420,1337,20261106').split(',').map(Number);
const stake=Number(process.env.AUDIT_STAKE||2);
if(!Number.isSafeInteger(samples)||samples<1||!Number.isFinite(stake)||stake<1||stake>50||seeds.some(seed=>!Number.isSafeInteger(seed)))throw Error('Invalid audit settings');
const rngFromSeed=seed=>{let v=seed>>>0;return ()=>{v^=v<<13;v^=v>>>17;v^=v<<5;return (v>>>0)/4294967296;}};
const one=seed=>{
 const rng=rngFromSeed(seed);
 let paid=0,total=0,base=0,free=0,hotbox=0,freeTriggers=0,hotboxTriggers=0,freeRounds=0,hotboxRounds=0;
 let zeroRounds=0,capped=0,lowriderRounds=0,retriggers=0,freeSpinAwards=0,maxWin=0,upperTail100=0,upperTail500=0,upperTail1000=0;
 let sumSq=0,maxFeatureSpins=0,lockedMax=0,stickyMax=0;
 const largest=[];
 const distribution={hotboxGems:{},freeInitialSpins:{},featureSpins:{}};
 for(let i=0;i<samples;i++){
  const begin=initialState();begin.balance=10000000;begin.stake=stake;
  let s=nextRound(begin,rng),gross=s.lastWin,firstMode=s.mode,featureCount=0;
  base+=gross;
  if(firstMode==='hotbox')hotboxTriggers++;
  if(firstMode==='free'){freeTriggers++;freeSpinAwards+=s.freeRemaining;distribution.freeInitialSpins[s.freeRemaining]=(distribution.freeInitialSpins[s.freeRemaining]||0)+1;}
  while(s.mode!=='base'){
   if(++featureCount>300)throw Error('Bonus state failed to finish at paid spin '+i+' seed '+seed);
   const mode=s.mode;
   const beforeGross=s.roundGross;
   s=nextRound(s,rng);
   gross+=s.lastWin;
   if(s.roundGross+1e-6<beforeGross)throw Error('Round gross decreased');
   if(mode==='free'){
    free+=s.lastWin;freeRounds++;
    if(s.lastFeature==='lowrider')lowriderRounds++;
    retriggers+=s.lastRetriggeredSpins||0;
    stickyMax=Math.max(stickyMax,s.sticky.length);
   }else if(mode==='hotbox'){
    hotbox+=s.lastWin;hotboxRounds++;
    if(s.mode==='hotbox')lockedMax=Math.max(lockedMax,s.locked.length);
    if(s.lastFeature==='hotbox-end'){
     // The last locked state is cleared after settlement. The award itself is
     // still captured exactly by the game engine.
     const awardFactor=Math.round(s.lastWin/s.roundStake);
     distribution.hotboxGems[awardFactor]=(distribution.hotboxGems[awardFactor]||0)+1;
    }
   }
  }
  paid++;
  if(gross===0)zeroRounds++;
  const x=gross/stake;
  total+=gross;
  sumSq+=x*x;
  maxWin=Math.max(maxWin,x);
  maxFeatureSpins=Math.max(maxFeatureSpins,featureCount);
  if(x>=MAX_MULTIPLIER-1e-8)capped++;
  if(x>=100)upperTail100++;
  if(x>=500)upperTail500++;
  if(x>=1000)upperTail1000++;
  if(x>0&&largest.length<10){largest.push(x);largest.sort((a,b)=>b-a);}
  else if(x>largest[largest.length-1]){largest[largest.length-1]=x;largest.sort((a,b)=>b-a);}
  if(featureCount>0)distribution.featureSpins[Math.min(featureCount,100)]=(distribution.featureSpins[Math.min(featureCount,100)]||0)+1;
  if((i+1)%50000===0)console.log('PROGRESS '+JSON.stringify({seed,paid:i+1,rtpPct:+(100*total/(stake*(i+1))).toFixed(4),freeTriggers,hotboxTriggers,capHits:capped}));
 }
 const mean=total/(stake*paid),variance=Math.max(0,sumSq/paid-mean*mean),se=Math.sqrt(variance/paid);
 return {seed,paidSpins:paid,stake,rtpPct:100*mean,normal95Pct:[100*(mean-1.96*se),100*(mean+1.96*se)],standardErrorPct:100*se,
  baseRtpPct:100*base/(stake*paid),freeRtpPct:100*free/(stake*paid),hotboxRtpPct:100*hotbox/(stake*paid),
  freeTriggers,hotboxTriggers,freeRounds,hotboxRounds,lowriderRounds,retriggeredSpins:retriggers,freeSpinAwards,
  zeroRounds,cappedRounds:capped,over100x:upperTail100,over500x:upperTail500,over1000x:upperTail1000,
  maxWinX:maxWin,maxBonusSpins:maxFeatureSpins,maxHeldGems:lockedMax,maxStickyWilds:stickyMax,largestX:largest,distribution};
};
const results=seeds.map(one);
const sum=(key)=>results.reduce((v,r)=>v+r[key],0);
const combinedSpins=sum('paidSpins');
const combined={
 paidSpins:combinedSpins,stake,
 rtpPct:results.reduce((v,r)=>v+r.rtpPct*r.paidSpins,0)/combinedSpins,
 baseRtpPct:results.reduce((v,r)=>v+r.baseRtpPct*r.paidSpins,0)/combinedSpins,
 freeRtpPct:results.reduce((v,r)=>v+r.freeRtpPct*r.paidSpins,0)/combinedSpins,
 hotboxRtpPct:results.reduce((v,r)=>v+r.hotboxRtpPct*r.paidSpins,0)/combinedSpins,
 freeTriggers:sum('freeTriggers'),hotboxTriggers:sum('hotboxTriggers'),
 freeRounds:sum('freeRounds'),hotboxRounds:sum('hotboxRounds'),
 lowriderRounds:sum('lowriderRounds'),retriggeredSpins:sum('retriggeredSpins'),
 cappedRounds:sum('cappedRounds'),zeroRounds:sum('zeroRounds'),
 over100x:sum('over100x'),over500x:sum('over500x'),over1000x:sum('over1000x'),
 maxWinX:Math.max(...results.map(r=>r.maxWinX)),
 maxBonusSpins:Math.max(...results.map(r=>r.maxBonusSpins)),
 maxHeldGems:Math.max(...results.map(r=>r.maxHeldGems)),
 maxStickyWilds:Math.max(...results.map(r=>r.maxStickyWilds)),
 largestX:results.flatMap(r=>r.largestX).sort((a,b)=>b-a).slice(0,15)
};
const pooledVariance=results.reduce((sum,r)=>{
 const n=r.paidSpins,mean=r.rtpPct/100;
 const within=Math.pow(r.standardErrorPct/100,2)*n*(n-1);
 return sum+within+n*Math.pow(mean-combined.rtpPct/100,2);
},0)/Math.max(1,combinedSpins-1);
const pooledSE=100*Math.sqrt(pooledVariance/combinedSpins);
combined.normal95Pct=[combined.rtpPct-1.96*pooledSE,combined.rtpPct+1.96*pooledSE];
combined.standardErrorPct=pooledSE;
console.log('RTP_AUDIT_RESULT '+JSON.stringify({status:'provisional-calibrated-practice-engine',method:'seeded sequential Monte Carlo; full bonus episodes and 5000x cap',baseStripLengths:BASE_STRIPS.map(r=>r.length),freeStripLengths:FREE_STRIPS.map(r=>r.length),hotboxPays:HOTBOX_PAYS,combined,seeds:results}));
