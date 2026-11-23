// BC-2.1: isolated, deterministic Russian Cribbage rules reference.
// Pure functions only. This is NOT the production server match engine and
// must not be used to trust browser-side scores or reveal another seat's cards.
const define=(id,seatCount,teams,deal,discard,extra)=>Object.freeze({
 id,seatCount,teams:Object.freeze(teams),deal,discard,extra,retain:6,crib:6
});
export const RUSSIAN_CRIBBAGE_TARGET=241;
export const RUSSIAN_CRIBBAGE_VARIANTS=Object.freeze({
 'russian-2p':define('russian-2p',2,[0,1],9,3,0),
 'russian-3p':define('russian-3p',3,[0,1,2],8,2,0),
 'russian-4p-partners':define('russian-4p-partners',4,[0,1,0,1],7,1,2),
 'russian-4p-individual':define('russian-4p-individual',4,[0,1,2,3],7,1,2)
});
const validCard=c=>Number.isInteger(c)&&c>=0&&c<52;
const rank=c=>c%13+1;
const suit=c=>Math.floor(c/13);
const pips=c=>Math.min(rank(c),10);
function validateCards(cards,length){
 if(!Array.isArray(cards)||cards.length!==length||!cards.every(validCard)||
    new Set(cards).size!==length)throw new RangeError('Invalid or repeated playing card');
}
export function russianCribbageVariant(seatCount,format='partnerships'){
 if(seatCount===2)return RUSSIAN_CRIBBAGE_VARIANTS['russian-2p'];
 if(seatCount===3)return RUSSIAN_CRIBBAGE_VARIANTS['russian-3p'];
 if(seatCount===4&&format==='partnerships')return RUSSIAN_CRIBBAGE_VARIANTS['russian-4p-partners'];
 if(seatCount===4&&format==='individual')return RUSSIAN_CRIBBAGE_VARIANTS['russian-4p-individual'];
 throw new RangeError('Unsupported Russian Cribbage player count or format');
}
export function russianCribbageShowOrder(seatCount,dealer){
 russianCribbageVariant(seatCount);
 if(!Number.isInteger(dealer)||dealer<0||dealer>=seatCount)throw new RangeError('Invalid dealer');
 return Object.freeze([...Array.from({length:seatCount},(_,i)=>Object.freeze({
  seat:(dealer+i+1)%seatCount,isCrib:false
 })),Object.freeze({seat:dealer,isCrib:true})]);
}
// Shuffling is deliberately supplied by a separate secure server process.
// The test/reference deal cannot certify randomness or authorize live play.
export function russianCribbageDeal(deck,seatCount,dealer,format='partnerships'){
 const v=russianCribbageVariant(seatCount,format);
 validateCards(deck,52);
 if(!Number.isInteger(dealer)||dealer<0||dealer>=seatCount)throw new RangeError('Invalid dealer');
 const hands=Array.from({length:seatCount},()=>[]);
 let cursor=0;
 for(let round=0;round<v.deal;round++)
  for(let step=1;step<=seatCount;step++)
   hands[(dealer+step)%seatCount].push(deck[cursor++]);
 const crib=deck.slice(cursor,cursor+v.extra);
 cursor+=v.extra;
 return Object.freeze({variantId:v.id,dealer,seatCount,
  hands:Object.freeze(hands.map(h=>Object.freeze(h))),
  crib:Object.freeze(crib),stock:Object.freeze(deck.slice(cursor))});
}
export function russianCribbageFinishDeal(dealt,discardsBySeat){
 const v=RUSSIAN_CRIBBAGE_VARIANTS[dealt?.variantId];
 if(!v||dealt?.seatCount!==v.seatCount||!Number.isInteger(dealt?.dealer)||
  dealt.dealer<0||dealt.dealer>=v.seatCount||
  !Array.isArray(dealt.hands)||dealt.hands.length!==v.seatCount||
  !Array.isArray(discardsBySeat)||discardsBySeat.length!==v.seatCount||
  !Array.isArray(dealt.crib)||dealt.crib.length!==v.extra||
  !Array.isArray(dealt.stock)||dealt.stock.length!==52-v.seatCount*v.deal-v.extra)
  throw new RangeError('Invalid deal');
 const all=[...dealt.hands.flat(),...dealt.crib,...dealt.stock];
 validateCards(all,52);
 const crib=[...dealt.crib],hands=[];
 for(let seat=0;seat<v.seatCount;seat++){
  const hand=dealt.hands[seat],discards=discardsBySeat[seat];
  validateCards(hand,v.deal);
  validateCards(discards,v.discard);
  if(discards.some(card=>!hand.includes(card)))throw new RangeError('Discard is not in the seat hand');
  hands.push(Object.freeze(hand.filter(card=>!discards.includes(card))));
  crib.push(...discards);
 }
 validateCards(crib,6);
 if(hands.some(h=>h.length!==6))throw new RangeError('Invalid retained hand');
 if(dealt.stock.length<1)throw new RangeError('Missing starter');
 return Object.freeze({variantId:v.id,dealer:dealt.dealer,
  hands:Object.freeze(hands),crib:Object.freeze(crib),
  starter:dealt.stock[0],stock:Object.freeze(dealt.stock.slice(1))});
}
function scoreRuns(all){
 // Only longest runs count, with every distinct card-subset of that length.
 for(let size=all.length;size>=3;size--){
  let total=0;
  for(let mask=1;mask<(1<<all.length);mask++){
   let count=0,lo=14,hi=0;const seen=new Set();
   for(let i=0;i<all.length;i++)if(mask&(1<<i)){
    count++;const r=rank(all[i]);seen.add(r);lo=Math.min(lo,r);hi=Math.max(hi,r);
   }
   if(count===size&&seen.size===size&&hi-lo+1===size)total+=size;
  }
  if(total)return total;
 }
 return 0;
}
export function russianCribbageScoreShow(hand,starter,{crib=false}={}){
 validateCards(hand,6);
 if(!validCard(starter)||hand.includes(starter)||typeof crib!=='boolean')
  throw new RangeError('Invalid starter or scoring context');
 const all=[...hand,starter],n=all.length;
 let fifteens=0,pairs=0,flush=0,nobs=0;
 for(let mask=1;mask<(1<<n);mask++){
  let sum=0,count=0;
  for(let i=0;i<n;i++)if(mask&(1<<i)){sum+=pips(all[i]);count++;}
  if(count>=2&&sum===15)fifteens+=2;
 }
 for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)
  if(rank(all[i])===rank(all[j]))pairs+=2;
 const runs=scoreRuns(all);
 if(hand.every(card=>suit(card)===suit(hand[0]))){
  if(suit(starter)===suit(hand[0]))flush=7;
  else if(!crib)flush=6;
 }
 nobs=hand.some(card=>rank(card)===11&&suit(card)===suit(starter))?1:0;
 return Object.freeze({fifteens,pairs,runs,flush,nobs,
  total:fifteens+pairs+runs+flush+nobs});
}
export function russianCribbagePegPoints(pile){
 if(!Array.isArray(pile)||pile.length<1||pile.length>24)
  throw new RangeError('Invalid peg sequence');
 validateCards(pile,pile.length);
 const count=pile.reduce((sum,c)=>sum+pips(c),0);
 if(count>31)throw new RangeError('Peg sequence exceeds 31');
 let points=count===15||count===31?2:0;
 let equal=1;
 for(let i=pile.length-2;i>=0;i--){
  if(rank(pile[i])!==rank(pile[pile.length-1]))break;
  equal++;
 }
 const sameRankPoints=[0,0,2,6,12];
 points+=sameRankPoints[Math.min(equal,4)];
 let run=0;
 for(let size=pile.length;size>=3;size--){
  const tail=pile.slice(-size),r=tail.map(rank);
  if(new Set(r).size===size&&Math.max(...r)-Math.min(...r)+1===size){
   run=size;points+=size;break;
  }
 }
 return Object.freeze({count,points,pairCount:equal,run,exact15:count===15,exact31:count===31});
}
export function russianCribbageClassify(score){
 if(!Number.isSafeInteger(score)||score<0||score>=241)throw new RangeError('Invalid losing score');
 return score<=120?'double-skunk':score<=180?'skunk':'ordinary';
}
export function russianCribbageAward(scores,variantId,seat,points){
 const v=RUSSIAN_CRIBBAGE_VARIANTS[variantId];
 if(!v||!Array.isArray(scores)||scores.length!==v.seatCount||
   !scores.every(s=>Number.isSafeInteger(s)&&s>=0&&s<241)||
   !Number.isInteger(seat)||seat<0||seat>=v.seatCount||
   !Number.isSafeInteger(points)||points<1)
  throw new RangeError('Invalid score award');
 for(let i=0;i<v.seatCount;i++)
  if(v.teams.some((t,j)=>j<i&&t===v.teams[i]&&scores[i]!==scores[j]))
   throw new RangeError('Inconsistent partnership scores');
 const team=v.teams[seat],next=scores.map((score,i)=>score+(v.teams[i]===team?points:0));
 const winner=next[seat]>=241?team:null,losses=[];
 if(winner!==null)for(const other of new Set(v.teams)){
  if(other===team)continue;
  const otherSeat=v.teams.indexOf(other),score=next[otherSeat];
  losses.push(Object.freeze({team:other,score,classification:russianCribbageClassify(score)}));
 }
 return Object.freeze({scores:Object.freeze(next),winningTeam:winner,
  winnerSeat:winner!==null?seat:null,losers:Object.freeze(losses)});
}
