import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync,existsSync} from 'node:fs';
import {REELS,ROWS,LINES,PAYTABLE,BASE_STRIPS,boardAt,initialState,nextSpin,practiceBonus,evaluateLines,MAX_WIN_MULTIPLIER,FREE_WILD_MULTIPLIERS,collectSmokeValue,hotboxTotalMultiplier,isWild} from '../src/best-buds-engine.js';
import {createBestBudsPractice} from '../src/best-buds-ui.js';

test('exactly 25 distinct five-reel paths stay within the 3-row display',()=>{
 assert.equal(LINES.length,25);
 assert.equal(new Set(LINES.map(line=>line.join(','))).size,25);
 for(const line of LINES){assert.equal(line.length,5);for(const r of line)assert.ok(r>=0&&r<ROWS);}
 assert.equal(BASE_STRIPS.length,REELS);
 assert.ok(BASE_STRIPS.every(s=>s.length===60));
});
test('single visible reel strip produces deterministic 5 by 3 outcomes',()=>{
 const board=boardAt(BASE_STRIPS,[0,0,0,0,0]);
 assert.equal(board.length,REELS);assert.ok(board.every(col=>col.length===ROWS));
 for(let r=0;r<REELS;r++)for(let y=0;y<ROWS;y++)assert.equal(board[r][y],BASE_STRIPS[r][y]);
});
test('winning line tracks its exact path and wild substitution only applies to ordinary symbols',()=>{
 const board=Array.from({length:REELS},()=>['BONG','JOINT','PAPERS']);
 board[1][1]='WILD';board[2][1]='WILD';
 const result=evaluateLines(board,2);
 assert.ok(result.wins.some(w=>w.line===1&&w.length===5));
 assert.ok(result.amount>0);
 const nonpay=Array.from({length:REELS},()=>['SCATTER','HOTBOX','HOTBOX']);
 assert.equal(evaluateLines(nonpay,2).amount,0);
});
test('6 hotbox coins enter respins and only base spins consume a practice stake',()=>{
 let s=initialState();const original=s.balance;
 s=nextSpin(s,{force:'hold',rng:()=>.99});
 assert.equal(s.mode,'hold');assert.equal(s.hold.length,6);assert.equal(s.respins,3);
 assert.equal(s.balance,original-s.bet);
 const after=s.balance;
 s=nextSpin(s,{rng:()=>.99});
 assert.equal(s.mode,'hold');assert.equal(s.respins,2);assert.equal(s.balance,after);
 s=nextSpin(s,{rng:()=>.99});
 s=nextSpin(s,{rng:()=>.99});
 assert.equal(s.mode,'base');assert.equal(s.hold.length,0);assert.equal(s.respins,0);
 assert.ok(s.lastFeature==='hold-end');
 assert.ok(s.roundGross<=s.roundBet*MAX_WIN_MULTIPLIER);
});
test('new hotbox coin resets respins to 3, and fill testing resolves promptly',()=>{
 let s=practiceBonus(initialState(),'fill',()=>.9);
 assert.equal(s.mode,'hold');assert.equal(s.hold.length,14);
 s=nextSpin(s,{rng:()=>.99,force:'fill'});
 assert.equal(s.lastFeature,'hold-end');assert.equal(s.mode,'base');
 let t=practiceBonus(initialState(),'collect',()=>.99);
 t=nextSpin(t,{rng:()=>.99,force:'collect'});
 assert.equal(t.mode,'hold');assert.equal(t.respins,3);assert.ok(t.hold.some(c=>c.kind==='collect'));
});
test('3 scatters grant eight Free Rides and feature completion produces final summary',()=>{
 let s=nextSpin(initialState(),{force:'free',rng:()=>.99});
 assert.equal(s.mode,'free');assert.equal(s.freeLeft,8);
 const remainingBalance=s.balance;
 for(let i=0;i<8;i++)s=nextSpin(s,{rng:()=>.99});
 assert.equal(s.mode,'base');assert.equal(s.freeLeft,0);
 assert.equal(typeof s.freeSummary,'number');assert.ok(s.balance>=remainingBalance);
});
test('bonus QA can force jackpot and winnings never exceed per-paid-round cap',()=>{
 let s=practiceBonus(initialState(),'jackpot',()=>.99);
 s=nextSpin(s,{rng:()=>.99,force:'jackpot'});
 assert.ok(s.hold.some(c=>c.kind==='jackpot'&&c.value==='MAJOR'));
 assert.ok(s.roundGross<=s.roundBet*MAX_WIN_MULTIPLIER);
});
test('practice view uses uploaded art, QA button, staggered reel panels and click skip',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document);
 assert.equal(root.dataset.practiceGame,'best-buds-hotbox-road-trip');
 assert.equal(root.querySelectorAll('.bb-buddy').length,0);
 assert.match(root.querySelector('.bb-title-logo').getAttribute('src'),/bestbuds-logo\.png/);
 assert.equal(root.querySelectorAll('.bb-reel').length,5);
 assert.equal(root.querySelectorAll('.bb-cell').length,15);
 assert.match(root.textContent,/BONUS TEST/);
 const qa=[...root.querySelectorAll('button')].find(b=>b.textContent==='BONUS TEST');
 qa.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.ok(root.querySelector('.bb-qa-panel'));
 const hold=[...root.querySelectorAll('button')].find(b=>b.textContent==='Trigger Hold & Win');
 hold.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getGameState().mode,'hold');
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 const start=[...root.querySelectorAll('button')].find(b=>b.textContent==='START HOLD & WIN');
 assert.ok(start);start.dispatchEvent(new window.Event('click',{bubbles:true}));
 const spin=[...root.querySelectorAll('button')].find(b=>b.textContent==='RESPIN');
 spin.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getPresentationState().phase,'spinning');
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 if(root.getPresentationState().phase==='paylines')root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getPresentationState().phase,'idle');
 root.stopAnimation();
});
test('all declared icon, symbol, logo and character art paths resolve in public assets',()=>{
 const ui=readFileSync(new URL('../src/best-buds-ui.js',import.meta.url),'utf8');
 const base=new URL('../public/assets/420bet/best-buds/',import.meta.url);
 for(const [folder,files] of Object.entries({
  ui:['bestbuds-logo.png','icon_hotbox_coin.png','icon_collect_smoke.png','icon_multiplier_x2.png',...['mini','minor','major','grand'].map(x=>'icon_jackpot_'+x+'.png')],
  backgrounds:['bestbuds-bg-desert-sunset.png','bestbuds-bg-night-roadtrip.png'],
  reels:['sym_bong.png','sym_joint.png','sym_chips.png','sym_record.png','sym_rollingpapers.png','sym_lighter.png','sym_sunglasses.png','sym_guitar.png','sym_leaf.png','sym_buddy1_portrait.png','sym_buddy2_portrait.png','sym_wild.png','sym_scatter_van.png','sym_hotbox_100.png'],
  characters:['buddy1_laugh.png','buddy1_surprised.png','buddy1_big_win.png','buddy1_exhale.png','buddy1_skeptical.png','buddy1_thumbs_up.png','buddy2_peace.png','buddy2_inhale.png','buddy2_exhale.png','buddy2_surprised.png','buddy2_laugh.png','buddy2_celebrate.png']
 })){
  for(const file of files){if(folder!=='characters'&&!file.startsWith('icon_jackpot_'))assert.match(ui,new RegExp(file.replaceAll('.','\\.')));assert.ok(existsSync(new URL(folder+'/'+file,base)),folder+'/'+file);}
 }
});

test('Hold & Win displays locked coins throughout each manually initiated respin',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=label=>{const el=[...root.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(el,label);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 const skip=()=>{root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Trigger Hold & Win');
 assert.equal(root.getGameState().mode,'hold');assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 click('START HOLD & WIN');
 click('RESPIN');
 assert.equal(root.getPresentationState().phase,'spinning');
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6,'previously landed coins remain visible while empty cells spin');
 assert.equal(root.querySelectorAll('.bb-hold-cell-rolling').length,9);
 skip();
 assert.equal(root.getGameState().mode,'hold');
 assert.equal(root.getGameState().respins,2);
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 assert.equal(root.querySelectorAll('.bb-hold-cell-rolling').length,0);
 click('RESPIN');skip();assert.equal(root.getGameState().respins,1);
 click('RESPIN');skip();
 assert.equal(root.getGameState().mode,'base');
 assert.equal(root.getGameState().lastFeature,'hold-end');
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6,'final Hold & Win result persists after payout');
 root.stopAnimation();
});
test('manual respins reset to 3 when a new coin lands and do not charge credits',()=>{
 let state=practiceBonus(initialState(),'collect',()=>.99);
 const initialCredits=state.balance;
 state=nextSpin(state,{force:'collect',rng:()=>.99});
 assert.equal(state.mode,'hold');
 assert.equal(state.respins,3);
 assert.equal(state.holdNewKeys.length,1);
 assert.equal(state.holdReveal.length,10);
 assert.equal(state.balance,initialCredits);
});
test('Free Rides dedicated WILD receives x2/x3/x5/x10 and winning lines apply max one badge',()=>{
 assert.deepEqual([...FREE_WILD_MULTIPLIERS],[2,3,5,10]);
 const board=Array.from({length:5},()=>['BONG','JOINT','PAPERS']);
 board[1][1]='WILD';board[2][1]='WILD';
 const ordinary=evaluateLines(board,2);
 const boosted=evaluateLines(board,2,{wildMultipliers:{4:2,7:10}});
 const baseline=ordinary.wins.find(w=>w.line===1);
 const bonus=boosted.wins.find(w=>w.line===1);
 assert.equal(bonus.wildMultiplier,10);
 assert.equal(bonus.amount,baseline.amount*10);
 let state=practiceBonus(initialState(),'wild10',()=>.99);
 state=nextSpin(state,{rng:()=>.99,force:state.qa});
 assert.equal(state.mode,'free');
 assert.ok(Object.values(state.freeWildMultipliers).includes(10));
 assert.ok(state.lastWins.some(w=>w.wildMultiplier===10));
 assert.ok(state.roundGross<=state.roundBet*MAX_WIN_MULTIPLIER);
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{initialState:practiceBonus(initialState(),'wild10',()=>.99),rng:()=>.99});
 const spin=[...root.querySelectorAll('button')].find(b=>b.textContent==='FREE SPIN');
 spin.dispatchEvent(new window.Event('click',{bubbles:true}));
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.ok(root.querySelectorAll('.bb-wild-multiplier').length>=3);
 root.stopAnimation();
});
test('wide logo-only header does not render Buddy reaction portraits',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const header=root.querySelector('.bb-header');
 assert.ok(header);
 assert.equal(header.querySelectorAll('img').length,1);
 assert.match(header.querySelector('img').getAttribute('src'),/bestbuds-logo\.png$/);
 assert.equal(root.querySelectorAll('.bb-buddy').length,0);
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-header\{display:flex;justify-content:center/);
 root.stopAnimation();
});
test('Best Buds CSS preserves opaque reels but makes the surrounding frame transparent',()=>{
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-frame\s*\{[^}]*background:transparent/s);
 assert.match(css,/\.bb-cell\s*\{[^}]*background:radial-gradient/s);
 assert.match(css,/\.bb-header\s*\{[^}]*height:310px/s);
});

test('Collect Smoke copies existing locked ordinary coin values into final Hold & Win payout',()=>{
 const coins=[{key:0,kind:'coin',value:2},{key:1,kind:'coin',value:5},{key:2,kind:'jackpot',value:'MINI'}];
 assert.equal(collectSmokeValue(coins),7);
 assert.equal(hotboxTotalMultiplier([...coins,{key:3,kind:'collect',value:7}]),34);
 const state=practiceBonus(initialState(),'collect',()=>.99);
 const beforeTotal=collectSmokeValue(state.hold);
 const next=nextSpin(state,{rng:()=>.99,force:state.qa});
 assert.equal(next.mode,'hold');
 const collect=next.hold.find(c=>c.kind==='collect');
 assert.ok(collect,'Collect Smoke asset must land');
 assert.equal(collect.value,beforeTotal);
 assert.equal(next.collectSmokeEvent.multipliers,beforeTotal);
 assert.equal(next.collectSmokeEvent.credits,beforeTotal*next.roundBet);
 assert.equal(next.respins,3);
 assert.equal(next.holdReveal.find(c=>c.key===collect.key)?.kind,'collect');
 assert.match(next.message,/COLLECT SMOKE!/);
 const withoutCollect=next.hold.filter(c=>c!==collect);
 assert.equal(hotboxTotalMultiplier(next.hold)-hotboxTotalMultiplier(withoutCollect),beforeTotal);
});
test('Collect Smoke appears as a credit collection UI event on the triggered Hold & Win board',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=label=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Collect Smoke');
 assert.equal(root.getGameState().mode,'hold');
 click('RESPIN');
 assert.equal(root.querySelectorAll('.bb-hold-reel-spinning').length,5);
 assert.equal(root.querySelectorAll('.bb-hold-spin-window').length,6);
 assert.equal(root.querySelectorAll('.bb-hold-spin-tile').length,72);
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,9);
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getPresentationState().phase,'idle');
 assert.equal(root.querySelectorAll('.bb-collect-announcement').length,1);
 assert.match(root.querySelector('.bb-collect-announcement').textContent,/COLLECT SMOKE!/);
 assert.ok(root.getGameState().collectSmokeEvent.credits>0);
 assert.equal(root.querySelectorAll('.bb-collect-coin').length,1);
 const lockedCollect=root.querySelector('.bb-collect-coin');
 const overlay=lockedCollect.querySelector('.bb-collect-value');
 assert.ok(overlay,'collect multiplier must be displayed on top of the icon');
 assert.equal(overlay.textContent,'×'+root.getGameState().collectSmokeEvent.multipliers.toFixed(2));
 assert.equal(root.getGameState().respins,3);
 root.stopAnimation();
});
test('Hold reel stop has five independent columns and retains locked coins',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=label=>{const b=[...root.querySelectorAll('button')].find(b=>b.textContent===label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Trigger Hold & Win');
 click('START HOLD & WIN');click('RESPIN');
 assert.equal(root.querySelectorAll('.bb-hold-reel-spinning').length,5);
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelectorAll('.bb-hold-reel-spinning').length,0);
 root.stopAnimation();
});

test('Collect Smoke multiplier overlay remains visible through later Hold & Win respins',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=name=>{
  const btn=[...root.querySelectorAll('button')].find(x=>x.textContent===name);
  assert.ok(btn,name);
  btn.dispatchEvent(new window.Event('click',{bubbles:true}));
 };
 click('BONUS TEST');click('Collect Smoke');click('RESPIN');
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 const multiplier=root.querySelector('.bb-collect-value').textContent;
 click('RESPIN');
 assert.equal(root.querySelector('.bb-collect-value').textContent,multiplier,'locked collection retains its multiplier during subsequent reel motion');
 assert.equal(root.querySelectorAll('.bb-collect-value').length,1);
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelector('.bb-collect-value').textContent,multiplier);
 root.stopAnimation();
});

test('Best Buds has a full-width, low-height playfield with two visible right-side reference boxes',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const workspace=root.querySelector('.bb-workspace');
 assert.ok(workspace);
 assert.equal(workspace.firstElementChild.classList.contains('bb-frame'),true);
 assert.equal(workspace.lastElementChild.classList.contains('bb-sidebar'),true);
 assert.equal(workspace.querySelectorAll('.bb-sidebar .bb-reference-panel').length,2);
 const paytable=workspace.querySelector('.bb-pay-panel .bb-side-paytable');
 assert.ok(paytable);
 assert.equal(paytable.querySelectorAll('tr').length,Object.keys(PAYTABLE).length+1);
 assert.equal(paytable.querySelectorAll('.bb-pay-symbol img').length,Object.keys(PAYTABLE).length);
 const guide=workspace.querySelector('.bb-feature-panel');
 for(const phrase of ['BONUS TRIGGERS','3 VAN SCATTERS','6 HOTBOX COINS','COLLECT SMOKE','MINI ×20','GRAND ×1000'])assert.ok(guide.textContent.includes(phrase),phrase);
 assert.equal(workspace.querySelectorAll('.bb-reel').length,5);
 assert.equal(workspace.querySelectorAll('.bb-cell').length,15);
 root.stopAnimation();
});
test('Both reference panels remain visible during Hold & Win and free rides',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const button=label=>{const element=[...root.querySelectorAll('button')].find(b=>b.textContent===label);assert.ok(element,label);element.dispatchEvent(new window.Event('click',{bubbles:true}));};
 button('BONUS TEST');button('Trigger Hold & Win');
 button('START HOLD & WIN');
 assert.equal(root.getGameState().mode,'hold');
 assert.equal(root.querySelectorAll('.bb-reference-panel').length,2);
 button('RESPIN');
 assert.equal(root.getPresentationState().phase,'spinning');
 assert.equal(root.querySelectorAll('.bb-reference-panel').length,2);
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 button('BONUS TEST');button('8 Free Rides');
 assert.equal(root.getGameState().mode,'free');
 assert.equal(root.querySelectorAll('.bb-reference-panel').length,2);
 root.stopAnimation();
});
test('Wide desktop layout stays horizontally split; narrower viewports stack without clipping',()=>{
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-workspace\s*\{\s*display:grid;/);
 assert.match(css,/grid-template-columns:minmax\(0,1fr\) clamp\(280px,23vw,348px\)/);
 assert.match(css,/\.bb-workspace \.bb-stage\s*\{[^}]*height:clamp\(270px,44vh,435px\)/s);
 assert.match(css,/@media\(max-width:720px\)\s*\{\s*\.bb-workspace\{grid-template-columns:minmax\(0,1fr\)/s);
});

test('Reel images stay within individual cell bounds in compact layout',()=>{
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-cell\s*\{position:relative;overflow:hidden;contain:layout paint\}/);
 assert.match(css,/\.bb-cell > img\s*\{[^}]*position:absolute;inset:-12.5%;width:125%;height:125%/s);
 assert.match(css,/\.bb-coin-kind > img\s*\{[^}]*width:86%;height:86%/s);
});
test('INFO modal presents 25 exact source-of-truth paylines as SVG art',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document);
 const info=[...root.querySelectorAll('button')].find(b=>b.textContent==='INFO / PAYTABLE');
 info.dispatchEvent(new window.Event('click',{bubbles:true}));
 const img=root.querySelector('.bb-modal .bb-paylines-image');
 assert.ok(img);
 assert.equal(img.getAttribute('src'),'/assets/420bet/best-buds/ui/bestbuds-25-paylines.svg');
 assert.match(img.getAttribute('alt'),/25 exact paylines/);
 const svg=readFileSync(new URL('../public/assets/420bet/best-buds/ui/bestbuds-25-paylines.svg',import.meta.url),'utf8');
 assert.equal((svg.match(/>LINE \d\d<\/text>/g)||[]).length,LINES.length);
 const all=[...svg.matchAll(/<polyline points="([^"]+)" fill="none" stroke="[^"]+" stroke-width="3.5"/g)];
 assert.equal(all.length,LINES.length);
 for(let i=0;i<LINES.length;i++){
  const ys=all[i][1].split(' ').map(pt=>Number(pt.split(',')[1]));
  assert.deepEqual(ys,LINES[i].map(row=>+(39+(row+.5)*37).toFixed(2)),'payline '+(i+1));
 }
 root.stopAnimation();
});

test('rolling reel icons use exact 3-row cells rather than intrinsic image height',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const spin=[...root.querySelectorAll('button')].find(b=>b.textContent==='SPIN');
 spin.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getPresentationState().phase,'spinning');
 assert.equal(root.querySelectorAll('.bb-roll-mask').length,5);
 const strips=root.querySelectorAll('.bb-roll-track');
 assert.equal(strips.length,5);
 for(const strip of strips){
  const tiles=strip.querySelectorAll('.bb-roll-tile');
  assert.equal(tiles.length,18);
  for(let i=0;i<9;i++){
   assert.equal(tiles[i].querySelector('img').getAttribute('src'),tiles[i+9].querySelector('img').getAttribute('src'));
  }
 }
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-reel-rolling \.bb-roll-track\s*\{[^}]*height:600%/s);
 assert.match(css,/\.bb-reel-rolling \.bb-roll-tile\s*\{[^}]*flex:0 0 calc\(100% \/ 18\)/s);
 assert.match(css,/\.bb-roll-tile > \.bb-roll-symbol\s*\{[^}]*width:125%;height:125%/s);
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 root.stopAnimation();
});

test('INFO always exposes BACK TO GAME without losing credits, current bonus or board',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=name=>{const b=[...root.querySelectorAll('button')].find(x=>x.textContent===name);assert.ok(b,name);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Trigger Hold & Win');
 click('START HOLD & WIN');
 const stateBefore=root.getGameState(),snapshot={balance:stateBefore.balance,mode:stateBefore.mode,respins:stateBefore.respins,hold:JSON.stringify(stateBefore.hold)};
 click('INFO / PAYTABLE');
 assert.equal(root.querySelector('[role="dialog"]')?.getAttribute('aria-modal'),'true');
 const back=root.querySelectorAll('.bb-back-to-game');
 assert.equal(back.length,2,'return button accessible at top and bottom of scrollable guide');
 assert.equal(back[0].textContent,'BACK TO GAME');
 back[0].dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelector('.bb-modal-cover'),null);
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 const after=root.getGameState();
 assert.equal(after.balance,snapshot.balance);assert.equal(after.mode,snapshot.mode);
 assert.equal(after.respins,snapshot.respins);assert.equal(JSON.stringify(after.hold),snapshot.hold);
 click('INFO / PAYTABLE');
 root.querySelector('.bb-modal-footer .bb-back-to-game').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.querySelector('.bb-modal-cover'),null);
 click('RESPIN');
 assert.equal(root.getPresentationState().phase,'spinning');
 root.stopAnimation();
});

test('HOTBOX spinning strip is cell-scaled and repeats a matched six-icon cycle',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=label=>{const b=[...root.querySelectorAll('button')].find(v=>v.textContent===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Trigger Hold & Win');
 assert.equal(root.getPresentationState().hotboxSplash,'trigger');
 click('START HOLD & WIN');
 click('RESPIN');
 const strips=root.querySelectorAll('.bb-hold-spin-track');
 assert.equal(strips.length,9);
 for(const strip of strips){
  const tiles=strip.querySelectorAll('.bb-hold-spin-tile');
  assert.equal(tiles.length,12);
  for(let i=0;i<6;i++)assert.equal(tiles[i].querySelector('img').getAttribute('src'),tiles[i+6].querySelector('img').getAttribute('src'));
 }
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 assert.match(css,/\.bb-hold-cell-rolling \.bb-hold-spin-track\s*\{[^}]*height:1200%/s);
 assert.match(css,/\.bb-hold-cell-rolling \.bb-hold-spin-tile\s*\{[^}]*flex:0 0 calc\(100% \/ 12\)/s);
 assert.match(css,/\.bb-hold-spin-tile > \.bb-hold-spin-symbol\s*\{[^}]*width:76%;height:76%/s);
 root.stopAnimation();
});
test('HOTBOX start and completion splashes pause play and display the credited bonus win',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=label=>{const b=[...root.querySelectorAll('button')].find(v=>v.textContent===label);assert.ok(b,label);b.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('Trigger Hold & Win');
 assert.equal(root.getPresentationState().hotboxSplash,'trigger');
 assert.match(root.querySelector('.bb-hotbox-splash-img').getAttribute('src'),/bestbuds-hotbox-trigger\.png$/);
 assert.equal(root.querySelectorAll('.bb-coin-locked').length,6);
 click('START HOLD & WIN');
 assert.equal(root.getPresentationState().hotboxSplash,null);
 click('RESPIN');root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 click('RESPIN');root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 click('RESPIN');root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getGameState().lastFeature,'hold-end');
 assert.equal(root.getPresentationState().hotboxSplash,'complete');
 const total=root.getGameState().featureTotal;
 assert.equal(root.querySelector('.bb-hotbox-total-credits').textContent,total.toFixed(2));
 assert.match(root.querySelector('.bb-hotbox-splash-img').getAttribute('src'),/bestbuds-hotbox-complete\.png$/);
 click('CLICK TO CONTINUE');
 assert.equal(root.getPresentationState().hotboxSplash,null);
 assert.equal(root.getGameState().lastFeature,'');
 assert.equal(root.getGameState().balance,1000-root.getGameState().bet+total);
 root.stopAnimation();
});


test('only standalone WILD substitutes; Buddy 1 and Buddy 2 are ordinary paying symbols',()=>{
 assert.equal(isWild('WILD'),true);
 for(const s of ['BUDDY1','BUDDY2','HOTBOX','SCATTER','BONG'])assert.equal(isWild(s),false,s);
 assert.equal(BASE_STRIPS.every(strip=>strip.includes('WILD')&&!strip.includes('WILD1')&&!strip.includes('WILD2')),true);
});
test('two Buddy2 portraits followed by CHIPS do not win, but three Buddy2 portraits pay',()=>{
 const board=[
  ['BUDDY2','GUITAR','RECORD'],
  ['BUDDY2','SUNGLASSES','RECORD'],
  ['CHIPS','BUDDY1','HOTBOX'],
  ['JOINT','BUDDY1','LIGHTER'],
  ['PAPERS','JOINT','HOTBOX']
 ];
 assert.equal(evaluateLines(board,2).wins.some(w=>w.line===2),false);
 board[2][0]='BUDDY2';
 const win=evaluateLines(board,2).wins.find(w=>w.line===2);
 assert.ok(win);
 assert.equal(win.symbol,'BUDDY2');
 assert.equal(win.length,3);
 assert.equal(win.amount,1); // 3 Buddy2 pays 0.5× a 2-credit total bet
});
test('standalone WILD substitutes and multiplies only during free spins',()=>{
 const board=Array.from({length:5},()=>['CHIPS','JOINT','PAPERS']);
 board[0][0]='WILD';board[1][0]='WILD';
 const ordinary=evaluateLines(board,2).wins.find(w=>w.line===2);
 const boosted=evaluateLines(board,2,{wildMultipliers:{0:3,3:10}}).wins.find(w=>w.line===2);
 assert.ok(ordinary&&boosted);
 assert.equal(boosted.amount,ordinary.amount*10);
 const noWild=Array.from({length:5},()=>['CHIPS','JOINT','PAPERS']);
 noWild[0][0]='BUDDY1';noWild[1][0]='BUDDY2';
 assert.equal(evaluateLines(noWild,2,{wildMultipliers:{0:10,3:10}}).wins.some(w=>w.line===2),false);
 let s=practiceBonus(initialState(),'wild10',()=>.99);
 s=nextSpin(s,{rng:()=>.99,force:s.qa});
 assert.ok(Object.values(s.freeWildMultipliers).includes(10));
 for(const [key] of Object.entries(s.freeWildMultipliers)){
  const r=Math.floor(Number(key)/ROWS),y=Number(key)%ROWS;
  assert.equal(s.board[r][y],'WILD');
 }
});
test('INFO and right paytable explain the new distinct WILD artwork',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document);
 const labels=[...root.querySelectorAll('.bb-pay-symbol')].map(c=>c.textContent);
 assert.ok(labels.includes('BUDDY 1'));assert.ok(labels.includes('BUDDY 2'));
 assert.ok(!labels.includes('BUDDY 1 WILD')&&!labels.includes('BUDDY 2 WILD'));
 const wild=root.querySelector('.bb-wild-guide img');
 assert.ok(wild);
 assert.match(wild.getAttribute('src'),/sym_wild\.png$/);
 const info=[...root.querySelectorAll('button')].find(b=>b.textContent==='INFO / PAYTABLE');
 info.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.match(root.querySelector('.bb-modal').textContent,/Only the green leaf WILD substitutes/);
 assert.ok(existsSync(new URL('../public/assets/420bet/best-buds/reels/sym_wild.png',import.meta.url)));
 root.stopAnimation();
});

test('uploaded WILD PNG is the active reel symbol, including paytable, animation, and free-spin bonus',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 assert.equal(root.querySelector('.bb-wild-guide img').getAttribute('src'),'/assets/420bet/best-buds/reels/sym_wild.png');
 const img=new URL('../public/assets/420bet/best-buds/reels/sym_wild.png',import.meta.url);
 assert.ok(existsSync(img),'uploaded WILD PNG must exist in the public reels assets');
 const spin=[...root.querySelectorAll('button')].find(b=>b.textContent==='SPIN');
 spin.dispatchEvent(new window.Event('click',{bubbles:true}));
 const wildSources=[...root.querySelectorAll('.bb-roll-track img')].map(v=>v.getAttribute('src'));
 for(const src of wildSources.filter(v=>v.includes('sym_wild')))assert.ok(src.endsWith('/sym_wild.png'));
 root.stopAnimation();
});

test('Free Rides QA opens entry splash and player explicitly starts the eight spins',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=name=>{const el=[...root.querySelectorAll('button')].find(b=>b.textContent===name);assert.ok(el,name);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('8 Free Rides');
 assert.equal(root.getGameState().mode,'free');
 assert.equal(root.getGameState().freeLeft,8);
 assert.equal(root.getPresentationState().freeSplash,'trigger');
 assert.match(root.querySelector('.bb-free-rides-splash-img')?.getAttribute('src')??root.querySelector('.bb-free-rides-splash .bb-hotbox-splash-img').getAttribute('src'),/bestbuds-free-rides-trigger\.png$/);
 const credits=root.getGameState().balance;
 click('START FREE RIDES');
 assert.equal(root.getPresentationState().freeSplash,null);
 assert.equal(root.getGameState().balance,credits);
 click('FREE SPIN');assert.equal(root.getPresentationState().phase,'spinning');
 root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 if(root.getPresentationState().phase==='paylines')root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(root.getGameState().freeLeft,7);
 root.stopAnimation();
});
test('Free Rides completion banner presents real total and preserves balance until Continue',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=name=>{const el=[...root.querySelectorAll('button')].find(b=>b.textContent===name);assert.ok(el,name);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('8 Free Rides');click('START FREE RIDES');
 for(let i=0;i<8;i++){
  click('FREE SPIN');
  root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
  if(root.getPresentationState().phase==='paylines')root.querySelector('.bb-stage').dispatchEvent(new window.Event('click',{bubbles:true}));
 }
 assert.equal(root.getGameState().mode,'base');
 assert.equal(root.getPresentationState().freeSplash,'complete');
 const total=root.getPresentationState().summary;
 assert.equal(root.querySelector('.bb-free-rides-total-number').textContent,total.toFixed(2));
 assert.match(root.querySelector('.bb-free-rides-splash .bb-hotbox-splash-img').getAttribute('src'),/bestbuds-free-rides-complete\.png$/);
 const balance=root.getGameState().balance;
 click('CLICK TO CONTINUE');
 assert.equal(root.getPresentationState().freeSplash,null);
 assert.equal(root.getPresentationState().summary,null);
 assert.equal(root.getGameState().balance,balance);
 root.stopAnimation();
});
test('Info panel and Free Rides splash do not overlap or reset bonus state',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createBestBudsPractice(document,{rng:()=>.99});
 const click=name=>{const el=[...root.querySelectorAll('button')].find(b=>b.textContent===name);assert.ok(el,name);el.dispatchEvent(new window.Event('click',{bubbles:true}));};
 click('BONUS TEST');click('8 Free Rides');click('START FREE RIDES');
 click('INFO / PAYTABLE');
 assert.equal(root.getGameState().freeLeft,8);
 click('BACK TO GAME');
 assert.equal(root.getGameState().freeLeft,8);
 root.stopAnimation();
});

test('Best Buds settled and spinning reel art scale matches and remains contained',()=>{
 const css=readFileSync(new URL('../src/best-buds.css',import.meta.url),'utf8');
 for(const selector of ['.bb-cell > img','.bb-reel-rolling .bb-roll-tile > .bb-roll-symbol']){
  const cssBlock=css.slice(css.lastIndexOf(selector+'{'),css.indexOf('}',css.lastIndexOf(selector+'{'))+1);
  assert.match(cssBlock,/inset:-12.5%;width:125%;height:125%/);
  assert.match(cssBlock,/object-fit:contain;object-position:center/);
 }
});
