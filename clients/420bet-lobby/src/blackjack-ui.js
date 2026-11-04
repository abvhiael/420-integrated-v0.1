import {createBlackjackGame,blackjackAction,blackjackAvailable,handTotal} from './blackjack-engine.js';
const el=(doc,tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const number=n=>n.toLocaleString('en-US',{maximumFractionDigits:1});
const red=suit=>suit==='♥'||suit==='♦';
export function createBlackjackTable(doc=globalThis.document,options={}){
 const game=createBlackjackGame(options),root=el(doc,'section','bj-casino');
 root.dataset.practiceGame='blackjack';
 let chip=25;
 function action(label,cls,onClick,disabled=false){
  const b=el(doc,'button',cls,label);b.type='button';b.disabled=disabled;b.addEventListener('click',onClick);return b;
 }
 function playingCard(card,hidden=false){
  const n=el(doc,'div','bj-card'+(hidden?' bj-card-back':red(card.suit)?' bj-card-red':' bj-card-black'));
  if(hidden){n.setAttribute('aria-label','Dealer hole card');return n;}
  n.setAttribute('aria-label',card.rank+' of '+({'♠':'spades','♥':'hearts','♦':'diamonds','♣':'clubs'})[card.suit]);
  const face=el(doc,'div','bj-card-face');
  face.append(el(doc,'span','bj-corner bj-corner-top',card.rank+' '+card.suit));
  face.append(el(doc,'span','bj-center-symbol bj-'+(card.rank==='A'?'ace':(['J','Q','K'].includes(card.rank)?'court':'pip')),['J','Q','K'].includes(card.rank)?{J:'♞',Q:'♛',K:'♚'}[card.rank]:card.suit));
  face.append(el(doc,'span','bj-corner bj-corner-bottom',card.rank+' '+card.suit));
  n.append(face);return n;
 }
 const render=()=>{
  root.replaceChildren();
  const header=el(doc,'header','bj-top');
  const marquee=el(doc,'div','bj-marquee');
  marquee.append(el(doc,'span','bj-side-decoration','✧'),el(doc,'h1','','420Bet Blackjack'),el(doc,'span','bj-side-decoration','✧'));
  header.append(marquee,el(doc,'p','bj-tag','VEGAS CLASSIC  ·  3 PLAYER SEATS  ·  PRACTICE ONLY'));
  const ledger=el(doc,'div','bj-ledger');
  ledger.append(el(doc,'span','','PRACTICE CREDITS'),el(doc,'strong','',number(game.credits)));
  ledger.append(action('+ 1,000','bj-refill',()=>{if(!['betting','finished'].includes(game.phase))return;game.credits+=1000;render();},!['betting','finished'].includes(game.phase)));
  header.append(ledger);
  root.append(header);
  const felt=el(doc,'div','bj-felt');
  felt.append(el(doc,'div','bj-rule-text','BLACKJACK PAYS 3 TO 2  ·  DEALER STANDS ON ALL 17s'));
  const dealer=el(doc,'div','bj-dealer');
  dealer.append(el(doc,'div','bj-dealer-label','✦ DEALER ✦'));
  const dealerCards=el(doc,'div','bj-dealer-cards');
  game.dealer.forEach((card,i)=>dealerCards.append(playingCard(card,i===1&&game.phase==='playing')));
  dealer.append(dealerCards,el(doc,'div','bj-dealer-total',game.dealer.length?game.phase==='playing'?'Showing '+handTotal([game.dealer[0]]).value:'Total '+handTotal(game.dealer).value:'Waiting for deal'));
  felt.append(dealer);
  const seats=el(doc,'div','bj-seats');
  for(const s of game.seats){
   const isActive=s.id===game.currentSeat&&game.phase==='playing';
   const seat=el(doc,'article','bj-seat bj-seat-'+(s.id+1)+(s.enabled?' bj-seat-enabled':' bj-seat-disabled')+(isActive?' bj-seat-active':''));
   seat.dataset.seat=String(s.id);
   const seatHeader=el(doc,'div','bj-seat-header');
   seatHeader.append(el(doc,'strong','','SEAT '+(s.id+1)),el(doc,'span','',s.enabled?'IN PLAY':'EMPTY'));
   const canToggle=['betting','finished'].includes(game.phase);
   seatHeader.append(action(s.enabled?'Leave':'Join','bj-seat-toggle',()=>{blackjackAction(game,'toggle-seat',{seat:s.id});render();},!canToggle));
   seat.append(seatHeader);
   const hands=el(doc,'div','bj-hands');
   if(!s.hands.length)hands.append(el(doc,'div','bj-empty-cards','♠ ♥ ♦ ♣'));
   s.hands.forEach((h,i)=>{
    const current=isActive&&game.currentHand===i;
    const hand=el(doc,'div','bj-hand'+(current?' bj-hand-active':'')+(h.result?' bj-hand-resolved':''));hand.dataset.hand=String(i);
    hand.append(el(doc,'span','bj-hand-caption',s.hands.length>1?'HAND '+(i+1):'YOUR HAND'));
    const cards=el(doc,'div','bj-player-cards');h.cards.forEach(card=>cards.append(playingCard(card)));hand.append(cards);
    hand.append(el(doc,'div','bj-hand-meta',handTotal(h.cards).value+' POINTS  ·  '+number(h.bet)+' CREDITS'));
    if(h.result)hand.append(el(doc,'div','bj-hand-result bj-result-'+h.result.toLowerCase(),h.result+(h.return?'  ·  RETURN '+number(h.return):'')));
    hands.append(hand);
   });
   seat.append(hands);
   const wager=el(doc,'div','bj-wager');
   wager.append(el(doc,'span','bj-wager-label',s.enabled?'BET '+number(s.wager):'OPEN SEAT'));
   if(s.enabled&&canToggle){
    wager.append(action('−','bj-bet-adjust',()=>{blackjackAction(game,'wager',{seat:s.id,amount:Math.max(1,s.wager-chip)});render();},s.wager<=1));
    wager.append(action('+','bj-bet-adjust',()=>{blackjackAction(game,'wager',{seat:s.id,amount:Math.min(1000,s.wager+chip)});render();},s.wager>=1000));
   }
   seat.append(wager);seats.append(seat);
  }
  felt.append(seats);
  const rules=el(doc,'div','bj-felt-brand','420BET ✦ SPLIT UP TO 2 HANDS ✦ DOUBLE AFTER SPLIT');
  felt.append(rules);root.append(felt);
  const console=el(doc,'div','bj-console');
  const chipBank=el(doc,'section','bj-chips');chipBank.append(el(doc,'h2','','BET CHIPS'));
  for(const d of [5,10,25,50,100])chipBank.append(action(String(d),'bj-chip bj-chip-'+d+(chip===d?' bj-chip-selected':''),()=>{chip=d;render();}));
  console.append(chipBank);
  const controls=el(doc,'section','bj-controls');
  const current=game.currentSeat===null?null:game.seats[game.currentSeat].hands[game.currentHand];
  if(game.phase==='betting'||game.phase==='finished'){
   controls.append(action(game.phase==='finished'?'DEAL AGAIN':'DEAL CARDS','bj-button bj-button-deal',()=>{blackjackAction(game,'deal');render();},game.seats.filter(s=>s.enabled).reduce((v,s)=>v+s.wager,0)>game.credits));
  }else if(game.phase==='playing'){
   const valid=blackjackAvailable(game);
   for(const type of ['hit','stand','double','split']){
    controls.append(action(type.toUpperCase(),'bj-button bj-button-'+type,()=>{blackjackAction(game,type);render();},!valid.includes(type)));
   }
  }
  console.append(controls);
  const turn=el(doc,'div','bj-turn');
  turn.setAttribute('role','status');turn.setAttribute('aria-live','polite');
  turn.append(el(doc,'strong','',game.phase==='playing'?'SEAT '+(game.currentSeat+1)+' · HAND '+(game.currentHand+1):game.phase==='finished'?'ROUND COMPLETE':'PLACE YOUR BETS'));
  turn.append(el(doc,'span','',game.message));
  if(game.phase==='finished')turn.append(el(doc,'span','bj-round-return','TOTAL RETURN '+number(game.lastReturn)+' · NET '+(game.lastNet>=0?'+':'')+number(game.lastNet)));
  console.append(turn);root.append(console);
  root.append(el(doc,'p','bj-disclosure','PRACTICE CREDITS ONLY · NO REAL WAGERING · THREE PLAYER POSITIONS CONTROLLED LOCALLY · NO INSURANCE'));
 };
 render();
 root.stopAnimation=()=>{};
 return root;
}
