import {ROULETTE_WHEEL,ROULETTE_CHIPS,STARTING_CREDITS,rouletteColor,rouletteTotal,rouletteSettle,rouletteRandomPocket,rouletteInsideKey} from './roulette-model.js';

const make=(doc,tag,cls='',value)=>{const el=doc.createElement(tag);if(cls)el.className=cls;if(value!==undefined)el.textContent=value;return el;};
const money=n=>Number(n).toLocaleString('en-US');
const columnKey=row=>'column:'+(3-row);
export function createCannabisRoulette(doc=globalThis.document,options={}){
 const root=make(doc,'section','cr-game');root.dataset.practiceGame='roulette';
 const view=doc.defaultView||globalThis;
 const setTimer=options.setTimeout??((fn,ms)=>view.setTimeout(fn,ms));
 const clearTimer=options.clearTimeout??(id=>view.clearTimeout(id));
 let balance=STARTING_CREDITS,chip=10,bets=[],lastBets=[],last=null,recent=[],spinning=false,timer=null,rotation=0,spinCount=0,destroyed=false,message='Choose a chip, then place practice bets on the table.';
 root.stopAnimation=()=>{destroyed=true;spinning=false;if(timer!==null)clearTimer(timer);timer=null;};
 const sum=()=>rouletteTotal(bets);
 const button=(text,cls,handler)=>{const el=make(doc,'button',cls,text);el.type='button';el.addEventListener('click',handler);return el;};
 const betTotals=()=>{const totals=new Map();for(const bet of bets)totals.set(bet.key,(totals.get(bet.key)||0)+bet.amount);return totals;};
 function place(key){
  if(spinning||sum()+chip>balance){message='Not enough practice credits for that chip.';render();return;}
  bets=[...bets,{key,amount:chip}];message='Practice bet placed. Press SPIN when ready.';render();
 }
 const betButton=(label,key,cls,totals)=>{
  const el=button(label,'cr-bet '+cls,()=>place(key));
  el.dataset.bet=key;el.setAttribute('aria-label',label+' practice bet');
  const amount=totals.get(key);
  if(amount){el.classList.add('cr-has-bet');el.append(make(doc,'span','cr-placed-chip',money(amount)));}
  if(last?.winningKeys.includes(key))el.classList.add('cr-winner');
  el.disabled=spinning;return el;
 };
 function spin(){
  if(destroyed||spinning)return;
  if(!bets.length){message='Place at least one practice chip before spinning.';render();return;}
  const stake=sum();
  if(stake>balance){message='Not enough practice credits for this bet.';render();return;}
  let pocket;
  try{pocket=options.pickPocket?.()??rouletteRandomPocket();}
  catch{message='Unable to draw a practice pocket.';render();return;}
  if(!ROULETTE_WHEEL.includes(String(pocket))){message='Invalid practice pocket.';render();return;}
  // Resolve the outcome once; animations only reveal it.
  const result=rouletteSettle(bets,pocket,balance);
  lastBets=bets.map(b=>({...b}));
  balance-=stake;bets=[];spinning=true;spinCount++;
  const wheelIndex=ROULETTE_WHEEL.indexOf(result.pocket);
  const desired=((360-((wheelIndex+.5)*360/38))%360+360)%360;
  const current=((rotation%360)+360)%360;
  rotation+=360*6+((desired-current+360)%360);
  message='No more bets · wheel spinning…';
  render();
  timer=setTimer(()=>{
   timer=null;if(destroyed)return;
   balance+=result.returned;last=result;recent=[result.pocket,...recent].slice(0,7);
   spinning=false;
   message=result.returned?'WINNING SPIN · Pocket '+result.pocket+' · Paid '+money(result.returned)+' credits · Net '+(result.net>=0?'+':'')+money(result.net):'Pocket '+result.pocket+' · No winning bets · Lost '+money(result.stake)+' credits';
   render();
  },4000);
 }
 function repeat(){
  if(spinning||!lastBets.length)return;
  const previous=lastBets.map(b=>({...b}));
  if(rouletteTotal(previous)>balance){message='Insufficient practice credits to repeat the previous bet.';render();return;}
  bets=previous;message='Previous practice bets restored.';render();
 }
 function render(){
  if(destroyed)return;
  root.replaceChildren();
  const totals=betTotals();
  const header=make(doc,'header','cr-header');
  header.append(make(doc,'div','cr-brand','✦ 420Bet · HIGH ROLLER CLUB ✦'),make(doc,'h1','','420Bet Roulette'),make(doc,'p','','AMERICAN DOUBLE ZERO · GREEN FELT CASINO · PRACTICE ONLY'));
  root.append(header);
  const top=make(doc,'div','cr-top');
  const credits=make(doc,'div','cr-ledger cr-credits');
  credits.append(make(doc,'span','cr-ledger-title','✦ Practice Credits'),make(doc,'strong','',money(balance)),make(doc,'span','cr-ledger-caption','No real money · no wallet'));
  const total=make(doc,'div','cr-ledger cr-current-bet');
  total.append(make(doc,'span','cr-ledger-title','❋ Current Bet'),make(doc,'strong','',money(sum())),make(doc,'span','cr-ledger-caption','Selected chip: '+money(chip)));
  const account=make(doc,'div','cr-account');account.append(credits,total);
  const wheelBox=make(doc,'div','cr-wheel-stage');
  wheelBox.setAttribute('aria-label','Centered brass-and-emerald cannabis roulette wheel');
  const wheelShadow=make(doc,'div','cr-wheel-shadow');wheelBox.append(wheelShadow);
  const wheel=make(doc,'div','cr-wheel'+(spinning?' cr-wheel-spinning':''));
  wheel.append(make(doc,'div','cr-wheel-ornament','✦ 420 ✦'));
  const rim=make(doc,'div','cr-wheel-rim');
  wheel.setAttribute('role','img');wheel.setAttribute('aria-label','Animated American roulette wheel with 38 pockets, zero and double zero');
  const disc=make(doc,'div','cr-wheel-disc');
  const sector=360/ROULETTE_WHEEL.length;
  disc.style.background='conic-gradient('+ROULETTE_WHEEL.map((n,i)=>{
   const color=rouletteColor(n)==='green'?'#158a36':rouletteColor(n)==='red'?'#e22a38':'#101319';
   return color+' '+(i*sector).toFixed(5)+'deg '+((i+1)*sector).toFixed(5)+'deg';
  }).join(',')+')';
  disc.style.transform='rotate('+rotation+'deg)';
  disc.style.setProperty('--cr-spin-to',rotation+'deg');
  ROULETTE_WHEEL.forEach((n,i)=>{
   const label=make(doc,'span','cr-wheel-number',n);
   const a=(i+.5)*sector*Math.PI/180;
   label.style.left=(50+43*Math.sin(a))+'%';
   label.style.top=(50-43*Math.cos(a))+'%';
   label.style.transform='translate(-50%,-50%) rotate('+((i+.5)*sector)+'deg)';
   disc.append(label);
  });
  const hub=make(doc,'div','cr-wheel-hub');
  hub.append(make(doc,'span','cr-hub-leaf','🌿'),make(doc,'strong','cr-hub-brand','420BET'));
  rim.append(disc,hub);wheel.append(rim);
  const pointer=make(doc,'div','cr-pointer','▼');pointer.setAttribute('aria-hidden','true');
  const ball=make(doc,'div','cr-ball-orbit'+(spinning?' cr-ball-orbiting':''));
  if(!spinning)ball.style.setProperty('--cr-ball-angle',(((rotation%360)+360)%360)+'deg');
  ball.append(make(doc,'span','cr-ball','●'));
  wheelBox.append(wheel,ball,pointer);
  const resultPanel=make(doc,'div','cr-last');
  resultPanel.append(make(doc,'span','cr-ledger-title','✦ Last Result'));
  const resultValue=make(doc,'div','cr-result-line');
  resultValue.append(make(doc,'strong','cr-result-pocket '+(last?'cr-'+last.color:''),last?last.pocket:'—'),
   make(doc,'span','',last?(last.color.toUpperCase()+' · '+(last.pocket==='0'||last.pocket==='00'?'ZERO':Number(last.pocket)%2?'ODD':'EVEN')):'Waiting for first spin'));
  resultPanel.append(resultValue,make(doc,'span','cr-ledger-title','Recent Results'));
  const recentRow=make(doc,'div','cr-recent');
  if(!recent.length)recentRow.append(make(doc,'small','','No spins yet'));
  else for(const p of recent)recentRow.append(make(doc,'span','cr-recent-pocket cr-'+rouletteColor(p),p));
  resultPanel.append(recentRow);
  const payout=make(doc,'div','cr-payout '+(!last?'cr-payout-idle':last.returned?'cr-payout-win':'cr-payout-loss'));
  payout.setAttribute('role','status');payout.setAttribute('aria-live','polite');
  payout.append(make(doc,'div','cr-payout-title',!last?'✦ SPIN PAYOUT ✦':last.returned?'✦ WINNER! ✦':'✦ SPIN RESULT ✦'));
  const payoutAmount=make(doc,'strong','cr-payout-amount',last?money(last.returned):'—');
  payout.append(payoutAmount,make(doc,'div','cr-payout-caption',last?'TOTAL RETURN · INCLUDES STAKE':'PRACTICE CREDITS'));
  const net=make(doc,'div','cr-payout-net',!last?'Net result shown after each spin':last.net>=0?'NET WIN +'+money(last.net):'NET LOSS −'+money(-last.net));
  payout.append(net);
  resultPanel.append(payout);
  top.append(account,wheelBox,resultPanel);root.append(top);
  const bottom=make(doc,'div','cr-table-area');
  const chipPanel=make(doc,'aside','cr-chips');
  chipPanel.append(make(doc,'h2','','❋ Bet Chips'),make(doc,'p','','Choose a chip'));
  const chipGrid=make(doc,'div','cr-chip-grid');
  ROULETTE_CHIPS.forEach((denom,i)=>{
   const el=button(String(denom),'cr-chip cr-chip-'+i+(chip===denom?' cr-chip-selected':''),()=>{chip=denom;render();});
   el.disabled=spinning;el.setAttribute('aria-pressed',String(chip===denom));el.setAttribute('aria-label','Select '+denom+' practice credit chip');
   chipGrid.append(el);
  });chipPanel.append(chipGrid);
  chipPanel.append(make(doc,'p','cr-chip-note','Select a chip, then click any betting position.'));
  const table=make(doc,'div','cr-table');
  table.setAttribute('aria-label','American roulette practice betting table');
  const inside=make(doc,'div','cr-inside');
  const zeros=make(doc,'div','cr-zeros');
  zeros.append(betButton('00','straight:00','cr-zero',totals),betButton('0','straight:0','cr-zero',totals));
  const zeroExtras=make(doc,'div','cr-zero-extras');
  for(const [kind,values,label] of [
   ['split',['0','00'],'0–00'],
   ['split',['0','1'],'0–1'],['split',['0','2'],'0–2'],
   ['split',['00','2'],'00–2'],['split',['00','3'],'00–3'],
   ['trio',['0','1','2'],'0–1–2'],['trio',['00','2','3'],'00–2–3'],
   ['basket',['0','00','1','2','3'],'Top 5']]){
   const spot=betButton(label,rouletteInsideKey(kind,values),'cr-zero-special',totals);
   spot.title=kind.toUpperCase()+' '+values.join(' / ');
   zeroExtras.append(spot);
  }
  inside.append(zeros);
  const numbers=make(doc,'div','cr-number-grid');
  for(let row=0;row<3;row++)for(let col=0;col<12;col++){
   const n=(col*3)+(3-row);
   numbers.append(betButton(String(n),'straight:'+n,'cr-number cr-'+rouletteColor(n),totals));
  }
  // Standard casino placements: line intersections are their own clickable betting spots.
  // Straight-up bets remain the square interiors; edges place splits and streets;
  // four-square intersections place corners, and two-street joins place six-lines.
  const stage=make(doc,'div','cr-number-stage');
  const spots=make(doc,'div','cr-inside-spots');
  const gridNumber=(row,col)=>(col*3)+(3-row);
  const addSpot=(kind,values,x,y)=>{
   const key=rouletteInsideKey(kind,values),label=kind.toUpperCase()+' '+values.join(' / ');
   const spot=betButton('·',key,'cr-intersection cr-spot-'+kind,totals);
   spot.setAttribute('aria-label',label+' practice bet');
   spot.title=label;
   spot.style.left=x+'%';spot.style.top=y+'%';
   spots.append(spot);
  };
  for(let row=0;row<3;row++)for(let col=0;col<12;col++){
   if(col<11)addSpot('split',[gridNumber(row,col),gridNumber(row,col+1)],(col+1)*100/12,(row+.5)*100/3);
   if(row<2)addSpot('split',[gridNumber(row,col),gridNumber(row+1,col)],(col+.5)*100/12,(row+1)*100/3);
   if(row<2&&col<11)addSpot('corner',[gridNumber(row,col),gridNumber(row+1,col),gridNumber(row,col+1),gridNumber(row+1,col+1)],(col+1)*100/12,(row+1)*100/3);
  }
  for(let col=0;col<12;col++){
   const start=1+col*3;
   addSpot('street',[start,start+1,start+2],(col+.5)*100/12,100);
   if(col<11)addSpot('sixline',[start,start+1,start+2,start+3,start+4,start+5],(col+1)*100/12,100);
  }
  stage.append(numbers,spots);inside.append(stage);
  const columns=make(doc,'div','cr-columns');
  for(let row=0;row<3;row++)columns.append(betButton('2 TO 1',columnKey(row),'cr-column',totals));
  inside.append(columns);table.append(inside,zeroExtras);
  const dozens=make(doc,'div','cr-dozens');
  [1,2,3].forEach(n=>dozens.append(betButton(n===1?'1st 12':n===2?'2nd 12':'3rd 12','dozen:'+n,'cr-outside',totals)));
  table.append(dozens);
  const outside=make(doc,'div','cr-outside');
  [['1 to 18','low',''],['Even','even',''],['◆','red','cr-red'],['◆','black','cr-black'],['Odd','odd',''],['19 to 36','high','']].forEach(([label,key,cls])=>
   outside.append(betButton(label,key,'cr-outside '+cls,totals)));
  table.append(outside);
  const actions=make(doc,'div','cr-actions');
  const spinButton=button(spinning?'SPINNING…':'▶ SPIN','cr-spin',spin);
  spinButton.disabled=spinning||!bets.length||sum()>balance;
  actions.append(spinButton);
  const repeatButton=button('↻ Repeat Bet','cr-action',repeat);
  repeatButton.disabled=spinning||!lastBets.length;actions.append(repeatButton);
  const clearButton=button('▤ Clear Bet','cr-action',()=>{bets=[];message='Practice bets cleared.';render();});
  clearButton.disabled=spinning||!bets.length;actions.append(clearButton);
  actions.append(make(doc,'p','cr-odds','Straight 35:1 · Split 17:1 · Street/Trio 11:1 · Corner 8:1 · Six-line 5:1 · Top five 6:1'));
  bottom.append(chipPanel,table,actions);root.append(bottom);
  const footer=make(doc,'footer','cr-footer');
  const status=make(doc,'p','cr-status',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  footer.append(status,make(doc,'p','cr-disclosure','PRACTICE CREDITS ONLY · NO REAL WAGERING · NO WALLET · RESULTS ARE SIMULATED · NOT CERTIFIED PRODUCTION ODDS'));
  root.append(footer);
 }
 render();return root;
}
