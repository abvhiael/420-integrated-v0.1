import {cannabisHitIcon} from './keno-cannabis-icon.js';
import {KENO_CANDIDATE_STATUS} from './keno-candidate-paytable.js';
import {initial,next} from './practice-engine.js';
import {nineLivesRound,nineLivesCandidateMultiplier} from './keno-nine-lives.js';
export function createNeonKeno(doc=globalThis.document){
 let state=initial('keno');let history=[],pickTarget=5;
 const meterKey='420bet:catastrophe-jack:keno:nine-lives:v1';
 const readMeter=()=>{try{const record=JSON.parse(doc.defaultView?.localStorage?.getItem(meterKey)||'null');return record&&record.picks===pickTarget&&Number.isInteger(record.progress)&&record.progress>=0&&record.progress<=9?record.progress:0;}catch{return 0;}};
 const saveMeter=()=>{try{doc.defaultView?.localStorage?.setItem(meterKey,JSON.stringify({picks:pickTarget,progress:meter}));}catch{/* In-memory fallback. */}};
 let meter=readMeter(),lastRound=null;
 const asset='/assets/420bet/keno/catastrophe-jack/';
 const art=(path,cls,alt)=>{const img=doc.createElement('img');img.src=asset+path;img.className=cls;img.alt=alt;return img;};
 const root=doc.createElement('section');root.className='practice neon-keno-page';root.dataset.practiceGame='keno';
 const el=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const btn=(label,fn,cls='nk-button')=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
 const setPickTarget=count=>{if(!Number.isInteger(count)||count<1||count>10)return;pickTarget=count;meter=0;lastRound=null;saveMeter();for(const n of [...state.picks])state=next(state,{type:'pick',value:n});state={...state,result:[],message:'Choose '+count+' numbers to begin a new practice round.'};render();};
 const draw=()=>{if(state.picks.length!==pickTarget){state={...state,message:'Choose exactly '+pickTarget+' numbers before drawing.'};render();return;}const snapshot=[...state.picks];state=next(state,{type:'play'});const matches=state.result.filter(n=>snapshot.includes(n));lastRound=nineLivesRound(meter,pickTarget,matches.length);meter=lastRound.progress;saveMeter();history.unshift({round:state.round,hits:matches.length,picks:snapshot.length,bonus:lastRound.bonusApplied});history=history.slice(0,6);render();};
 const render=()=>{
 root.replaceChildren();
 const header=el('div','nk-heading');const title=el('div','nk-title');title.append(art('logo.png','nk-jack-logo',"Catastrophe Jack's Lucky Strays Keno"),el('p','nk-subtitle','Nine lives. Eighty numbers. Absolutely terrible judgment.'));header.append(title,el('div','nk-practice-chip','✦ PRACTICE MODE · NO WALLET · NO WAGERS'));root.append(header);
 const host=el('div','nk-jack-host');host.append(art('characters/jack_idle.png','nk-jack-character','Catastrophe Jack, orange tabby'),art('machine/lottery_machine.png','nk-jack-machine','Keno draw machine'));root.append(host);
 const layout=el('div','nk-layout'),board=el('section','nk-panel nk-board'),side=el('aside','nk-side');
 const boardHead=el('div','nk-board-heading');const h=el('div','');h.append(el('h2','','YOUR NUMBER BOARD'),el('p','','Choose '+pickTarget+' numbers from 1 to 80'));boardHead.append(h,el('span','nk-counter',state.picks.length+' / '+pickTarget+' SELECTED'));board.append(boardHead);
 const pickerLabel=el('label','nk-pick-label','HOW MANY NUMBERS?');const picker=el('select','nk-pick-count');picker.setAttribute('aria-label','Choose number of Keno picks');for(let n=1;n<=10;n++){const opt=el('option','',String(n));opt.value=String(n);if(n===pickTarget)opt.setAttribute('selected','');picker.append(opt);}picker.addEventListener('change',()=>setPickTarget(Number(picker.value)));pickerLabel.append(picker);board.append(pickerLabel);
 const grid=el('div','nk-numbers');grid.setAttribute('aria-label','Keno number selection');for(let n=1;n<=80;n++){const picked=state.picks.includes(n),drawn=state.result.includes(n),hit=picked&&drawn;const b=btn(String(n),()=>{if(!state.picks.includes(n)&&state.picks.length>=pickTarget)return;state=next(state,{type:'pick',value:n});state={...state,result:[]};render();},'nk-number'+(picked?' picked':'')+(drawn?' drawn':'')+(hit?' match':''));b.setAttribute('aria-pressed',String(picked));b.setAttribute('aria-label','Number '+n+(picked?', selected':'')+(drawn?', drawn':''));if(hit)b.prepend(cannabisHitIcon(doc));grid.append(b);}board.append(grid);
 const tools=el('div','nk-tools');tools.append(btn('🐾 LUCKY CLAWS (QUICK PICK)',()=>{let used=new Set(state.picks);let available=Array.from({length:80},(_,i)=>i+1).filter(x=>!used.has(x));let total=pickTarget-state.picks.length;while(total-->0){const ix=Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*available.length);const n=available.splice(ix,1)[0];state=next(state,{type:'pick',value:n});}render();},'nk-tool'),btn('CLEAR PICKS',()=>{for(const n of [...state.picks])state=next(state,{type:'pick',value:n});render();},'nk-tool'));board.append(tools);
 const results=el('section','nk-panel nk-results');results.append(el('p','nk-eyebrow','THE LATEST DRAW'),el('h2','','20 LUCKY NUMBERS'));
 const balls=el('div','nk-balls');balls.setAttribute('aria-label','Drawn practice numbers');if(state.result.length){for(const n of state.result){const hit=state.picks.includes(n);const ball=el('span','nk-ball'+(hit?' matched':''),String(n).padStart(2,'0'));ball.title=hit?'Selected number matched':'Drawn number';if(hit)ball.prepend(cannabisHitIcon(doc));balls.append(ball);}}else{for(let i=0;i<20;i++)balls.append(el('span','nk-ball empty','?'));}results.append(balls);
 const hits=state.result.filter(n=>state.picks.includes(n)).length;
 const score=el('div','nk-score');const left=el('div','');left.append(el('span','','NUMBERS MATCHED'),el('strong','',state.result.length?hits+' / '+state.picks.length:'—'));score.append(left);const right=el('div','');right.append(el('span','','PRACTICE ROUND'),el('strong','',String(state.round).padStart(2,'0')));score.append(right);results.append(score);
 const meterPanel=el('section','nk-nine-lives');meterPanel.append(el('h3','','NINE LIVES METER'),el('p','',meter===9?'CAT-ASTROPHE READY! The next paying draw receives 2×.':meter+' / 9 hits banked · 2× next paying draw when full.'));
 const lives=el('div','nk-life-icons');lives.setAttribute('role','img');lives.setAttribute('aria-label',meter+' of nine lives charged');
 for(let i=0;i<9;i++)lives.append(art('ui/life_'+(i<meter?'lit':'unlit')+'.png','nk-life-icon',i<meter?'Charged life':'Empty life'));
 meterPanel.append(lives);results.append(meterPanel);
 if(lastRound){const label=lastRound.bonusApplied?'CAT-ASTROPHE BONUS! 2× applied to this practice result.':lastRound.bonusReady?'CAT-ASTROPHE READY · waiting for a paying draw.':'Nine Lives +'+(history[0]?.hits||0)+' hits.';
 results.append(el('p','nk-bonus-status',label+' Illustrated gross multiplier: '+lastRound.effectiveMultiplier.toFixed(4)+'× (no payout).'));}
 const notice=el('p','practice-message nk-message',state.message);results.append(notice);
 const roll=btn('✦ DRAW 20 PRACTICE NUMBERS',draw,'nk-draw');roll.disabled=state.picks.length!==pickTarget;results.append(roll);
 side.append(results);
 const pay=el('section','nk-panel nk-paytable');pay.append(el('h2','','PAYOUT TABLE · '+pickTarget+' PICKS'),el('p','nk-pay-warning','NINE LIVES PRACTICE CANDIDATE · 95% long-run theoretical RTP including the 2× feature at a fixed pick count. Not independently approved, NOT ON-CHAIN, NOT APPROVED for wagering. Gross multiples include original stake. Practice wager and payout remain zero.'));const table=el('table','nk-pay-grid');const thead=el('thead','');const thr=el('tr','');thr.append(el('th','','Matches'),el('th','','Gross multiplier'));thead.append(thr);table.append(thead);const tbody=el('tbody','');for(let hits=0;hits<=pickTarget;hits++){const tr=el('tr','');tr.append(el('td','',String(hits)),el('td','',nineLivesCandidateMultiplier(pickTarget,hits).toFixed(4)+'×'));if(state.result.length&&hits===state.result.filter(n=>state.picks.includes(n)).length)tr.className='nk-pay-current';tbody.append(tr);}table.append(tbody);pay.append(table);pay.append(el('p','nk-pay-status',KENO_CANDIDATE_STATUS));const stake=el('div','nk-pay-zero');stake.append(el('span','','Practice wager'),el('strong','','0'),el('span','','Practice payout'),el('strong','','0'));pay.append(stake);side.append(pay);
 const past=el('section','nk-panel nk-past');past.append(el('h2','','↻ RECENT PRACTICE ROUNDS'));if(history.length){const list=el('div','nk-past-entries');for(const item of history)list.append(el('div','nk-past-entry','ROUND '+String(item.round).padStart(2,'0')+'   ·   '+item.hits+' / '+item.picks+' MATCHED'+(item.bonus?' · 2× BONUS':'')));past.append(list);}else past.append(el('p','','Play a practice round to see results here.'));side.append(past);
 layout.append(board,side);root.append(layout);
 root.append(el('p','nk-disclaimer','SIMULATED PRACTICE · No funds, payouts, actual wagers, transaction history or real RNG proof. Draws are not canonical on-chain results.'));
 };
 render();return root;
}
