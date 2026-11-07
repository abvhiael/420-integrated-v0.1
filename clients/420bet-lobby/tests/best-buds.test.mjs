import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync,existsSync} from 'node:fs';
import {REELS,ROWS,LINES,BASE_STRIPS,boardAt,initialState,nextSpin,practiceBonus,evaluateLines,MAX_WIN_MULTIPLIER} from '../src/best-buds-engine.js';
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
 board[1][1]='WILD1';board[2][1]='WILD2';
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
 assert.equal(root.querySelectorAll('.bb-buddy').length,2);
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
  reels:['sym_bong.png','sym_joint.png','sym_chips.png','sym_record.png','sym_rollingpapers.png','sym_lighter.png','sym_sunglasses.png','sym_guitar.png','sym_leaf.png','sym_buddy1_portrait.png','sym_buddy2_portrait.png','sym_buddy1_wild.png','sym_buddy2_wild.png','sym_scatter_van.png','sym_hotbox_100.png'],
  characters:['buddy1_laugh.png','buddy1_surprised.png','buddy1_big_win.png','buddy1_exhale.png','buddy1_skeptical.png','buddy1_thumbs_up.png','buddy2_peace.png','buddy2_inhale.png','buddy2_exhale.png','buddy2_surprised.png','buddy2_laugh.png','buddy2_celebrate.png']
 })){
  for(const file of files){assert.match(ui,new RegExp(file.replaceAll('.','\\.')));assert.ok(existsSync(new URL(folder+'/'+file,base)),folder+'/'+file);}
 }
});
