// Browser-only illustrative Plinko schedules; NOT approved for on-chain settlement.
export const PLINKO_BUCKET_CHOICES=Object.freeze([8,9,10,11,12,13,14,15,16,17]);
export const PLINKO_RISKS=Object.freeze(['soundcheck','showtime','riot']);
export const PLINKO_DROP_CHOICES=Object.freeze([1,5,10,25]);
const TARGET=0.96;
const FACTORS={soundcheck:{center:0.72,edge:4},showtime:{center:0.34,edge:22},riot:{center:0.08,edge:160}};
export function plinkoPath(bucketCount,random=()=>crypto.getRandomValues(new Uint32Array(1))[0]/4294967296){
 if(!PLINKO_BUCKET_CHOICES.includes(bucketCount))throw Error('Unsupported bucket count');
 const bits=[];
 for(let i=1;i<bucketCount;i++){const value=random();if(!Number.isFinite(value)||value<0||value>=1)throw Error('Invalid entropy');bits.push(value<0.5?0:1);}
 return bits;
}
function combinations(n){const out=[1];for(let k=1;k<=n;k++)out.push(out[k-1]*(n-k+1)/k);return out;}
export function plinkoSchedule(bucketCount,risk){
 if(!PLINKO_BUCKET_CHOICES.includes(bucketCount)||!PLINKO_RISKS.includes(risk))throw Error('Invalid practice schedule');
 const n=bucketCount-1,weights=combinations(n).map(x=>x/2**n),{center,edge}=FACTORS[risk];
 const raw=weights.map((_,i)=>{const d=Math.abs(2*i/n-1);return center+(edge-center)*d**(risk==='riot'?7:risk==='showtime'?5:3);});
 const expectation=raw.reduce((sum,v,i)=>sum+v*weights[i],0);
 const exact=raw.map(x=>x*TARGET/expectation);
 return Object.freeze(exact.map(x=>Number(x.toFixed(4))));
}
export function plinkoExpectedReturn(bucketCount,risk){
 const n=bucketCount-1,w=combinations(n).map(x=>x/2**n),schedule=plinkoSchedule(bucketCount,risk);
 return schedule.reduce((sum,x,i)=>sum+x*w[i],0);
}
export function plinkoMultiplierLabel(bucket,bucketCount=13,risk='showtime'){
 const schedule=plinkoSchedule(bucketCount,risk);
 if(!Number.isInteger(bucket)||bucket<0||bucket>=schedule.length)throw Error('Invalid bucket');
 return schedule[bucket].toFixed(2)+'×';
}
export const PLINKO_PRACTICE_WAGER=0;
export function plinkoPracticeGrossPayout(bucket,bucketCount=13,risk='showtime'){
 plinkoMultiplierLabel(bucket,bucketCount,risk);return 0;
}
