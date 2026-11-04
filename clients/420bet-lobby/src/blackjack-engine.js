// 420Bet practice blackjack. No wallet, chain, cash or payments.
export const BLACKJACK_RULES=Object.freeze({
 seats:3,maxHandsPerSeat:2,blackjackPayout:1.5,dealerStandsSoft17:true,
 doubleAfterSplit:true,insurance:false,surrender:false,resplit:false,
 splitTensByValue:true,splitAcesOneCard:true
});
export const SUITS=['♠','♥','♦','♣'];
export const RANKS=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
export const makeDeck=()=>SUITS.flatMap(suit=>RANKS.map(rank=>({rank,suit})));
export const cardValue=card=>card.rank==='A'?11:['J','Q','K'].includes(card.rank)?10:Number(card.rank);
export function handTotal(cards){
 let value=cards.reduce((n,c)=>n+cardValue(c),0),aces=cards.filter(c=>c.rank==='A').length;
 while(value>21&&aces){value-=10;aces--;}
 return {value,soft:aces>0,bust:value>21};
}
export function canSplit(cards){return cards.length===2&&cardValue(cards[0])===cardValue(cards[1]);}
export function makeShoe(random=Math.random,decks=4){
 const cards=Array.from({length:decks},()=>makeDeck()).flat();
 for(let i=cards.length-1;i>0;i--){const j=Math.min(i,Math.max(0,Math.floor(random()*(i+1))));[cards[i],cards[j]]=[cards[j],cards[i]];}
 return cards;
}
export function createBlackjackGame({shoe,random=Math.random,credits=10000}={}){
 return {
  phase:'betting',credits,seats:[0,1,2].map((id)=>({id,enabled:id===1,wager:25,hands:[],outcome:''})),
  dealer:[],shoe:shoe?[...shoe]:makeShoe(random),random,
  currentSeat:null,currentHand:null,round:0,message:'Choose your seats and place your practice bets.',lastNet:0,lastReturn:0
 };
}
const draw=g=>{if(!g.shoe.length)g.shoe=makeShoe(g.random);return g.shoe.shift();};
const freshHand=(cards,bet,fromSplit=false,splitAces=false)=>({cards,bet,fromSplit,splitAces,done:false,doubled:false,result:null,return:0});
const nextPlayable=g=>{
 for(let id=0;id<3;id++){const seat=g.seats[id];for(let h=0;h<seat.hands.length;h++){
  if(!seat.hands[h].done){g.currentSeat=id;g.currentHand=h;g.phase='playing';g.message='Seat '+(id+1)+(seat.hands.length>1?' · Hand '+(h+1):'')+' to act.';return;}
 }}
 g.currentSeat=null;g.currentHand=null;settleRound(g);
};
function settleRound(g){
 g.phase='dealer';const dealerNatural=g.dealer.length===2&&handTotal(g.dealer).value===21;
 if(!dealerNatural&&g.seats.some(s=>s.hands.some(h=>!handTotal(h.cards).bust&&!(h.cards.length===2&&!h.fromSplit&&handTotal(h.cards).value===21)))){
  while(handTotal(g.dealer).value<17)g.dealer.push(draw(g));
 }
 const d=handTotal(g.dealer);let total=0,stake=0;
 for(const seat of g.seats)for(const hand of seat.hands){
  const p=handTotal(hand.cards),natural=hand.cards.length===2&&!hand.fromSplit&&p.value===21;
  stake+=hand.bet;
  if(p.bust){hand.result='BUST';hand.return=0;}
  else if(natural&&!dealerNatural){hand.result='BLACKJACK';hand.return=hand.bet*2.5;}
  else if(dealerNatural&&!natural){hand.result='LOSE';hand.return=0;}
  else if((natural&&dealerNatural)||(!d.bust&&p.value===d.value)){hand.result='PUSH';hand.return=hand.bet;}
  else if(d.bust||p.value>d.value){hand.result='WIN';hand.return=hand.bet*2;}
  else {hand.result='LOSE';hand.return=0;}
  total+=hand.return;
 }
 g.credits+=total;g.lastReturn=total;g.lastNet=total-stake;g.phase='finished';
 g.message=g.lastNet>0?'WIN +'+g.lastNet.toLocaleString('en-US')+' practice credits':g.lastNet<0?'NET LOSS '+g.lastNet.toLocaleString('en-US')+' practice credits':'PUSH · no net change';
}
export function blackjackAction(g,type,options={}){
 const seat=g.seats[options.seat??1];
 if(type==='toggle-seat'){
  if(g.phase!=='betting'&&g.phase!=='finished')return false;
  seat.enabled=!seat.enabled;if(!g.seats.some(s=>s.enabled))seat.enabled=true;
  return true;
 }
 if(type==='wager'){
  if(g.phase!=='betting'&&g.phase!=='finished')return false;
  if(!Number.isInteger(options.amount)||options.amount<1||options.amount>1000)return false;
  seat.wager=options.amount;return true;
 }
 if(type==='reset'){
  if(g.phase!=='finished')return false;
  g.phase='betting';g.dealer=[];g.currentSeat=null;g.currentHand=null;
  for(const s of g.seats){s.hands=[];s.outcome='';}
  g.message='Choose your seats and place your practice bets.';g.lastNet=0;g.lastReturn=0;return true;
 }
 if(type==='deal'){
  if(g.phase==='finished')blackjackAction(g,'reset');
  if(g.phase!=='betting')return false;
  const active=g.seats.filter(s=>s.enabled);
  if(!active.length||g.credits<active.reduce((n,s)=>n+s.wager,0))return false;
  g.credits-=active.reduce((n,s)=>n+s.wager,0);
  for(const s of g.seats)s.hands=s.enabled?[freshHand([],s.wager)]:[];
  g.dealer=[];g.round++;g.lastNet=0;g.lastReturn=0;
  // Clockwise order, two initial cards to each occupied seat and dealer.
  for(let pass=0;pass<2;pass++){
   for(const s of active)s.hands[0].cards.push(draw(g));
   g.dealer.push(draw(g));
  }
  const dealerNatural=handTotal(g.dealer).value===21;
  if(dealerNatural){for(const s of active)s.hands[0].done=true;settleRound(g);return true;}
  for(const s of active){
   const h=s.hands[0];
   if(handTotal(h.cards).value===21)h.done=true;
  }
  nextPlayable(g);return true;
 }
 if(g.phase!=='playing'||g.currentSeat===null)return false;
 const s=g.seats[g.currentSeat],h=s.hands[g.currentHand],total=handTotal(h.cards);
 if(type==='hit'){
  if(h.splitAces||h.done)return false;
  h.cards.push(draw(g));const next=handTotal(h.cards);if(next.bust||next.value===21){h.done=true;nextPlayable(g);}
  return true;
 }
 if(type==='stand'){h.done=true;nextPlayable(g);return true;}
 if(type==='double'){
  if(h.done||h.splitAces||h.cards.length!==2||g.credits<h.bet)return false;
  g.credits-=h.bet;h.bet*=2;h.doubled=true;h.cards.push(draw(g));h.done=true;nextPlayable(g);return true;
 }
 if(type==='split'){
  if(h.done||s.hands.length!==1||!canSplit(h.cards)||g.credits<h.bet)return false;
  g.credits-=h.bet;
  const aces=h.cards[0].rank==='A'&&h.cards[1].rank==='A';
  const first=freshHand([h.cards[0],draw(g)],h.bet,true,aces);
  const second=freshHand([h.cards[1],draw(g)],h.bet,true,aces);
  s.hands=[first,second];
  // Aces receive one extra card only. No re-split, hit or double.
  if(aces){first.done=true;second.done=true;}
  nextPlayable(g);return true;
 }
 return false;
}
export function blackjackAvailable(g){
 if(g.phase!=='playing')return [];
 const s=g.seats[g.currentSeat],h=s.hands[g.currentHand];
 return ['hit','stand',...(h.cards.length===2&&!h.splitAces&&g.credits>=h.bet?['double']:[]),
 ...(s.hands.length===1&&canSplit(h.cards)&&g.credits>=h.bet?['split']:[])];
}
