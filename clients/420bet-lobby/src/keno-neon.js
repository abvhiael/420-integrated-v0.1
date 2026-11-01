import {initial,next} from './practice-engine.js';
export function createNeonKeno(doc=globalThis.document){
 let state=initial('keno');let history=[];
 const root=doc.createElement('section');root.className='practice neon-keno-page';root.dataset.practiceGame='keno';
 const el=(tag,cls,txt)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(txt!==undefined)n.textContent=txt;return n;};
 const btn=(label,fn,cls='nk-button')=>{const b=el('button',cls,label);b.type='button';b.addEventListener('click',fn);return b;};
 const draw=()=>{if(!state.picks.length){state={...state,message:'Choose at least one number before drawing.'};render();return;}const snapshot=[...state.picks];state=next(state,{type:'play'});const matches=state.result.filter(n=>snapshot.includes(n));history.unshift({round:state.round,hits:matches.length,picks:snapshot.length});history=history.slice(0,6);render();};
 const render=()=>{
 root.replaceChildren();
 const header=el('div','nk-heading');const title=el('div','nk-title');title.append(el('p','nk-eyebrow','420BET CASINO  /  NUMBER GAMES'),el('h1','','KENO'),el('p','nk-subtitle','Pick your lucky numbers. Watch the draw light up.'));header.append(title,el('div','nk-practice-chip','✦ PRACTICE MODE · NO WALLET · NO WAGERS'));root.append(header);
 const layout=el('div','nk-layout'),board=el('section','nk-panel nk-board'),side=el('aside','nk-side');
 const boardHead=el('div','nk-board-heading');const h=el('div','');h.append(el('h2','','YOUR NUMBER BOARD'),el('p','','Choose up to 10 numbers from 1 to 80'));boardHead.append(h,el('span','nk-counter',state.picks.length+' / 10 SELECTED'));board.append(boardHead);
 const grid=el('div','nk-numbers');grid.setAttribute('aria-label','Keno number selection');for(let n=1;n<=80;n++){const picked=state.picks.includes(n),drawn=state.result.includes(n),hit=picked&&drawn;const b=btn(String(n),()=>{state=next(state,{type:'pick',value:n});render();},'nk-number'+(picked?' picked':'')+(drawn?' drawn':'')+(hit?' match':''));b.setAttribute('aria-pressed',String(picked));b.setAttribute('aria-label','Number '+n+(picked?', selected':'')+(drawn?', drawn':''));grid.append(b);}board.append(grid);
 const tools=el('div','nk-tools');tools.append(btn('✦ QUICK PICK',()=>{let used=new Set(state.picks);let available=Array.from({length:80},(_,i)=>i+1).filter(x=>!used.has(x));let total=10-state.picks.length;while(total-->0){const ix=Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*available.length);const n=available.splice(ix,1)[0];state=next(state,{type:'pick',value:n});}render();},'nk-tool'),btn('CLEAR PICKS',()=>{for(const n of [...state.picks])state=next(state,{type:'pick',value:n});render();},'nk-tool'));board.append(tools);
 const results=el('section','nk-panel nk-results');results.append(el('p','nk-eyebrow','THE LATEST DRAW'),el('h2','','20 LUCKY NUMBERS'));
 const balls=el('div','nk-balls');balls.setAttribute('aria-label','Drawn practice numbers');if(state.result.length){for(const n of state.result){const hit=state.picks.includes(n);const ball=el('span','nk-ball'+(hit?' matched':''),String(n).padStart(2,'0'));ball.title=hit?'Selected number matched':'Drawn number';balls.append(ball);}}else{for(let i=0;i<20;i++)balls.append(el('span','nk-ball empty','?'));}results.append(balls);
 const hits=state.result.filter(n=>state.picks.includes(n)).length;
 const score=el('div','nk-score');const left=el('div','');left.append(el('span','','NUMBERS MATCHED'),el('strong','',state.result.length?hits+' / '+state.picks.length:'—'));score.append(left);const right=el('div','');right.append(el('span','','PRACTICE ROUND'),el('strong','',String(state.round).padStart(2,'0')));score.append(right);results.append(score);
 const notice=el('p','practice-message nk-message',state.message);results.append(notice);
 const roll=btn('✦ DRAW 20 PRACTICE NUMBERS',draw,'nk-draw');roll.disabled=state.picks.length===0;results.append(roll);
 side.append(results);
 const past=el('section','nk-panel nk-past');past.append(el('h2','','↻ RECENT PRACTICE ROUNDS'));if(history.length){const list=el('div','nk-past-entries');for(const item of history)list.append(el('div','nk-past-entry','ROUND '+String(item.round).padStart(2,'0')+'   ·   '+item.hits+' / '+item.picks+' MATCHED'));past.append(list);}else past.append(el('p','','Play a practice round to see results here.'));side.append(past);
 layout.append(board,side);root.append(layout);
 root.append(el('p','nk-disclaimer','SIMULATED PRACTICE · No funds, payouts, actual wagers, transaction history or real RNG proof. Draws are not canonical on-chain results.'));
 };
 render();return root;
}
