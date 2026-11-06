// Audits the unmodified merged engine, not a separate math reproduction.
// Usage: node scripts/dads-secret-stash-tail-audit.mjs 8000000 20261106
import {spin,newGame,freeBonus,MAX_WIN_MULTIPLIER} from '../src/dads-secret-stash-engine.js';
const N=Number(process.argv[2]??8000000),initial=Number(process.argv[3]??20261106)>>>0;
if(!Number.isSafeInteger(N)||N<1000||N>30000000)throw Error('Invalid round count');
let seed=initial||1;function rng(){seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;}
const components=['base','jen','family','keller','bud','free','stash','mow'];
const sums=Object.fromEntries(components.map(k=>[k,0])),freq=Object.fromEntries(components.map(k=>[k,0]));
let sum=0,sumsq=0,capped=0,wins=0,max=0,rawSum=0;
const bins=[0,.01,.1,1,5,10,25,50,100,250,500,1000,2500,5000,10000,Infinity],hist=new Array(bins.length).fill(0);
const started=Date.now();
for(let n=0;n<N;n++){
 const {last}=spin({...newGame(),balance:1e12,bet:1},rng);
 const raw=last.base.units+last.events.reduce((v,e)=>v+e.units,0);
 const scale=raw>0?last.win/raw:0;
 sums.base+=last.base.units*scale;
 if(last.base.units>0)freq.base++;
 for(const e of last.events){sums[e.type]+=e.units*scale;freq[e.type]++;}
 rawSum+=raw;sum+=last.win;sumsq+=last.win**2;
 if(raw>MAX_WIN_MULTIPLIER)capped++;
 if(last.win>0)wins++;
 max=Math.max(max,last.win);
 hist[bins.findIndex(x=>last.win<=x)]++;
}
const rtp=sum/N,sd=Math.sqrt(Math.max(0,sumsq/N-rtp**2)),se=sd/Math.sqrt(N);
const result={N,seed:initial,rtpPercent:rtp*100,confidence95Percent:[(rtp-1.96*se)*100,(rtp+1.96*se)*100],rawRtpPercent:rawSum/N*100,
 volatilityPerUnitWager:sd,winFrequency:wins/N,capFrequency:capped/N,capped,maxWin:max,
 contributionPercent:Object.fromEntries(components.map(k=>[k,sums[k]/N*100])),
 featureFrequency:Object.fromEntries(components.map(k=>[k,freq[k]/N])),
 histogram:Object.fromEntries(bins.map((value,i)=>[String(value),hist[i]])),seconds:(Date.now()-started)/1000};
console.log('ENGINE_RTP_AUDIT '+JSON.stringify(result));
// Conditional feature stress: 150,000 actual freeBonus() runs per seed.
// Unlike full-round sample this produces far more extreme free-spin events.
const bonusN=Number(process.argv[4]??150000),bonusSeed=(initial^0x9e3779b9)>>>0;
seed=bonusSeed||1;let bonusSum=0,bonusSq=0,bonusMax=0,bonusAboveCap=0;
const bonusThresholds=[50,100,500,1000,2500,5000,10000,20000,50000],tail=Object.fromEntries(bonusThresholds.map(v=>[v,0]));
for(let i=0;i<bonusN;i++){
 const b=freeBonus(rng).units;bonusSum+=b;bonusSq+=b*b;bonusMax=Math.max(bonusMax,b);
 if(b>MAX_WIN_MULTIPLIER)bonusAboveCap++;
 for(const v of bonusThresholds)if(b>=v)tail[v]++;
}
const mean=bonusSum/bonusN,bonusSd=Math.sqrt(Math.max(0,bonusSq/bonusN-mean*mean));
console.log('FREE_SPIN_TAIL '+JSON.stringify({N:bonusN,seed:bonusSeed,meanUncapped:mean,
 ci95:[mean-1.96*bonusSd/Math.sqrt(bonusN),mean+1.96*bonusSd/Math.sqrt(bonusN)],
 maximumUncapped:bonusMax,aboveWholeSpinCap:bonusAboveCap,
 thresholdCounts:tail}));
