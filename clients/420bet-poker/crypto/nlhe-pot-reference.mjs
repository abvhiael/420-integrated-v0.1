// Deliberately slower independent reference pot evaluator for deterministic
// differential testing. This code does not import the production pot algorithm.
function cmp(a,b){
 for(let i=0;i<Math.max(a.length,b.length);i++){
  if((a[i]??0)>(b[i]??0))return 1;
  if((a[i]??0)<(b[i]??0))return -1;
 }
 return 0;
}
export function referenceAward({contributions,folded,ranks,button}){
 const n=contributions.length;
 if(n<2||n>9||folded.length!==n||ranks.length!==n||!Number.isInteger(button)||button<0||button>=n)throw Error('invalid seats');
 if(contributions.some(x=>!Number.isSafeInteger(x)||x<0||x>500))throw Error('reference accepts small chip samples only');
 const spent=[...contributions],returns=Array(n).fill(0);
 const max=Math.max(...spent),top=spent.findIndex(x=>x===max);
 if(spent.filter(x=>x===max).length===1){
  const second=Math.max(...spent.filter((_,i)=>i!==top));
  returns[top]=max-second;spent[top]=second;
 }
 const won=Array(n).fill(0),maxLevel=Math.max(...spent);
 for(let level=1;level<=maxLevel;level++){
  const supporters=spent.map((c,i)=>c>=level?i:-1).filter(i=>i>=0);
  if(!supporters.length)continue;
  const contestants=supporters.filter(i=>!folded[i]);
  if(!contestants.length)throw Error('no eligible player');
  let best=contestants[0],winners=[];
  for(const i of contestants)if(cmp(ranks[i],ranks[best])>0)best=i;
  for(const i of contestants)if(cmp(ranks[i],ranks[best])===0)winners.push(i);
  const each=Math.floor(supporters.length/winners.length);
  for(const i of winners)won[i]+=each;
  const ordered=[...winners].sort((a,b)=>(a-button-1+n)%n-(b-button-1+n)%n);
  let odd=supporters.length%winners.length;
  for(const i of ordered)if(odd-->0)won[i]++;
 }
 const payout=won.map((x,i)=>x+returns[i]);
 if(payout.reduce((a,v)=>a+v,0)!==contributions.reduce((a,v)=>a+v,0))throw Error('conservation');
 return payout;
}
