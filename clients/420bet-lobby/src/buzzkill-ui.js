import {BUZZ_RULES,createBuzzkill,buzzAction} from './buzzkill-engine.js';
const make=(d,tag,cls,text)=>{const n=d.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const fmt=n=>Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const moods=[{at:1,name:'JUST CHILLIN\'',desc:'Everything is mellow.'},{at:2,name:'FEELIN\' GROOVY',desc:'The smoke starts lifting Kevin.'},{at:4.2,name:'FAR OUT, MAN!',desc:'Flowers, rainbows and a whole lot of peace.'},{at:10,name:'COSMIC CONSCIOUSNESS',desc:'Reality is seriously psychedelic.'}];
export function createBuzzkillPractice(doc=globalThis.document,options={}){
 const state=createBuzzkill(options),root=make(doc,'section','bz-game');
 root.dataset.practiceGame='buzzkill';root.gameState=state;
 let scene=null,raf=null,startAt=0,dead=false,loading=false;
 const head=make(doc,'header','bz-header');
 head.append(make(doc,'div','bz-brand','420BET ORIGINALS'),make(doc,'span','bz-practice','PRACTICE ONLY · NO WALLET · NO REAL WAGERS'));
 const top=make(doc,'div','bz-top');
 const title=make(doc,'div','bz-title');title.append(make(doc,'h1','','BUZZKILL!'),make(doc,'p','','How high can you get before Mom finds out?'));
 const balance=make(doc,'div','bz-balance','');
 top.append(title,balance);
 const stage=make(doc,'div','bz-stage');
 const mount=make(doc,'div','bz-scene');
 mount.setAttribute('aria-label','Animated seventies bedroom, levitating Kevin and psychedelic effects');
 const fallback=make(doc,'div','bz-fallback');
 fallback.setAttribute('aria-hidden','true');
 fallback.append(make(doc,'div','bz-fallback-kevin','☮'));
 mount.append(fallback);
 const hud=make(doc,'div','bz-mult-wrap');
 const mult=make(doc,'strong','bz-mult','1.00×');
 const mood=make(doc,'span','bz-mood','JUST CHILLIN\'');
 hud.append(mult,mood);
 const bust=make(doc,'div','bz-bust');bust.setAttribute('role','status');bust.textContent='BUZZKILL! MOM\'S HOME!';
 stage.append(mount,hud,bust);
 const below=make(doc,'div','bz-controls');
 const wager=make(doc,'div','bz-wager');
 wager.append(make(doc,'label','','BET · PRACTICE CREDITS'));
 const minus=make(doc,'button','bz-step','−'),amt=make(doc,'strong','bz-amount','10.00'),plus=make(doc,'button','bz-step','+');
 minus.type=plus.type='button';wager.append(minus,amt,plus);
 const auto=make(doc,'div','bz-auto');
 const autoLabel=make(doc,'label','','AUTO CASH-OUT ×');
 const autoRow=make(doc,'div','bz-auto-row');
 const check=make(doc,'input','','');check.type='checkbox';check.setAttribute('aria-label','Enable auto cash-out');
 const target=make(doc,'input','bz-target','');target.type='number';target.min=String(BUZZ_RULES.minAuto);target.max=String(BUZZ_RULES.maxAuto);target.step='.01';target.value=state.autoTarget.toFixed(2);target.setAttribute('aria-label','Automatic cash-out multiplier target');
 autoRow.append(check,target);auto.append(autoLabel,autoRow);
 const cash=make(doc,'button','bz-cash','▶ START ROUND');cash.type='button';
 const repeat=make(doc,'button','bz-refill','+1,000 PRACTICE CREDITS');repeat.type='button';
 below.append(wager,auto,cash,repeat);
 const info=make(doc,'div','bz-bottom');
 const feedback=make(doc,'p','bz-feedback','');
 const history=make(doc,'div','bz-history');history.setAttribute('aria-label','Last twelve practice rounds');
 const desc=make(doc,'p','bz-disclaimer','Practice demo with a 96% theoretical RTP before rounding. Crash is predetermined. Visuals are cosmetic; no on-chain randomness, payouts or transactions.');
 info.append(feedback,history,desc);
 root.append(head,top,stage,below,info);
 function update(){
  balance.textContent='PRACTICE CREDITS  '+fmt(state.balance);
  amt.textContent=fmt(state.bet);
  mult.textContent=state.multiplier.toFixed(2)+'×';
  mood.textContent=state.phase==='bust'?'MOM KILLED THE BUZZ':moods.reduce((a,b)=>state.multiplier>=b.at?b:a,moods[0]).name;
  feedback.textContent=state.notice+(state.cashedAt?' · Cashed out '+state.cashedAt.toFixed(2)+'× · +'+fmt(state.return)+' credits':'');
  const lock=state.phase==='running';minus.disabled=lock||state.bet<=1;plus.disabled=lock||state.bet>=100;check.disabled=lock;target.disabled=lock;
  check.checked=state.autoEnabled;
  cash.disabled=lock&&state.settled||state.phase!=='running'&&state.balance<state.bet;
  cash.textContent=state.phase==='running'?(state.settled?'✓ CASHED OUT':'CASH OUT · '+fmt(state.bet*state.multiplier)):state.phase==='bust'?'▶ NEW ROUND':'▶ START ROUND';
  bust.classList.toggle('bz-show',state.phase==='bust');
  if(state.phase==='bust'){
   history.replaceChildren();
   for(const row of state.history.slice(0,6))history.append(make(doc,'span','bz-history-pill'+(row.cashedAt?' bz-win':''),row.crash.toFixed(2)+'×'));
  }
 }
 function changeBet(delta){if(buzzAction(state,'bet',Math.max(1,Math.min(100,state.bet+delta))))update();}
 minus.addEventListener('click',()=>changeBet(-1));plus.addEventListener('click',()=>changeBet(1));
 check.addEventListener('change',()=>{buzzAction(state,'auto-enabled',check.checked);update();});
 target.addEventListener('change',()=>{
   const v=Number(target.value);if(!buzzAction(state,'auto-target',v)){target.value=state.autoTarget.toFixed(2);return;}
   target.value=state.autoTarget.toFixed(2);update();
 });
 repeat.addEventListener('click',()=>{if(buzzAction(state,'refill'))update();});
 const w=doc.defaultView??globalThis;
 const now=()=>w.performance?.now?.()??globalThis.performance?.now?.()??0;
 const requestFrame=fn=>w.requestAnimationFrame? w.requestAnimationFrame(fn):null;
 const cancelFrame=id=>{if(id!==null&&w.cancelAnimationFrame)w.cancelAnimationFrame(id);};
 function loop(){
  if(dead||state.phase!=='running')return;
  buzzAction(state,'tick',Math.max(state.elapsed,now()-startAt));
  scene?.setLevel(state.multiplier);
  if(state.phase==='bust')scene?.bust();
  update();
  if(state.phase==='running')raf=requestFrame(loop);
  else raf=null;
 }
 function start(){
  if(!buzzAction(state,'start'))return;
  scene?.reset();scene?.setLevel(1);startAt=now();update();raf=requestFrame(loop);
 }
 cash.addEventListener('click',()=>{
  if(state.phase==='running'){if(buzzAction(state,'cashout'))update();}
  else start();
 });
 async function setupScene(){
  if(loading||dead)return;loading=true;
  try{
   const {mountBuzzkillScene}=await import('./buzzkill-scene.js');
   if(dead)return;
   scene=mountBuzzkillScene(mount,{reducedMotion:!!w.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches});
   fallback.remove();
  }catch(error){
   state.notice='Animated scene unavailable; practice game controls are still playable.';
   // Keep fallback so an offline/device issue never prevents playing.
   update();
  }
 }
 if(options.animate!==false&&typeof w.requestAnimationFrame==='function')void setupScene();
 update();
 root.stopAnimation=()=>{
  dead=true;cancelFrame(raf);raf=null;scene?.destroy();scene=null;
 };
 return root;
}
