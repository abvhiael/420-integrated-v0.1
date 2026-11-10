// Catastrophe Jack · slot #9 · nine independent one-symbol reels · PRACTICE ONLY.
// Demonstration reel weights and feature payouts are NOT RTP-qualified.
export const JACK_ROOT='/assets/420bet/slots/catastrophe-jack/';
export const JACK_STOP_ORDER=Object.freeze([4,5,6,1,2,3,7,8,9]);
export const JACK_STOP_DELAY_MS=500;
export const JACK_LINES=Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]);
export const JACK_CROSS=Object.freeze([1,3,5,7]); // Positions 2, 4, 6 and 8.
export const JACK_SYMBOLS=Object.freeze({
 TICKET:'symbols/symbol_lucky_lottery_ticket.png',DUMPSTER:'symbols/symbol_golden_dumpster.png',
 CASH:'symbols/symbol_almost_cash.png',DYNAMITE:'symbols/symbol_disaster_dynamite.png',
 BUD:'symbols/symbol_bud_jar.png',PIZZA:'symbols/symbol_suspicious_pizza.png',
 FISH:'symbols/symbol_dumpster_fish_dinner.png',WILD:'symbols/symbol_jack_wild.png',
 BELL:'features/symbol_disaster_bell.png',CLAIM:'features/symbol_insurance_folder.png',
 ANVIL:'features/symbol_falling_anvil.png'
});
// Multipliers of total bet. Exactly THREE matching positions are required on a line.
// Bells pay on base-game lines without WILD substitution; the four-bell diamond is a separate trigger.
export const JACK_PAY=Object.freeze({TICKET:8,DUMPSTER:6,CASH:4,DYNAMITE:3,BUD:2,PIZZA:1.5,FISH:1,WILD:8,BELL:3});
// Nine Lives: calibrated to ~95.08% total RTP with 26% bells on the four trigger reels.
// Nine FREE spins; catastrophe multipliers on spins 3/6/9 remain ×2/×3/×5.
export const JACK_BELL_PAY=Object.freeze([0,.15,.4,.9,1.8,3.7,7.2,15,30,60]);
const BASE_POOL=['TICKET','DUMPSTER','CASH','DYNAMITE','BUD','BUD','PIZZA','PIZZA','FISH','FISH','FISH','FISH','WILD','BELL','CLAIM','ANVIL'];
// Four marked positions have exactly 26% Golden Bell probability, independently.
// Centre position 5 has one ANVIL in 160 stops (0.625%), down from 6.25%.
// Existing symbol proportions are otherwise retained as closely as integer strips allow.
const CROSS_NON_BELLS=BASE_POOL.filter(symbol=>symbol!=='BELL');
const CENTER_NON_ANVILS=BASE_POOL.filter(symbol=>symbol!=='ANVIL');
export const JACK_BASE_REELS=Object.freeze(Array.from({length:9},(_,i)=>{
 if(JACK_CROSS.includes(i))return Object.freeze([
  ...Array(26).fill('BELL'),
  ...Array.from({length:74},(_,n)=>CROSS_NON_BELLS[n%CROSS_NON_BELLS.length])
 ]);
 if(i===4)return Object.freeze([
  ...Array.from({length:159},(_,n)=>CENTER_NON_ANVILS[n%CENTER_NON_ANVILS.length]),
  'ANVIL'
 ]);
 return Object.freeze(BASE_POOL.slice());
}));
export const JACK_FREE_POOL=Object.freeze(['BELL','BELL','BELL','BELL','BELL','FISH','BUD','CASH','PIZZA','DUMPSTER','TICKET']);
const labels={base:'Regular play',free:'Nine Lives Free Spins',insurance:'Insurance Claim Bonus',reversal:'Catastrophic Reversal'};
const backgrounds={base:'background-main.png',free:'background-nine-lives.png',insurance:'background-insurance-claim.png',reversal:'background-catastrophic-reversal.png'};
const random=(pool,rng)=>pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
export function jackSpin(mode='base',rng=Math.random){return Array.from({length:9},(_,i)=>random(mode==='free'?JACK_FREE_POOL:JACK_BASE_REELS[i],rng));}
export function jackEvaluate(board,bet=1){
 let total=0;const lines=[];
 JACK_LINES.forEach((line,i)=>{
  const symbols=line.map(p=>board[p]);
  const candidates=[];
  for(const symbol of Object.keys(JACK_PAY)){
   // Golden Bells do not accept WILD substitutions.
   const count=symbols.filter(s=>s===symbol||(symbol!=='BELL'&&symbol!=='WILD'&&s==='WILD')).length;
   if(count===3){
    candidates.push({symbol,count:3,amount:Math.round(JACK_PAY[symbol]*bet*100)/100});
   }
  }
  // Exactly one winning symbol per line, even for a full-WILD combination.
  candidates.sort((a,b)=>b.amount-a.amount);
  if(candidates.length){const best=candidates[0];total+=best.amount;lines.push({line:i+1,...best});}
 });
 return {total:Math.round(total*100)/100,lines};
}
export function jackFeature(board){
 if(JACK_CROSS.every(p=>board[p]==='BELL'))return 'free';
 if(([0,4,8].every(p=>board[p]==='CLAIM'))||([2,4,6].every(p=>board[p]==='CLAIM')))return 'insurance';
 if(board[4]==='ANVIL')return 'reversal';
 return null;
}
export function jackBellAward(board,bet,spinNumber){
 const count=board.filter(x=>x==='BELL').length;
 const multiplier=spinNumber===3?2:spinNumber===6?3:spinNumber===9?5:1;
 return {count,multiplier,amount:JACK_BELL_PAY[count]*multiplier*bet};
}
function el(doc,tag,cls,txt){const x=doc.createElement(tag);if(cls)x.className=cls;if(txt!==undefined)x.textContent=txt;return x;}
function button(doc,text,fn,cls=''){const x=el(doc,'button',cls,text);x.type='button';x.addEventListener('click',fn);return x;}
function img(doc,path,alt,cls=''){const x=el(doc,'img',cls);x.src=JACK_ROOT+path;x.alt=alt;x.decoding='async';return x;}
const money=n=>Number(n).toFixed(2);
export function createCatastropheJack(doc=globalThis.document,{rng=Math.random}={}){
 const stage=el(doc,'section','cj-stage');
 stage.dataset.mode='base';
 stage.setAttribute('aria-label','Catastrophe Jack practice slot number nine');
 const surface=el(doc,'div','cj-surface');
 const top=el(doc,'div','cj-title');
 top.append(img(doc,'branding/catastrophe_jack_logo.png','Catastrophe Jack: Nine Lives, No Refunds!','cj-logo'));
 const notice=el(doc,'div','cj-notice','PRACTICE BETA · No wagering · Demo reel distributions');
 const center=el(doc,'div','cj-layout');
 const reels=el(doc,'div','cj-reels');
 const frameImages=[],frameNodes=[];
 const board=jackSpin('base',rng);
 for(let n=0;n<9;n++){
  const cell=el(doc,'div','cj-cell');cell.dataset.position=String(n+1);
  const picture=img(doc,JACK_SYMBOLS[board[n]],board[n],'cj-symbol');
  cell.append(picture);reels.append(cell);frameNodes.push(cell);frameImages.push(picture);
 }
 const playfield=el(doc,'div','cj-playfield');
 playfield.append(reels);
 const insurancePlay=el(doc,'div','cj-insurance-play');
 insurancePlay.hidden=true;
 insurancePlay.setAttribute('aria-label','Insurance Claim pick three folders');
 const insuranceHeader=el(doc,'div','cj-insurance-head','PICK 3 CLAIM FILES!');
 const insuranceCount=el(doc,'div','cj-insurance-count','0 / 3 PICKED');
 const insuranceGrid=el(doc,'div','cj-insurance-grid');
 insurancePlay.append(insuranceHeader,insuranceGrid,insuranceCount);
 playfield.append(insurancePlay);
 const splash=el(doc,'div','cj-splash');
 splash.hidden=true;
 splash.setAttribute('role','dialog');
 splash.setAttribute('aria-modal','true');
 splash.setAttribute('aria-label','Bonus splash screen');
 const splashButton=button(doc,'',()=>{},'cj-splash-button');
 const splashArt=el(doc,'img','cj-splash-art');
 splashArt.alt='';
 const splashTotal=el(doc,'strong','cj-splash-total');
 const splashHint=el(doc,'span','cj-splash-hint','CLICK TO CONTINUE');
 splashButton.append(splashArt,splashTotal,splashHint);
 splash.append(splashButton);
 const side=el(doc,'aside','cj-side');
 const heading=el(doc,'h2','', "CAT\'S GOT NINE LIVES");
 const info=el(doc,'p','cj-rules','8 paylines · 3 matching symbols pay on any line (including Golden Bells). Four bells in positions 2, 4, 6, 8 start Nine Lives.');
 const counters=el(doc,'div','cj-counters');
 const balanceText=el(doc,'strong','', '1000.00');
 const betText=el(doc,'strong','', '1.00');
 const winText=el(doc,'strong','', '0.00');
 const message=el(doc,'p','cj-message','Pick your fate, then SPIN.');
 let balance=1000,bet=1,totalWin=0,mode='base',freeRemaining=0,freeNumber=0,freeBet=1,freeTotal=0;
 let busy=false,ended=false,pending=[],ticker=null,claimValues=[],claimsPicked=[],claimFactor=2;
 const slot=(label,value)=>{const row=el(doc,'div','cj-stat');row.append(el(doc,'span','',label),value);counters.append(row);};
 slot('CREDITS',balanceText);slot('BET',betText);slot('LAST WIN',winText);
 const help=el(doc,'div','cj-help','');
 const controls=el(doc,'div','cj-controls');
 const down=button(doc,'−',()=>{if(!busy&&mode==='base'){bet=Math.max(1,bet-1);betText.textContent=money(bet);}},'cj-bet');
 const up=button(doc,'+',()=>{if(!busy&&mode==='base'){bet=Math.min(10,bet+1);betText.textContent=money(bet);}},'cj-bet');
 const spin=button(doc,'SPIN',()=>{if(mode==='free')runFree();else runBase();},'cj-spin');
 controls.append(down,up,spin);
 const testing=el(doc,'div','cj-testing');
 const tTitle=el(doc,'strong','', 'TEST BONUS GAMES');
 const testFree=button(doc,'Test Nine Lives',()=>startFree(true),'cj-test');
 const testClaim=button(doc,'Test Insurance Claim',()=>startInsurance(true),'cj-test');
 const testReverse=button(doc,'Test Catastrophic Reversal',()=>startReversal(true),'cj-test');
 const back=button(doc,'Return to base game',()=>resetBase(),'cj-reset');
 testing.append(tTitle,testFree,testClaim,testReverse,back);
 side.append(heading,info,counters,message,help,controls,testing);
 // Fixed help panel uses the same constants as the game engine, so payouts
 // and the displayed eight line paths remain synchronized.
 const reference=el(doc,'aside','cj-reference cj-poster');
 reference.setAttribute('aria-label','Paytable and eight paylines');
 reference.append(el(doc,'h2','cj-reference-title cj-poster-title','PAYTABLE & PAYLINES'));
 const payTable=el(doc,'div','cj-paytable');
 const payTitle=el(doc,'h3','','3 MATCHING · TOTAL BET ×');
 payTable.append(payTitle);
 const payNames={TICKET:'Lucky Lottery Ticket',DUMPSTER:'Golden Dumpster',CASH:'Almost Cash',DYNAMITE:'Disaster Dynamite',BUD:'Bud Jar',PIZZA:'Suspicious Pizza',FISH:'Dumpster Fish',WILD:'Jack Wild',BELL:'Golden Disaster Bell'};
 for(const [symbol,award] of Object.entries(JACK_PAY)){
  const row=el(doc,'div','cj-pay-row');
  row.append(img(doc,JACK_SYMBOLS[symbol],payNames[symbol],'cj-pay-symbol'));
  row.append(el(doc,'span','cj-pay-name',payNames[symbol]));
  row.append(el(doc,'strong','cj-pay-value',award+'×'));
  payTable.append(row);
 }
 const wildNote=el(doc,'p','cj-pay-note','Three matching symbols required on any of 8 lines. No two-symbol payouts. One prize per line. Jack WILD substitutes for regular symbols, never Bells. Bells also trigger Nine Lives in the five-position cross.');
 payTable.append(wildNote);
 const lineSection=el(doc,'div','cj-line-section');
 lineSection.append(el(doc,'h3','','8 FIXED PAYLINES'));
 const lineGrid=el(doc,'div','cj-line-list');
 JACK_LINES.forEach((line,i)=>{
  const item=el(doc,'div','cj-line-item');
  item.setAttribute('aria-label','Payline '+(i+1)+' positions '+line.map(p=>p+1).join(', '));
  item.append(el(doc,'span','cj-line-number',String(i+1)));
  const mini=el(doc,'div','cj-line-mini');
  for(let p=0;p<9;p++){
   const cell=el(doc,'span',line.includes(p)?'cj-line-on':'cj-line-off');
   mini.append(cell);
  }
  item.append(mini);lineGrid.append(item);
 });
 lineSection.append(lineGrid);
 const featuresNote=el(doc,'p','cj-pay-note','NINE LIVES: bells in 2, 4, 6, 8. INSURANCE: three claim folders on either diagonal.');
 reference.append(payTable,lineSection,featuresNote);
 // Comic-style illustrated bonus poster. Triggers share engine constants.
 const bonusGuide=el(doc,'aside','cj-bonus-guide cj-poster');
 bonusGuide.setAttribute('aria-label','How to trigger the three bonus features');
 bonusGuide.append(el(doc,'h2','cj-poster-title','HOW TO GET UNLUCKY!'));
 bonusGuide.append(el(doc,'p','cj-poster-intro','THREE WAYS FOR JACK TO STRIKE IT RICH... OR GET FLATTENED.'));
 const bonusList=el(doc,'div','cj-bonus-list');
 const miniPattern=(positions,symbol,caption)=>{
  const wrap=el(doc,'div','cj-trigger-wrap');
  const grid=el(doc,'div','cj-trigger-grid');
  grid.setAttribute('role','img');
  grid.setAttribute('aria-label',caption);
  for(let p=0;p<9;p++){
   const active=positions.includes(p);
   const tile=el(doc,'span','cj-trigger-cell'+(active?' cj-trigger-active':''));
   if(active)tile.append(img(doc,JACK_SYMBOLS[symbol],'','cj-trigger-symbol'));
   else tile.textContent=String(p+1);
   grid.append(tile);
  }
  wrap.append(grid);return wrap;
 };
 const bonusCard=(number,title,artPath,trigger,award,note,positions,symbol,caption)=>{
  const card=el(doc,'section','cj-bonus-card');
  card.append(el(doc,'span','cj-bonus-number','CASE #'+number));
  card.append(el(doc,'h3','cj-bonus-name',title));
  const body=el(doc,'div','cj-bonus-body');
  body.append(miniPattern(positions,symbol,caption));
  const details=el(doc,'div','cj-bonus-details');
  details.append(el(doc,'strong','cj-trigger-label','TRIGGER!'));
  details.append(el(doc,'p','cj-bonus-trigger',trigger));
  details.append(el(doc,'strong','cj-bonus-award',award));
  details.append(el(doc,'p','cj-bonus-small',note));
  body.append(details);card.append(body);
  const burst=el(doc,'div','cj-bonus-art');
  burst.append(img(doc,artPath,'','cj-bonus-art-img'));
  card.append(burst);return card;
 };
 bonusList.append(
  bonusCard(1,'NINE LIVES!','characters/jack_nine_lives_shocked.png',
   '4 DISASTER BELLS on the diamond: 2 · 4 · 6 · 8','9 FREE SPINS!',
   'Catastrophe multipliers: spin 3 ×2 · spin 6 ×3 · spin 9 ×5.',
   JACK_CROSS,'BELL','Bells in positions 2, 4, 6 and 8'),
  bonusCard(2,'INSURANCE CLAIM!','characters/jack_insurance_claim.png',
   '3 CLAIM FOLDERS on either diagonal: 1-5-9 or 3-5-7','PICK 3 FOLDERS!',
   'The current practice game doubles the sum of the revealed prizes.',
   [0,4,8],'CLAIM','Claim folders in positions 1, 5 and 9; positions 3, 5 and 7 also trigger'),
  bonusCard(3,'CATASTROPHIC REVERSAL!','features/symbol_falling_anvil.png',
   'FALLING ANVIL in the centre: position 5','WILDS FROM DISASTER!',
   'Jack gets flattened and the transformed symbols are re-evaluated for line wins.',
   [4],'ANVIL','Falling anvil in centre position 5')
 );
 bonusGuide.append(bonusList,el(doc,'p','cj-poster-footnote','PRACTICE ONLY! FEATURE CHANCES NOT YET RTP-QUALIFIED.'));
 center.append(playfield,side,reference,bonusGuide);
 const footer=el(doc,'p','cj-disclaimer','Practice simulation only. Bonus odds and RTP have not been certified.');
 surface.append(top,notice,center,footer);stage.append(surface,splash);
 let splashAction=null;
 splashButton.addEventListener('click',()=>{if(splash.hidden)return;const next=splashAction;splashAction=null;splash.hidden=true;splashTotal.textContent='';if(next)next();});
 function showSplash(name,amount,onContinue){
  splashAction=onContinue;splash.dataset.splash=name;
  splashArt.src=JACK_ROOT+'splashes/catastrophe-jack-'+name+'.png';
  splashTotal.textContent=amount===null?'':money(amount)+' CREDITS';
  splashTotal.hidden=amount===null;
  splash.setAttribute('aria-label',name.includes('complete')?'Bonus complete':'Bonus starting');
  splash.hidden=false;
  splashButton.focus?.();
 }
 function hideInsuranceBoard(){insurancePlay.hidden=true;insuranceGrid.replaceChildren();}
 function showInsuranceBoard(){insurancePlay.hidden=false;}

 function schedule(fn,ms){const id=setTimeout(()=>{pending=pending.filter(x=>x!==id);if(!ended)fn();},ms);pending.push(id);}
 function setMode(next){mode=next;stage.dataset.mode=next;stage.style.setProperty('--cj-wallpaper','url("'+JACK_ROOT+'backgrounds/'+backgrounds[next]+'")');stage.closest('.immersive')?.style.setProperty('--cj-wallpaper','url("'+JACK_ROOT+'backgrounds/'+backgrounds[next]+'")');heading.textContent=next==='base'?"CAT'S GOT NINE LIVES":next==='free'?'NINE LIVES FREE SPINS':next==='insurance'?'INSURANCE CLAIM BONUS':'CATASTROPHIC REVERSAL';spin.textContent=next==='free'?'NEXT FREE SPIN':'SPIN';spin.disabled=next==='insurance'||next==='reversal';}
 function showBoard(next){
  next.forEach((symbol,i)=>{board[i]=symbol;frameImages[i].src=JACK_ROOT+JACK_SYMBOLS[symbol];frameImages[i].alt=symbol;frameNodes[i].classList.remove('cj-moving');});
 }
 function redraw(){balanceText.textContent=money(balance);betText.textContent=money(bet);winText.textContent=money(totalWin);}
 function stopRolling(){
  if(ticker!==null){clearInterval(ticker);ticker=null;}
  frameNodes.forEach(x=>x.classList.remove('cj-moving'));
 }
 function animateBoard(next,finish){
  busy=true;spin.disabled=true;help.replaceChildren();const stopped=new Set();
  frameNodes.forEach(x=>x.classList.add('cj-moving'));
  ticker=setInterval(()=>{
   frameImages.forEach((x,i)=>{if(!stopped.has(i)){const symbol=random(Object.keys(JACK_SYMBOLS),rng);x.src=JACK_ROOT+JACK_SYMBOLS[symbol];x.alt='Spinning reel '+(i+1);}});
  },95);
  JACK_STOP_ORDER.forEach((pos,sequence)=>{
   schedule(()=>{
    const i=pos-1;stopped.add(i);board[i]=next[i];
    frameImages[i].src=JACK_ROOT+JACK_SYMBOLS[next[i]];
    frameImages[i].alt=next[i];frameNodes[i].classList.remove('cj-moving');
    if(sequence===8){stopRolling();busy=false;finish();if(mode==='base'||mode==='free')spin.disabled=false;}
   },850+sequence*JACK_STOP_DELAY_MS);
  });
 }
 function pay(amount){const value=Math.max(0,Math.round(amount*100)/100);totalWin=value;balance+=value;redraw();}
 function runBase(){
  if(busy||mode!=='base')return;
  if(balance<bet){message.textContent='Not enough practice credits. Reload this page to reset.';return;}
  balance-=bet;totalWin=0;redraw();message.textContent='Nine reels spinning · 4 → 5 → 6 → 1 → 2 → 3 → 7 → 8 → 9';
  animateBoard(jackSpin('base',rng),()=>{
   const wins=jackEvaluate(board,bet);pay(wins.total);
   const feature=jackFeature(board);
   message.textContent=wins.total?('Won '+money(wins.total)+' practice credits across '+wins.lines.length+' lines.'):'No line win. Jack has another plan.';
   if(feature==='free')startFree(false);
   else if(feature==='insurance')startInsurance(false);
   else if(feature==='reversal')startReversal(false);
  });
 }
 function startFree(test){
  if(busy||ended)return;
  hideInsuranceBoard();
  setMode('free');freeRemaining=9;freeNumber=0;freeBet=bet;freeTotal=0;totalWin=0;redraw();
  showBoard(['FISH','BELL','CASH','BELL','FISH','BELL','PIZZA','BELL','BUD']);
  help.replaceChildren();message.textContent=(test?'TEST MODE · ':'')+'Nine Lives activated: nine free spins. Every third spin has an escalating catastrophe multiplier.';
  spin.disabled=true;
  showSplash('nine-lives-start',null,()=>{spin.disabled=false;});
 }
 function runFree(){
  if(busy||mode!=='free'||freeRemaining<=0)return;
  freeNumber++;freeRemaining--;const n=freeNumber;
  message.textContent='Free spin '+n+' of 9 · positions stop in the specified order.';
  animateBoard(jackSpin('free',rng),()=>{
   const award=jackBellAward(board,freeBet,n);freeTotal+=award.amount;
   pay(award.amount);message.textContent='Free spin '+n+'/9 · '+award.count+' bells · ×'+award.multiplier+' · +'+money(award.amount)+' credits · bonus total '+money(freeTotal);
   if(!freeRemaining){
    spin.disabled=true;message.textContent+=' · NINE LIVES COMPLETE!';
    showSplash('nine-lives-complete',freeTotal,()=>resetBase());
   }
  });
 }
 function startInsurance(test){
  if(busy||ended)return;
  setMode('insurance');spin.disabled=true;
  showBoard(['CLAIM','BUD','FISH','PIZZA','CLAIM','CASH','TICKET','BUD','CLAIM']);
  claimsPicked=[];
  claimValues=Array.from({length:9},()=>[.5,1,1.5,2,3,4,5,6,8][Math.floor(rng()*9)]);
  claimFactor=2;
  help.replaceChildren();insuranceGrid.replaceChildren();insuranceCount.textContent='0 / 3 PICKED';
  const assets=[
   'claim-a-7713-jack.png','claim-b-4049-property-damage.png','claim-c-9907-wrecked-car.png',
   'claim-d-1186-dumpster-disaster.png','claim-e-6093-falling-anvil.png','claim-f-7730-dynamite.png',
   'claim-g-2218-almost-cash.png','claim-h-5584-safe.png','claim-i-8842-money-bag.png'
  ];
  for(let i=0;i<9;i++){
   const b=button(doc,'',()=>{
    if(ended||mode!=='insurance'||!splash.hidden||claimsPicked.includes(i)||claimsPicked.length>=3)return;
    claimsPicked.push(i);b.disabled=true;b.classList.add('cj-folder-picked');
    b.append(el(doc,'strong','cj-folder-reveal',claimValues[i]+'×'));
    const sum=claimsPicked.reduce((v,k)=>v+claimValues[k],0);
    insuranceCount.textContent=claimsPicked.length+' / 3 PICKED';
    message.textContent='Claim '+claimsPicked.length+'/3 · '+money(sum*claimFactor*bet)+' practice credits pending';
    if(claimsPicked.length===3){
     const amount=sum*claimFactor*bet;pay(amount);
     message.textContent='INSURANCE APPROVED! '+money(amount)+' credits.';
     hideInsuranceBoard();
     showSplash('insurance-claim-complete',amount,()=>resetBase());
    }
   },'cj-folder');
   b.setAttribute('aria-label','Open insurance claim '+(i+1));
   b.append(img(doc,'features/insurance-claim/folders/'+assets[i],'Insurance claim '+(i+1),'cj-folder-image'));
   insuranceGrid.append(b);
  }
  message.textContent=(test?'TEST MODE · ':'')+'Pick three insurance claims on the gameboard. Their total is doubled.';
  showSplash('insurance-claim-start',null,()=>showInsuranceBoard());
 }
 function startReversal(test){
  if(busy||ended)return;hideInsuranceBoard();setMode('reversal');help.replaceChildren();
  const before=['FISH','PIZZA','BUD','CASH','ANVIL','FISH','DYNAMITE','PIZZA','BUD'];
  showBoard(before);message.textContent=(test?'TEST MODE · ':'')+'OF COURSE IT DID! An anvil falls on Jack...';
  schedule(()=>{
   const after=before.slice();after[0]='WILD';after[4]='WILD';after[8]='WILD';
   showBoard(after);const won=jackEvaluate(after,bet).total;pay(won);
   message.textContent='CATASTROPHIC REVERSAL! Three positions became WILD. '+money(won)+' practice credits awarded.';
   schedule(()=>resetBase(),3200);
  },1300);
 }
 function resetBase(){
  if(ended)return;stopRolling();pending.forEach(clearTimeout);pending=[];busy=false;setMode('base');
  hideInsuranceBoard();splash.hidden=true;splashAction=null;
  help.replaceChildren();spin.disabled=false;message.textContent='Jack survives another round. Ready to spin.';
 }
 stage.stopAnimation=()=>{ended=true;stopRolling();pending.forEach(clearTimeout);pending=[];splash.hidden=true;splashAction=null;};
 setMode('base');redraw();return stage;
}
