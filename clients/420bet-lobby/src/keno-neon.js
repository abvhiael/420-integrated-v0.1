import {initial,next,uniqueNumbers} from './practice-engine.js';
import {KENO_CANDIDATE_STATUS} from './keno-candidate-paytable.js';
import {nineLivesRound,nineLivesCandidateMultiplier} from './keno-nine-lives.js';

// Browser-only Catastrophe Jack Keno presentation and virtual-credit simulation.
// This does not change canonical game outcomes, on-chain settlement or approved wagering rules.
export function createNeonKeno(doc=globalThis.document,options={}){
 const root=doc.createElement('section');
 root.className='practice neon-keno-page ls-keno';
 root.dataset.practiceGame='keno';
 const ASSET='/assets/420bet/keno/catastrophe-jack/';
 const METER_KEY='420bet:catastrophe-jack:keno:nine-lives:zero-one-hit:v3';
 const PRACTICE_KEY='420bet:catastrophe-jack:keno:practice:v1';
 let state=initial('keno'),pickTarget=10,history=[],lastRound=null,autoTimer=null,autoRemaining=0;
 let meter=0,credits=100000,bet=100,lastWin=0,infoOpen=false;
 const element=(tag,cls,txt)=>{
  const node=doc.createElement(tag);
  if(cls)node.className=cls;
  if(txt!==undefined)node.textContent=txt;
  return node;
 };
 const image=(file,cls,alt)=>{
  const node=element('img',cls);node.src=ASSET+file;node.alt=alt;return node;
 };
 const button=(label,handler,cls)=>{
  const node=element('button',cls,label);node.type='button';
  node.addEventListener('click',handler);return node;
 };
 const readProgress=()=>{
  try{
   const data=JSON.parse(doc.defaultView?.localStorage?.getItem(METER_KEY)||'null');
   return data?.picks===pickTarget&&Number.isInteger(data.progress)&&data.progress>=0&&data.progress<=9?data.progress:0;
  }catch{return 0;}
 };
 const saveProgress=()=>{
  try{doc.defaultView?.localStorage?.setItem(METER_KEY,JSON.stringify({picks:pickTarget,progress:meter}));}catch{/* Browser storage can be unavailable. */}
 };
 const readPractice=()=>{
  try{
   const data=JSON.parse(doc.defaultView?.localStorage?.getItem(PRACTICE_KEY)||'null');
   if(Number.isSafeInteger(data?.credits)&&data.credits>=0)credits=data.credits;
   if([10,25,50,100,250,500,1000].includes(data?.bet))bet=data.bet;
  }catch{/* Use default virtual credits. */}
 };
 const savePractice=()=>{
  try{doc.defaultView?.localStorage?.setItem(PRACTICE_KEY,JSON.stringify({credits,bet}));}catch{/* In-memory virtual credits remain usable. */}
 };
 meter=readProgress();readPractice();
 const stopAuto=()=>{if(autoTimer!==null){clearInterval(autoTimer);autoTimer=null;}autoRemaining=0;};
 const clearResult=()=>{state={...state,result:[]};lastRound=null;lastWin=0;};
 const changePickCount=count=>{
  if(!Number.isInteger(count)||count<1||count>10)return;
  stopAuto();pickTarget=count;meter=0;saveProgress();
  for(const n of [...state.picks])state=next(state,{type:'pick',value:n});
  clearResult();state.message='Select '+count+' lucky numbers to begin.';render();
 };
 const luckyClaws=()=>{
  stopAuto();
  for(const n of [...state.picks])state=next(state,{type:'pick',value:n});
  for(const n of uniqueNumbers(pickTarget,80))state=next(state,{type:'pick',value:n});
  clearResult();state.message='Jack scratched out '+pickTarget+' lucky numbers.';render();
 };
 const clearPicks=()=>{
  stopAuto();
  for(const n of [...state.picks])state=next(state,{type:'pick',value:n});
  clearResult();state.message='Pick your numbers, or let Jack choose.';render();
 };
 const play=()=>{
  if(state.picks.length!==pickTarget||credits<bet){render();return false;}
  const snapshot=[...state.picks];
  state=next(state,{type:'play'},options.random);
  const hits=state.result.filter(n=>snapshot.includes(n)).length;
  lastRound=nineLivesRound(meter,pickTarget,hits);
  meter=lastRound.progress;saveProgress();
  credits-=bet;
  lastWin=Math.round(bet*lastRound.effectiveMultiplier);
  credits+=lastWin;savePractice();
  history.unshift({round:state.round,hits,picks:pickTarget,bonus:lastRound.bonusApplied,win:lastWin});
  history=history.slice(0,8);
  state.message=lastRound.bonusApplied?'CAT-ASTROPHE! Jack doubles the winning draw!':
   lastRound.bonusReady?'NINE LIVES CHARGED! The next paying draw earns 2× and resets the meter.':
   lastRound.baseMultiplier>0?'Jack: “A winner! Back to zero lives.”':hits<=1?'Jack: “Another bust. One life closer to revenge.”':'Jack: “Two or more hits. No payout, no extra life.”';
  render();return true;
 };
 const toggleAuto=()=>{
  if(autoTimer!==null){stopAuto();render();return;}
  if(state.picks.length!==pickTarget||credits<bet)return;
  autoRemaining=10;
  // A bounded practice sequence: the same play() path handles every independent draw.
  autoTimer=setInterval(()=>{
   if(autoRemaining<=0||state.picks.length!==pickTarget||credits<bet){stopAuto();render();return;}
   autoRemaining--;
   if(!play()||autoRemaining===0){stopAuto();render();}
  },700);
  render();
 };
 const changeBet=direction=>{
  stopAuto();
  const sizes=[10,25,50,100,250,500,1000];
  const index=sizes.indexOf(bet);
  bet=sizes[Math.min(sizes.length-1,Math.max(0,index+direction))];
  savePractice();render();
 };
 const currentMatches=()=>state.result.filter(n=>state.picks.includes(n)).length;
 const render=()=>{
  root.replaceChildren();
  const header=element('header','ls-header');
  const brand=element('div','ls-brand');brand.append(element('span','ls-brand-leaf','✦'),element('strong','','420Bet'));header.append(brand);
  const title=element('div','ls-title');
  title.append(image('logo.png','ls-logo',"Catastrophe Jack's Lucky Strays Keno"));
  header.append(title);
  const status=element('div','ls-top-status');
  status.append(element('span','ls-balance','Practice Credits: '+credits.toLocaleString('en-CA')),
   element('span','ls-practice-label','PRACTICE · NO WALLET · NO REAL WAGERS'));
  const infoButton=button('ⓘ INFO · PAYTABLE',()=>{infoOpen=true;render();},'ls-info-button');
  infoButton.setAttribute('aria-haspopup','dialog');status.append(infoButton);
  header.append(status);root.append(header);

  const stage=element('div','ls-stage');
  const left=element('aside','ls-left');
  // The wallpaper already includes the full-sized orange tabby. Do not render a duplicate Jack.
  const machine=image('machine/lottery_machine.png','ls-machine','Jack’s lottery ball machine');left.append(machine);
  const meterPanel=element('section','ls-meter');
  meterPanel.append(element('h2','','NINE LIVES METER'));
  const meterRow=element('div','ls-meter-row');meterRow.setAttribute('role','img');
  meterRow.setAttribute('aria-label',meter+' of 9 lives charged');
  for(let i=0;i<9;i++)meterRow.append(image('ui/life_'+(i<meter?'lit':'unlit')+'.png','ls-life-icon',i<meter?'Filled life':'Empty life'));
  meterPanel.append(meterRow);
  meterPanel.append(element('p','ls-meter-caption',meter===9?'READY: 2× NEXT PAYING DRAW · THEN RESET TO 0':lastRound?.bonusApplied?'BONUS PAID · RESET TO 0 / 9':meter+' / 9 · only 0–1 hits charge; any paying win resets'));
  left.append(meterPanel);stage.append(left);

  const board=element('section','ls-board');
  const gridHead=element('div','ls-grid-head');
  gridHead.append(element('span','','SELECT '+pickTarget+' NUMBERS'),element('span','',state.picks.length+' / '+pickTarget+' PICKED'));
  board.append(gridHead);
  const grid=element('div','ls-number-grid');grid.setAttribute('aria-label','Keno numbers 1 to 80');
  for(let n=1;n<=80;n++){
   const picked=state.picks.includes(n),drawn=state.result.includes(n),hit=picked&&drawn;
   const tile=button(String(n),()=>{
    if(autoTimer!==null)return;
    if(!picked&&state.picks.length>=pickTarget)return;
    state=next(state,{type:'pick',value:n});clearResult();render();
   },'ls-number'+(picked?' picked':'')+(drawn?' drawn':'')+(hit?' hit':''));
   tile.setAttribute('aria-pressed',String(picked));
   tile.setAttribute('aria-label','Number '+n+(picked?', chosen':'')+(drawn?', drawn':'')+(hit?', hit':''));
   if(autoTimer!==null)tile.disabled=true;
   if(hit)tile.append(element('span','ls-hit-paw','●'));
   grid.append(tile);
  }
  board.append(grid);stage.append(board);

  const right=element('aside','ls-right');
  const drawnPanel=element('section','ls-drawn');
  drawnPanel.append(element('h2','','DRAWN NUMBERS'),element('p','ls-drawn-sub','(20)'));
  const balls=element('div','ls-balls');balls.setAttribute('aria-label','Latest twenty drawn numbers');
  if(state.result.length){
   for(const n of state.result){
    const hit=state.picks.includes(n);
    const ball=element('span','ls-ball'+(hit?' matched':''),String(n));
    ball.title=hit?'Hit: '+n:'Drawn: '+n;balls.append(ball);
   }
  }else for(let i=0;i<20;i++)balls.append(element('span','ls-ball empty','·'));
  drawnPanel.append(balls);right.append(drawnPanel);
  const hitPanel=element('section','ls-hits');
  hitPanel.append(element('h2','','HITS'),element('strong','',state.result.length?currentMatches()+' / '+pickTarget:'— / '+pickTarget));
  right.append(hitPanel);stage.append(right);root.append(stage);

  const controls=element('div','ls-controls');
  const wager=element('div','ls-wager');
  wager.append(element('span','ls-wager-label','VIRTUAL BET'));
  const wagerRow=element('div','ls-wager-row');
  wagerRow.append(button('−',()=>changeBet(-1),'ls-wager-step'),element('strong','',String(bet)),button('+',()=>changeBet(1),'ls-wager-step'));
  wager.append(wagerRow);controls.append(wager);
  const choose=button('🐾 LUCKY CLAWS',luckyClaws,'ls-action ls-quick');
  choose.append(element('small','','QUICK PICK'));controls.append(choose);
  const go=button('🐾 DRAW 20',play,'ls-action ls-draw');
  go.disabled=state.picks.length!==pickTarget||credits<bet||autoTimer!==null;controls.append(go);
  const clear=button('↶ CLEAR',clearPicks,'ls-action ls-clear');controls.append(clear);
  const auto=button(autoTimer!==null?'■ STOP AUTO':'▶ AUTO',toggleAuto,'ls-action ls-auto');
  auto.dataset.running=String(autoTimer!==null);
  auto.disabled=autoTimer===null&&(state.picks.length!==pickTarget||credits<bet);controls.append(auto);
  root.append(controls);

  const bottom=element('div','ls-bottom');
  const picker=element('label','ls-pick');
  picker.append(element('span','','SPOTS'));
  const select=element('select','ls-pick-select');
  select.setAttribute('aria-label','Number of Keno spots');
  for(let n=1;n<=10;n++){const opt=element('option','',String(n));opt.value=String(n);opt.selected=n===pickTarget;select.append(opt);}
  select.addEventListener('change',()=>changePickCount(Number(select.value)));
  select.disabled=autoTimer!==null;picker.append(select);bottom.append(picker);
  const commentary=element('div','ls-dialogue');
  const avatar=image('characters/jack_idle.png','ls-avatar','Jack');
  commentary.append(avatar,element('p','',state.round===0?'Jack: “See? I’m a professional.”':state.message));
  bottom.append(commentary);
  const win=element('div','ls-win');
  win.append(element('span','','LAST WIN (VIRTUAL)'),element('strong','',lastWin.toLocaleString('en-CA')));
  bottom.append(win);root.append(bottom);

  const extras=element('div','ls-extras');
  const recent=element('div','ls-recent');
  recent.textContent=history.length?'RECENT: '+history.slice(0,3).map(item=>item.hits+'/'+item.picks+(item.bonus?' ×2':'')).join(' · '):'20 RANDOM NUMBERS · 80-NUMBER BOARD';
  extras.append(recent);root.append(extras);
  if(infoOpen){
   const overlay=element('div','ls-info-overlay');
   const dialog=element('section','ls-info-dialog');dialog.setAttribute('role','dialog');
   dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label','Lucky Strays Keno rules and paytable');
   const heading=element('div','ls-info-heading');
   heading.append(element('h2','','CATastrophe Jack’s Keno — INFO'));
   const close=button('✕ CLOSE',()=>{infoOpen=false;render();},'ls-info-close');
   close.setAttribute('aria-label','Close Keno info');heading.append(close);dialog.append(heading);
   const instructions=element('div','ls-info-rules');
   instructions.append(
    element('h3','','HOW TO PLAY'),
    element('p','','Choose 1–10 numbers from 1 to 80, or use Lucky Claws quick pick. Each draw reveals 20 distinct random numbers. Matches determine the base gross multiplier shown in the table below.'),
    element('p','','Set the virtual bet, then press DRAW 20. Matching numbers turn green, and your virtual win is credited to your practice balance. These are illustrative payouts only.'),
    element('h3','','NINE LIVES · 2× BONUS'),
    element('p','','Only a non-paying draw with ZERO or ONE matching number adds exactly ONE life. A non-paying draw with TWO or more hits leaves the meter unchanged. ANY paying draw resets the meter to 0/9, even if only one number matched. At 9/9, the NEXT paying draw receives a 2× gross payout before the meter resets. Additional non-paying draws leave a full meter charged.'),
    element('p','','Your Nine Lives progress is saved in this browser across rounds and reloads. Changing the number of spots resets it. Changing selected numbers or virtual bet does not reset it. Progress starts fresh with this revised 0-or-1-hit rule.'),
    element('h3','','QUICK PICK, AUTO & VIRTUAL CREDITS'),
    element('p','','Lucky Claws replaces your selection with random numbers. CLEAR removes the selection. AUTO plays up to ten practice draws, each using the same 80-number/20-draw rules; STOP AUTO ends the sequence. No wallet or real wagering is involved.')
   );
   dialog.append(instructions);
   const tableHeading=element('div','ls-info-table-heading');
   tableHeading.append(element('h3','','PAYTABLE · '+pickTarget+' SPOTS'),element('span','','Gross return × virtual stake'));
   dialog.append(tableHeading);
   const table=element('table','ls-paytable');
   const body=element('tbody','');
   const headerRow=element('tr','');headerRow.append(element('th','','Hits'),element('th','','Base payout'),element('th','','Nine Lives 2×'));
   body.append(headerRow);
   for(let hits=0;hits<=pickTarget;hits++){
    const base=nineLivesCandidateMultiplier(pickTarget,hits);
    const tr=element('tr','');tr.append(element('td','',String(hits)),element('td','',base.toFixed(4)+'×'),element('td','',(base*2).toFixed(4)+'×'));
    if(base===0)tr.className='ls-pay-zero-row';
    body.append(tr);
   }
   table.append(body);dialog.append(table);
   dialog.append(element('p','ls-info-warning','PROPOSED PRACTICE PAYTABLE · '+KENO_CANDIDATE_STATUS+'. The 94–96% theoretical RTP target includes the 0-or-1-hit 2× feature, under fixed spot selection. This is not an independently approved on-chain schedule; no real funds, payouts, or wagering.'));
   overlay.append(dialog);
   overlay.addEventListener('click',event=>{if(event.target===overlay){infoOpen=false;render();}});
   overlay.addEventListener('keydown',event=>{if(event.key==='Escape'){infoOpen=false;render();}});
   root.append(overlay);
   close.focus?.();
  }
  root.append(element('p','ls-disclaimer','PRACTICE ONLY · No funds or real wagers. Simulated draws and virtual credits; no verified randomness or on-chain payout.'));
 };
 render();return root;
}
