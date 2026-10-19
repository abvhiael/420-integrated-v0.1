// Independently authored slow reference evaluator: rank by histogram, suit count,
// 5-high straights and sorted multiplicities. Does not call nlhe-replay.mjs.
function five(cards){
  if(!Array.isArray(cards)||cards.length!==5||cards.some(x=>!Number.isInteger(x)||x<0||x>=52)||new Set(cards).size!==5)throw Error('cards');
  const counts=new Array(15).fill(0);
  const suitCounts=[0,0,0,0];
  for(const c of cards){counts[c%13+2]++;suitCounts[Math.floor(c/13)]++;}
  const ranks=[];
  for(let r=14;r>=2;r--)for(let i=0;i<counts[r];i++)ranks.push(r);
  const flush=suitCounts.includes(5);
  let high=0;
  for(let h=14;h>=5;h--){
    let found=true;
    for(let step=0;step<5;step++){
      const wanted=h-step===1?14:h-step;
      if(!counts[wanted])found=false;
    }
    if(found){high=h;break;}
  }
  const groups=[];
  for(let r=2;r<=14;r++)if(counts[r])groups.push([counts[r],r]);
  groups.sort((a,b)=>b[0]-a[0]||b[1]-a[1]);
  if(flush&&high)return [8,high];
  if(groups[0][0]===4)return [7,groups[0][1],groups[1][1]];
  if(groups[0][0]===3&&groups[1][0]===2)return [6,groups[0][1],groups[1][1]];
  if(flush)return [5,...ranks];
  if(high)return [4,high];
  if(groups[0][0]===3)return [3,groups[0][1],...groups.slice(1).map(x=>x[1])];
  if(groups[0][0]===2&&groups[1][0]===2)return [2,Math.max(groups[0][1],groups[1][1]),Math.min(groups[0][1],groups[1][1]),groups[2][1]];
  if(groups[0][0]===2)return [1,groups[0][1],...groups.slice(1).map(x=>x[1])];
  return [0,...ranks];
}
export function independentFive(cards){return five(cards);}
export function independentSeven(cards){
  if(cards.length!==7||new Set(cards).size!==7)throw Error('cards');
  let best=null;
  const better=(a,b)=>{for(let i=0;i<a.length;i++){if(a[i]!==b[i])return a[i]>b[i]}return false};
  for(let omit1=0;omit1<7;omit1++)for(let omit2=omit1+1;omit2<7;omit2++){
    const selected=cards.filter((_,i)=>i!==omit1&&i!==omit2),rank=five(selected);
    if(!best||better(rank,best))best=rank;
  }
  return best;
}
