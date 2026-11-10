// Catastrophe Jack · slot #9 · nine independent one-symbol reels · PRACTICE ONLY.
// Demonstration reel weights and feature payouts are NOT RTP-qualified.
export const JACK_ROOT='/assets/420bet/slots/catastrophe-jack/';
export const JACK_STOP_ORDER=Object.freeze([4,5,6,1,2,3,7,8,9]);
export const JACK_STOP_DELAY_MS=500;
export const JACK_LINES=Object.freeze([[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]);
export const JACK_CROSS=Object.freeze([1,3,4,5,7]);
export const JACK_SYMBOLS=Object.freeze({
 TICKET:'symbols/symbol_lucky_lottery_ticket.png',DUMPSTER:'symbols/symbol_golden_dumpster.png',
 CASH:'symbols/symbol_almost_cash.png',DYNAMITE:'symbols/symbol_disaster_dynamite.png',
 BUD:'symbols/symbol_bud_jar.png',PIZZA:'symbols/symbol_suspicious_pizza.png',
 FISH:'symbols/symbol_dumpster_fish_dinner.png',WILD:'symbols/symbol_jack_wild.png',
 BELL:'features/symbol_disaster_bell.png',CLAIM:'features/symbol_insurance_folder.png',
 ANVIL:'features/symbol_falling_anvil.png'
});
export const JACK_PAY=Object.freeze({TICKET:8,DUMPSTER:6,CASH:4,DYNAMITE:3,BUD:2,PIZZA:1.5,FISH:1,WILD:8});
export const JACK_BELL_PAY=Object.freeze([0,.5,1.5,3,6,12,25,50,100,250]);
const BASE_POOL=['TICKET','DUMPSTER','CASH','DYNAMITE','BUD','BUD','PIZZA','PIZZA','FISH','FISH','FISH','FISH','WILD','BELL','CLAIM','ANVIL'];
const FREE_POOL=['BELL','BELL','BELL','BELL','BELL','FISH','BUD','CASH','PIZZA','DUMPSTER','TICKET'];
const labels={base:'Regular play',free:'Nine Lives Free Spins',insurance:'Insurance Claim Bonus',reversal:'Catastrophic Reversal'};
const backgrounds={base:'background-main.png',free:'background-nine-lives.png',insurance:'background-insurance-claim.png',reversal:'background-catastrophic-reversal.png'};
const random=(pool,rng)=>pool[Math.min(pool.length-1,Math.floor(rng()*pool.length))];
export function jackSpin(mode='base',rng=Math.random){return Array.from({length:9},()=>random(mode==='free'?FREE_POOL:BASE_POOL,rng));}
export function jackEvaluate(board,bet=1){
 let total=0;const lines=[];
 JACK_LINES.forEach((line,i)=>{
  const s=line.map(p=>board[p]);
  if(s.some(x=>!(x in JACK_PAY)))return;
  const first=s.find(x=>x!=='WILD')||'WILD';
  if(s.every(x=>x===first||x==='WILD')){
   const amount=(JACK_PAY[first]||0)*bet;total+=amount;lines.push({line:i+1,amount});
  }
 });
 return {total,lines};
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
 const side=el(doc,'aside','cj-side');
 const heading=el(doc,'h2','', 'CAT'S GOT NINE LIVES');
 const info=el(doc,'p','cj-rules','8 paylines · Nine independent reels. Five bells in positions 2, 4, 5, 6, 8 start Nine Lives.');
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
 center.append(reels,side);
 const footer=el(doc,'p','cj-disclaimer','Practice simulation only. Bonus odds and RTP have not been certified.');
 surface.append(top,notice,center,footer);stage.append(surface);
 function schedule(fn,ms){const id=setTimeout(()=>{pending=pending.filter(x=>x!==id);if(!ended)fn();},ms);pending.push(id);}
 function setMode(next){mode=next;stage.dataset.mode=next;stage.style.setProperty('--cj-wallpaper','url("'+JACK_ROOT+'backgrounds/'+backgrounds[next]+'")');heading.textContent=next==='base'?"CAT'S GOT NINE LIVES":next==='free'?'NINE LIVES FREE SPINS':next==='insurance'?'INSURANCE CLAIM BONUS':'CATASTROPHIC REVERSAL';spin.textContent=next==='free'?'NEXT FREE SPIN':'SPIN';spin.disabled=next==='insurance'||next==='reversal';}
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
  if(busy||ended)return;setMode('free');freeRemaining=9;freeNumber=0;freeBet=bet;freeTotal=0;totalWin=0;redraw();
  showBoard(['FISH','BELL','CASH','BELL','BELL','BELL','PIZZA','BELL','BUD']);
  help.replaceChildren();message.textContent=(test?'TEST MODE · ':'')+'Nine Lives activated: nine free spins. Every third spin has an escalating catastrophe multiplier.';
  spin.disabled=false;
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
    schedule(()=>resetBase(),2600);
   }
  });
 }
 function startInsurance(test){
  if(busy||ended)return;setMode('insurance');
  showBoard(['CLAIM','BUD','FISH','PIZZA','CLAIM','CASH','TICKET','BUD','CLAIM']);
  claimsPicked=[];claimValues=Array.from({length:9},()=>[.5,1,1.5,2,3,4,5,6,8][Math.floor(rng()*9)]);
  claimFactor=2;help.replaceChildren();
  const folders=el(doc,'div','cj-claims');
  for(let i=0;i<9;i++){
   const b=button(doc,'CLAIM '+(i+1),()=>{
    if(ended||claimsPicked.includes(i)||claimsPicked.length>=3)return;
    claimsPicked.push(i);b.textContent=claimValues[i]+'×';b.disabled=true;
    const sum=claimsPicked.reduce((v,k)=>v+claimValues[k],0);
    message.textContent='Claim '+claimsPicked.length+'/3 · '+money(sum*claimFactor*bet)+' practice credits pending';
    if(claimsPicked.length===3){
     const amount=sum*claimFactor*bet;pay(amount);message.textContent='INSURANCE APPROVED! '+money(amount)+' credits. Returning to regular play.';
     schedule(()=>resetBase(),3000);
    }
   },'cj-folder');
   folders.append(b);
  }
  help.append(folders);
  message.textContent=(test?'TEST MODE · ':'')+'Pick three insurance claims. Their total is doubled.';
 }
 function startReversal(test){
  if(busy||ended)return;setMode('reversal');help.replaceChildren();
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
  help.replaceChildren();spin.disabled=false;message.textContent='Jack survives another round. Ready to spin.';
 }
 stage.stopAnimation=()=>{ended=true;stopRolling();pending.forEach(clearTimeout);pending=[];};
 setMode('base');redraw();return stage;
}
