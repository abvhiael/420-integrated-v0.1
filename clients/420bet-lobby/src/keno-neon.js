import {initial,next,uniqueNumbers} from './practice-engine.js';
import {KENO_CANDIDATE_STATUS} from './keno-candidate-paytable.js';
import {nineLivesRound,nineLivesCandidateMultiplier} from './keno-nine-lives.js';

// Browser-only Catastrophe Jack Keno presentation and virtual-credit simulation.
// This does not change canonical game outcomes, on-chain settlement or approved wagering rules.
export function createNeonKeno(doc=globalThis.document){
 const root=doc.createElement('section');
 root.className='practice neon-keno-page ls-keno';
 root.dataset.practiceGame='keno';
 const ASSET='/assets/420bet/keno/catastrophe-jack/';
 const METER_KEY='420bet:catastrophe-jack:keno:nine-lives:v1';
 const PRACTICE_KEY='420bet:catastrophe-jack:keno:practice:v1';
 let state=initial('keno'),pickTarget=10,history=[],lastRound=null,autoTimer=null,autoRemaining=0;
 let meter=0,credits=100000,bet=100,lastWin=0;
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
  state=next(state,{type:'play'});
  const hits=state.result.filter(n=>snapshot.includes(n)).length;
  lastRound=nineLivesRound(meter,pickTarget,hits);
  meter=lastRound.progress;saveProgress();
  credits-=bet;
  lastWin=Math.round(bet*lastRound.effectiveMultiplier);
  credits+=lastWin;savePractice();
  history.unshift({round:state.round,hits,picks:pickTarget,bonus:lastRound.bonusApplied,win:lastWin});
  history=history.slice(0,8);
  state.message=lastRound.bonusApplied?'CAT-ASTROPHE! Jack doubles the winning draw!':
   lastRound.bonusReady?'NINE LIVES CHARGED! The next paying draw is doubled.':
   lastWin>0?'Jack: “See? I’m a professional.”':'Jack: “That was obviously the machine’s fault.”';
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
   element('span','ls-practice-label','PRACTICE · NO REAL WAGERS'));
  header.append(status);root.append(header);

  const tagline=element('p','ls-tagline','Every number has nine lives. Your luck doesn’t.');root.append(tagline);
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
  meterPanel.append(element('p','ls-meter-caption',meter===9?'CAT-ASTROPHE READY · NEXT PAYING WIN ×2':meter+' / 9 · matching numbers charge the meter'));
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
  const info=element('details','ls-info');
  info.append(element('summary','','ℹ PAYTABLE & RULES'));
  const content=element('div','ls-info-content');
  content.append(element('h3','','PROPOSED PAYTABLE · '+pickTarget+' SPOTS'));
  const table=element('table','ls-paytable');const body=element('tbody','');
  const head=element('tr','');head.append(element('th','','Hits'),element('th','','Base gross multiplier'));
  body.append(head);
  for(let hits=0;hits<=pickTarget;hits++){
   const tr=element('tr','');tr.append(element('td','',String(hits)),element('td','',nineLivesCandidateMultiplier(pickTarget,hits).toFixed(4)+'×'));body.append(tr);
  }
  table.append(body);content.append(table);
  content.append(element('p','','Hit totals accumulate to nine; the following paying draw is doubled, then the meter resets. Pick-count changes reset the meter.'));
  content.append(element('p','','Practice virtual credits are local browser simulation only. '+KENO_CANDIDATE_STATUS+'. Candidate theoretical RTP targets 95% including the bonus. Not approved for live wagers or on-chain settlement.'));
  info.append(content);extras.append(info);
  const recent=element('div','ls-recent');
  recent.textContent=history.length?'RECENT: '+history.slice(0,3).map(item=>item.hits+'/'+item.picks+(item.bonus?' ×2':'')).join(' · '):'20 RANDOM NUMBERS · 80-NUMBER BOARD';
  extras.append(recent);root.append(extras);
  root.append(element('p','ls-disclaimer','PRACTICE ONLY · No funds or real wagers. Simulated draws and virtual credits; no verified randomness or on-chain payout.'));
 };
 render();return root;
}
