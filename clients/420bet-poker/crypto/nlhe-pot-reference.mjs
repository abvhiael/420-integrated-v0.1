// Deliberately slower independent reference pot evaluator for deterministic
// differential testing. This code does not import the production pot algorithm.
function cmp(a,b){
 for(let i=0;i<Math.max(a.length,b.length);i++){
  if((a[i]??0)>(b[i]??0))return 1;
  if((a[i]??0)<(b[i]??0))return -1;
 }
 return 0;
}
export function referenceAward({contributions,folded,ranks,button,rake=0}){
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
 let layerSize=0,cursor=0,charged=0;
 const gross=spent.reduce((a,b)=>a+b,0);
 if(!Number.isSafeInteger(rake)||rake<0||rake>gross)throw Error('invalid rake');
 for(let level=1;level<=maxLevel;level++){
  const supporters=spent.map((c,i)=>c>=level?i:-1).filter(i=>i>=0);
  if(!supporters.length)continue;
  const contestants=supporters.filter(i=>!folded[i]);
  if(!contestants.length)throw Error('no eligible player');
  let best=contestants[0],winners=[];
  for(const i of contestants)if(cmp(ranks[i],ranks[best])>0)best=i;
  for(const i of contestants)if(cmp(ranks[i],ranks[best])===0)winners.push(i);
  // Accumulate physical chip layers into one pot until eligibility changes.
  // Splitting every layer independently would award odd chips repeatedly.
  // Charge individual chip receipts against the global fee schedule, then
  // aggregate the net receipts until this complete pot closes.
  for(const ignored of supporters){
   cursor++;
   const next=Number(BigInt(rake)*BigInt(cursor)/BigInt(gross));
   layerSize+=1-(next-charged);charged=next;
  }
  if(!spent.includes(level))continue;
  const each=Math.floor(layerSize/winners.length);
  for(const i of winners)won[i]+=each;
  const ordered=[...winners].sort((a,b)=>(a-button-1+n)%n-(b-button-1+n)%n);
  let odd=layerSize%winners.length;
  for(const i of ordered)if(odd-->0)won[i]++;
  layerSize=0;
 }
 const payout=won.map((x,i)=>x+returns[i]);
 if(payout.reduce((a,v)=>a+v,0)+rake!==contributions.reduce((a,v)=>a+v,0))throw Error('conservation');
 return payout;
}
