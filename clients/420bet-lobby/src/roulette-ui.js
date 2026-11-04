import {ROULETTE_WHEEL,ROULETTE_CHIPS,STARTING_CREDITS,rouletteColor,rouletteTotal,rouletteSettle,rouletteRandomPocket} from './roulette-model.js';

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
   message='Pocket '+result.pocket+' · '+result.color.toUpperCase()+' · '+(result.returned?'Returned '+money(result.returned)+' practice credits':'No winning practice bets');
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
  header.append(make(doc,'div','cr-brand','✦ 420Bet ✦'),make(doc,'h1','','420Bet Roulette'),make(doc,'p','','AMERICAN ROULETTE · CANNABIS CASINO · PRACTICE ONLY'));
  root.append(header);
  const top=make(doc,'div','cr-top');
  const credits=make(doc,'div','cr-ledger cr-credits');
  credits.append(make(doc,'span','cr-ledger-title','✦ Practice Credits'),make(doc,'strong','',money(balance)),make(doc,'span','cr-ledger-caption','No real money · no wallet'));
  const total=make(doc,'div','cr-ledger cr-current-bet');
  total.append(make(doc,'span','cr-ledger-title','❋ Current Bet'),make(doc,'strong','',money(sum())),make(doc,'span','cr-ledger-caption','Selected chip: '+money(chip)));
  const account=make(doc,'div','cr-account');account.append(credits,total);
  const wheelBox=make(doc,'div','cr-wheel-stage');
  const wheel=make(doc,'div','cr-wheel'+(spinning?' cr-wheel-spinning':''));
  wheel.setAttribute('role','img');wheel.setAttribute('aria-label','Animated American roulette wheel with 38 pockets, zero and double zero');
  const disc=make(doc,'div','cr-wheel-disc');
  const sector=360/ROULETTE_WHEEL.length;
  disc.style.background='conic-gradient('+ROULETTE_WHEEL.map((n,i)=>{
   const color=rouletteColor(n)==='green'?'#158a36':rouletteColor(n)==='red'?'#e22a38':'#101319';
   return color+' '+(i*sector).toFixed(5)+'deg '+((i+1)*sector).toFixed(5)+'deg';
  }).join(',')+')';
  disc.style.transform='rotate('+rotation+'deg)';
  ROULETTE_WHEEL.forEach((n,i)=>{
   const label=make(doc,'span','cr-wheel-number',n);
   label.style.setProperty('--a',(i+.5)*sector+'deg');
   disc.append(label);
  });
  const hub=make(doc,'div','cr-wheel-hub','✦');hub.append(make(doc,'span','','❋'));
  wheel.append(disc,hub);
  const pointer=make(doc,'div','cr-pointer','▼');pointer.setAttribute('aria-hidden','true');
  const ball=make(doc,'div','cr-ball-orbit'+(spinning?' cr-ball-orbiting':''));
  if(!spinning)ball.style.transform='rotate('+(((rotation%360)+360)%360)+'deg)';
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
  inside.append(zeros);
  const numbers=make(doc,'div','cr-number-grid');
  for(let row=0;row<3;row++)for(let col=0;col<12;col++){
   const n=(col*3)+(3-row);
   numbers.append(betButton(String(n),'straight:'+n,'cr-number cr-'+rouletteColor(n),totals));
  }
  inside.append(numbers);
  const columns=make(doc,'div','cr-columns');
  for(let row=0;row<3;row++)columns.append(betButton('2 TO 1',columnKey(row),'cr-column',totals));
  inside.append(columns);table.append(inside);
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
  actions.append(make(doc,'p','cr-odds','Straight 35:1 · Dozens/columns 2:1 · Even-money 1:1'));
  bottom.append(chipPanel,table,actions);root.append(bottom);
  const footer=make(doc,'footer','cr-footer');
  const status=make(doc,'p','cr-status',message);status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  footer.append(status,make(doc,'p','cr-disclosure','PRACTICE CREDITS ONLY · NO REAL WAGERING · NO WALLET · RESULTS ARE SIMULATED · NOT CERTIFIED PRODUCTION ODDS'));
  root.append(footer);
 }
 render();return root;
}
