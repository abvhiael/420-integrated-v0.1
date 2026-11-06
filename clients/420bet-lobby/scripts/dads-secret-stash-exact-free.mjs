// Exact uncapped expectation for Five Minutes of Peace. Compute a
// finite-state Markov reward chain over (sticky Wilds in reels 1..5).
// The six-position cap clips new Wilds in board/reel order.
import {SYMBOLS,PAY,FREE_WEIGHTS,FREE_STICKY_LIMIT,FREE_MULTIPLIER_STAGES} from '../src/dads-secret-stash-engine.js';
const baseWeights=[3,4,5,5,4,5,7,7,10,12,12,14,14,14,14,14,3,2,3,2];
const sum=a=>a.reduce((x,y)=>x+y,0),total=sum(FREE_WEIGHTS),wild=FREE_WEIGHTS[SYMBOLS.indexOf('wild')],p=wild/total;
const cap=FREE_STICKY_LIMIT,stateCount=5**5;
const counts=Array.from({length:stateCount},(_,i)=>Array.from({length:5},(_,j)=>Math.floor(i/5**j)%5));
const valid=counts.map(c=>sum(c)<=cap);
const binom=[[1],[1,1],[1,2,1],[1,3,3,1],[1,4,6,4,1]];
const draws=Array.from({length:5},(_,n)=>Array.from({length:n+1},(_,k)=>binom[n][k]*p**k*(1-p)**(n-k)));
function exactExpectedWin(c){
 let result=0;
 for(const [symbol,pay] of Object.entries(PAY)){
  const q=FREE_WEIGHTS[SYMBOLS.indexOf(symbol)]/(total-wild);
  const h=c.map(w=>w+(4-w)*q),z=c.map(w=>w?0:(1-q)**4);
  const p3=h[0]*h[1]*h[2],p4=p3*h[3];
  result+=p3*z[3]*pay[1]+p4*z[4]*pay[2]+p4*h[4]*pay[3];
 }
 return result;
}
const reward=counts.map((c,id)=>valid[id]?exactExpectedWin(c):0);
let state=new Float64Array(stateCount);state[0]=1;
let mean=0;const rounds=[];
for(let spin=1;spin<=22;spin++){
 const next=new Float64Array(stateCount);
 for(let id=0;id<stateCount;id++){
  const probability=state[id];if(!probability)continue;
  const old=counts[id];
  const step=(reel,code,used,weight)=>{
   if(reel===5){next[code]+=weight;return;}
   const open=4-old[reel];
   for(let gained=0;gained<=open;gained++){
    const actual=Math.min(gained,cap-used);
    step(reel+1,code+actual*5**reel,used+actual,weight*draws[open][gained]);
   }
  };
  step(0,id,sum(old),probability);
 }
 state=next;let mass=0,roundMean=0;
 for(let id=0;id<stateCount;id++){mass+=state[id];roundMean+=state[id]*reward[id];}
 if(Math.abs(mass-1)>1e-9)throw Error('DP probability mass drift: '+mass);
 const multiplier=spin<=6?FREE_MULTIPLIER_STAGES[0]:spin<=12?FREE_MULTIPLIER_STAGES[1]:FREE_MULTIPLIER_STAGES[2];
 const activation=spin<=8?1:spin<=15?2/3:1/3;
 const contribution=roundMean*multiplier*activation;mean+=contribution;
 rounds.push({spin,roundMean,multiplier,activation,contribution});
}
const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
const pScatter=baseWeights[SYMBOLS.indexOf('scatter')]/sum(baseWeights);
let trigger=0;for(let k=3;k<=20;k++)trigger+=choose(20,k)*pScatter**k*(1-pScatter)**(20-k);
console.log('EXACT_FREE_MATH '+JSON.stringify({freeWeightTotal:total,wildDrawProbability:p,freeTriggerProbability:trigger,freeMeanUncapped:mean,freeRtpContributionUncappedPercent:mean*trigger*100,stickyCap:cap,rounds}));
