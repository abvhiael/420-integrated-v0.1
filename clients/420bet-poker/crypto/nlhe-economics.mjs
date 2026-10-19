// Deterministic cash game economics policy. Caller must supply authenticated hand
// contributions and cryptographically proven showdown ranks from replay, never claims.
const chips=x=>{if(!Number.isSafeInteger(x)||x<0)throw Error('invalid chips');return x};
export function returnUncalled(contributions,folded) {
 const paid=contributions.map(chips);
 if(paid.length<2||paid.length>9||folded.length!==paid.length)throw Error('seat count');
 const ordered=paid.map((amount,seat)=>({amount,seat})).sort((a,b)=>b.amount-a.amount);
 const refunds=Array(paid.length).fill(0);
 if(ordered[0].amount>ordered[1].amount){
  const excess=ordered[0].amount-ordered[1].amount;
  // Unmatched excess never entered a contestable pot, whether the player
  // eventually folded or not. Callers must separately validate betting history.
  refunds[ordered[0].seat]=excess;paid[ordered[0].seat]-=excess;
 }
 return {contributions:paid,refunds};
}
export function canonicalRake({grossPot,flopSeen,bps,cap,noFlopNoDrop=true}){
 [grossPot,bps,cap].forEach(chips);
 if(bps>10000)throw Error('bps');
 if(!flopSeen&&noFlopNoDrop)return 0;
 return Math.min(cap,Math.floor(grossPot*bps/10000));
}
export function settleWithRake({contributions,folded,ranks,button,flopSeen,
 rakeBps,rakeCap,noFlopNoDrop=true}){
 const {contributions:net,refunds}=returnUncalled(contributions,folded);
 const original=contributions.reduce((a,b)=>a+chips(b),0);
 const pot=net.reduce((a,b)=>a+b,0);
 const rake=canonicalRake({grossPot:pot,flopSeen,bps:rakeBps,cap:rakeCap,noFlopNoDrop});
 // Rake is removed from contestable pots *proportionally by their tier value*,
 // with deterministic assignment of integer remainder to earliest tiers.
 const tiers=[...new Set(net.filter(x=>x>0))].sort((a,b)=>a-b);
 const pots=[];let prev=0,leftRake=rake,remainingPot=pot;
 for(let i=0;i<tiers.length;i++){
  const x=tiers[i],participants=net.map((v,j)=>v>=x?j:-1).filter(j=>j>=0);
  const gross=(x-prev)*participants.length;
  const cut=i===tiers.length-1?leftRake:Math.floor(rake*gross/pot);
  leftRake-=cut;remainingPot-=gross;
  if(cut>gross)throw Error('rake allocation');
  const eligible=participants.filter(j=>!folded[j]);
  if(!eligible.length)throw Error('no pot winner');
  let best=null,winners=[];
  for(const j of eligible){
   if(!Array.isArray(ranks[j]))throw Error('missing showdown rank');
   const rank=ranks[j];const cmp=(a,b)=>{for(let z=0;z<Math.max(a.length,b.length);z++){if((a[z]||0)!==(b[z]||0))return (a[z]||0)>(b[z]||0)?1:-1;}return 0};
   if(!best||cmp(rank,best)>0){best=rank;winners=[j]}
   else if(cmp(rank,best)===0)winners.push(j);
  }
  pots.push({gross,net:gross-cut,eligible,winners,cut});
  prev=x;
 }
 const winnings=Array(net.length).fill(0);
 for(const p of pots){
  const each=Math.floor(p.net/p.winners.length);
  for(const j of p.winners)winnings[j]+=each;
  let odd=p.net%p.winners.length;
  for(const j of [...p.winners].sort((a,b)=>(a-button-1+net.length)%net.length-(b-button-1+net.length)%net.length)){
   if(odd--<=0)break;winnings[j]++;
  }
 }
 const payouts=winnings.map((x,i)=>x+refunds[i]);
 if(payouts.reduce((a,b)=>a+b,0)+rake!==original)throw Error('nonconservation');
 return {payouts,refunds,rake,pots};
}
