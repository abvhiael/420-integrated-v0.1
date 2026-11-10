import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {
 createCatastropheJack,JACK_STOP_ORDER,JACK_STOP_DELAY_MS,JACK_LINES,JACK_CROSS,
 jackSpin,jackFeature,jackEvaluate,jackBellAward,JACK_PAY,JACK_BELL_PAY,JACK_BASE_REELS,JACK_FREE_POOL
} from '../src/catastrophe-jack.js';
import {SLOT_MACHINES,slotMachinePath,slotMachineFromHash,createSlotsLobby} from '../src/slots-lobby.js';
import {readFileSync} from 'node:fs';

test('Catastrophe Jack is ninth lobby machine with a direct playable practice route',()=>{
 assert.equal(SLOT_MACHINES.length,9);
 assert.equal(SLOT_MACHINES[8].id,'catastrophe-jack');
 assert.equal(SLOT_MACHINES[8].practiceBeta,true);
 assert.match(SLOT_MACHINES[8].art,/catastrophe_jack_logo\.png$/);
 assert.equal(slotMachinePath('catastrophe-jack'),'#game=slots&machine=catastrophe-jack');
 assert.equal(slotMachineFromHash('#game=slots&machine=catastrophe-jack')?.id,'catastrophe-jack');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert.match(main,/createCatastropheJack\(document\)/);
});
test('nine individually animated positions follow 4, 5, 6, 1, 2, 3, 7, 8, 9 with half-second gaps',()=>{
 assert.deepEqual(JACK_STOP_ORDER,[4,5,6,1,2,3,7,8,9]);
 assert.equal(JACK_STOP_DELAY_MS,500);
 assert.equal(JACK_LINES.length,8);
 assert.deepEqual(JACK_CROSS,[1,3,5,7]);
});
test('four-bell diamond and either insurance diagonal are mutually prioritized',()=>{
 const bells=['FISH','BELL','FISH','BELL','FISH','BELL','FISH','BELL','FISH'];
 assert.equal(jackFeature(bells),'free');
 const insurance=['CLAIM','BUD','FISH','PIZZA','CLAIM','CASH','TICKET','BUD','CLAIM'];
 assert.equal(jackFeature(insurance),'insurance');
 assert.equal(jackFeature(['BUD','CASH','CLAIM','FISH','CLAIM','PIZZA','CLAIM','BUD','TICKET']),'insurance');
 assert.equal(jackFeature(['FISH','BUD','FISH','CASH','ANVIL','DYNAMITE','BUD','FISH','PIZZA']),'reversal');
});
test('line wins, bonus bell counts and feature modifiers have finite credit awards',()=>{
 const board=Array(9).fill('TICKET');
 assert.equal(jackEvaluate(board,1).total,64);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,9).amount,300);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,6).amount,180);
 assert.equal(jackBellAward(Array(9).fill('BELL'),1,3).amount,120);
 const sample=jackSpin('base',()=>0);
 assert.deepEqual(sample,['TICKET','BELL','TICKET','BELL','TICKET','BELL','TICKET','BELL','TICKET']);
});
test('game screen shows nine reel images, all three bonus test buttons and full bleed stage',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 assert.equal(stage.querySelectorAll('.cj-cell').length,9);
 assert.equal(stage.querySelectorAll('.cj-cell img').length,9);
 assert.equal(stage.dataset.mode,'base');
 const testButtons=[...stage.querySelectorAll('.cj-test')];
 assert.equal(testButtons.length,3);
 testButtons[0].dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(stage.dataset.mode,'free');
 assert.match(stage.style.getPropertyValue('--cj-wallpaper'),/background-nine-lives\.png/);
 stage.stopAnimation();
});

test('slot #9 appears only in the normal carousel and launches correctly',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 let selected=null;
 const lobby=createSlotsLobby(document,machine=>{selected=machine;});
 assert.equal(lobby.querySelector('.slots-featured-launch'),null);
 const cards=[...lobby.querySelectorAll('.slots-machine-card')];
 assert.equal(cards.length,9);
 const last=cards[8];
 assert.equal(last.querySelector('a').getAttribute('href'),'#game=slots&machine=catastrophe-jack');
 const next=lobby.querySelectorAll('.slots-carousel-arrow')[1];
 for(let i=0;i<6;i++)next.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(last.hidden,false);
 last.querySelector('a').dispatchEvent(new window.Event('click',{bubbles:true,cancelable:true}));
 assert.equal(selected?.id,'catastrophe-jack');
});

test('right-hand reference panel shows every exact base pay and all eight paylines',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 const columns=stage.querySelector('.cj-layout').children;
 assert.equal(columns.length,4);
 assert.equal(columns[1].className,'cj-side');
 assert.equal(columns[2].className,'cj-reference cj-poster');
 assert.equal(columns[3].className,'cj-bonus-guide cj-poster');
 const rows=[...stage.querySelectorAll('.cj-pay-row')];
 assert.equal(rows.length,9);
 const displayed=rows.map(row=>row.querySelector('.cj-pay-value').textContent);
 assert.deepEqual(displayed,['8×','6×','4×','3×','2×','1.5×','1×','8×','3×']);
 const diagrams=[...stage.querySelectorAll('.cj-line-mini')];
 assert.equal(diagrams.length,8);
 for(let i=0;i<8;i++){
  const selected=[...diagrams[i].children].flatMap((cell,p)=>cell.className==='cj-line-on'?[p]:[]);
  assert.deepEqual(selected,[...JACK_LINES[i]].sort((a,b)=>a-b));
 }
 stage.stopAnimation();
});

test('comic bonus poster illustrates the exact three game triggers',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 const poster=stage.querySelector('.cj-bonus-guide');
 assert.ok(poster);
 assert.equal(poster.querySelectorAll('.cj-bonus-card').length,3);
 const cards=[...poster.querySelectorAll('.cj-bonus-card')];
 assert.match(cards[0].textContent,/2 · 4 · 6 · 8/);
 assert.match(cards[1].textContent,/1-5-9 or 3-5-7/);
 assert.match(cards[2].textContent,/position 5/);
 const grids=cards.map(card=>card.querySelector('.cj-trigger-grid'));
 assert.deepEqual(grids.map(grid=>grid.querySelectorAll('.cj-trigger-active').length),[4,3,1]);
 assert.deepEqual([...grids[0].children].flatMap((cell,i)=>cell.className.includes('cj-trigger-active')?[i]:[]),JACK_CROSS);
 assert.match(poster.textContent,/9 FREE SPINS/);
 assert.match(poster.textContent,/PICK 3 FOLDERS/);
 assert.match(poster.textContent,/WILDS FROM DISASTER/);
 stage.stopAnimation();
});

test('insurance bonus uses nine uploaded claim folder images ON the playboard, with entry and dynamic completion splashes',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 const insuranceTest=[...stage.querySelectorAll('.cj-test')][1];
 insuranceTest.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(stage.dataset.mode,'insurance');
 const board=stage.querySelector('.cj-playfield');
 assert.ok(board.contains(stage.querySelector('.cj-insurance-play')));
 assert.equal(stage.querySelector('.cj-side .cj-folder'),null,'folders must not appear in side controls');
 const splash=stage.querySelector('.cj-splash');
 assert.equal(splash.hidden,false);
 assert.match(splash.querySelector('img').src,/catastrophe-jack-insurance-claim-start\.png$/);
 const dismiss=stage.querySelector('.cj-splash-button');
 dismiss.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(splash.hidden,true);
 const folders=[...board.querySelectorAll('.cj-insurance-grid .cj-folder')];
 assert.equal(folders.length,9);
 assert.equal(new Set(folders.map(b=>b.querySelector('img').src)).size,9);
 assert.ok(folders.every(b=>/insurance-claim\/folders\/claim-/.test(b.querySelector('img').src)));
 for(let i=0;i<3;i++)folders[i].dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(splash.hidden,false);
 assert.match(splash.querySelector('img').src,/catastrophe-jack-insurance-claim-complete\.png$/);
 assert.equal(splash.querySelector('.cj-splash-total').textContent,'3.00 CREDITS');
 dismiss.dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(stage.dataset.mode,'base');
 stage.stopAnimation();
});

test('Nine Lives test displays the uploaded entry splash before allowing free spins',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const stage=createCatastropheJack(document,{rng:()=>0});
 document.body.append(stage);
 [...stage.querySelectorAll('.cj-test')][0].dispatchEvent(new window.Event('click',{bubbles:true}));
 const splash=stage.querySelector('.cj-splash');
 assert.equal(splash.hidden,false);
 assert.match(splash.querySelector('img').src,/catastrophe-jack-nine-lives-start\.png$/);
 const spin=stage.querySelector('.cj-spin');
 assert.equal(spin.disabled,true);
 stage.querySelector('.cj-splash-button').dispatchEvent(new window.Event('click',{bubbles:true}));
 assert.equal(splash.hidden,true);
 assert.equal(spin.disabled,false);
 stage.stopAnimation();
});

test('two of any symbol including Bells and WILD pay nothing',()=>{
 const board=['BELL','FISH','BELL','CLAIM','ANVIL','CLAIM','CLAIM','ANVIL','CLAIM'];
 assert.equal(jackEvaluate(board,2).total,0);
 assert.equal(jackEvaluate(['TICKET','WILD','FISH','CLAIM','ANVIL','CLAIM','CLAIM','ANVIL','CLAIM'],1).total,0);
 assert.equal(JACK_PAY.BELL,3);
});
test('three bells pay while the four-bell diamond still triggers Nine Lives',()=>{
 const board=['BELL','BELL','BELL','BELL','BELL','BELL','FISH','BELL','FISH'];
 const result=jackEvaluate(board,1);
 assert.ok(result.lines.some(x=>x.line===1&&x.symbol==='BELL'&&x.count===3&&x.amount===3));
 assert.equal(jackFeature(board),'free');
});
test('wilds substitute for triple regular symbols but never Golden Bells',()=>{
 const board=['BELL','WILD','BELL','CLAIM','ANVIL','CLAIM','CLAIM','ANVIL','CLAIM'];
 assert.equal(jackEvaluate(board,1).total,0);
 const triple=['TICKET','WILD','TICKET','CLAIM','ANVIL','CLAIM','CLAIM','ANVIL','CLAIM'];
 const result=jackEvaluate(triple,1);
 assert.ok(result.lines.some(x=>x.line===1&&x.symbol==='TICKET'&&x.count===3&&x.amount===8));
});

test('four dedicated positions land bells with exactly 26 of 100 stops',()=>{
 assert.equal(JACK_BASE_REELS.length,9);
 for(const i of JACK_CROSS){
  assert.equal(JACK_BASE_REELS[i].length,100);
  assert.equal(JACK_BASE_REELS[i].filter(s=>s==='BELL').length,26);
 }
 assert.equal(JACK_BASE_REELS[4].length,160);
 assert.equal(JACK_BASE_REELS[4].filter(s=>s==='ANVIL').length,1);
 assert.equal(JACK_BASE_REELS[4].filter(s=>s==='BELL').length,10);
});
test('bell diamond does not require centre position 5 to match',()=>{
 const diamond=['FISH','BELL','FISH','BELL','ANVIL','BELL','FISH','BELL','FISH'];
 assert.equal(jackFeature(diamond),'free','bonus takes priority over central ANVIL');
 const missing=diamond.slice();missing[7]='FISH';
 assert.equal(jackFeature(missing),'reversal');
});

test('Nine Lives retains nine spins, escalating catastrophe multipliers, and revised prize ladder',()=>{
 assert.deepEqual(JACK_BELL_PAY,[0,.15,.4,.9,1.8,3.7,7.2,15,30,60]);
 const board=['BELL','BELL','BELL','BELL','BELL','FISH','FISH','FISH','FISH'];
 const prizes=Array.from({length:9},(_,n)=>jackBellAward(board,1,n+1));
 assert.deepEqual(prizes.map(x=>x.multiplier),[1,1,2,1,1,3,1,1,5]);
 assert.equal(prizes.reduce((sum,x)=>sum+x.amount,0),3.7*16);
 assert.deepEqual(JACK_CROSS,[1,3,5,7]);
});

test('exact theoretical RTP is 94–96%, independently enumerating all base lines and conditional feature probabilities',()=>{
 // The test is deterministic: sum the finite symbol distributions, not a noisy Monte Carlo.
 const probabilities=JACK_BASE_REELS.map(reel=>{
  const distribution=new Map();
  for(const symbol of reel)distribution.set(symbol,(distribution.get(symbol)||0)+1/reel.length);
  return [...distribution];
 });
 function expectedLine(indices){
  const [a,b,c]=indices;
  let expected=0;
  for(const [x,px] of probabilities[a])
   for(const [y,py] of probabilities[b])
    for(const [z,pz] of probabilities[c]){
     // Use the same paylines' three-position evaluation to avoid manufacturing
     // wins elsewhere; the remaining six positions use a non-paying sentinel.
     const board=Array(9).fill('NONE');
     board[a]=x;board[b]=y;board[c]=z;
     expected+=px*py*pz*jackEvaluate(board,1).total;
    }
  return expected;
 }
 const base=JACK_LINES.reduce((sum,line)=>sum+expectedLine(line),0);
 const frequency=JACK_CROSS.reduce((v,i)=>v*(probabilities[i].find(([s])=>s==='BELL')?.[1]||0),1);
 const p=(index,symbol)=>probabilities[index].find(([s])=>s===symbol)?.[1]||0;
 const insuranceOne=p(0,'CLAIM')*p(4,'CLAIM')*p(8,'CLAIM');
 const insuranceTwo=p(2,'CLAIM')*p(4,'CLAIM')*p(6,'CLAIM');
 const insuranceOverlap=p(0,'CLAIM')*p(2,'CLAIM')*p(4,'CLAIM')*p(6,'CLAIM')*p(8,'CLAIM');
 // Four-bell and insurance patterns can co-occur, in which case Nine Lives has priority.
 const insurance=(insuranceOne+insuranceTwo-insuranceOverlap)*(1-frequency);
 const insuranceAward=2*3*([.5,1,1.5,2,3,4,5,6,8].reduce((a,b)=>a+b,0)/9);
 // The centre ANVIL is suppressed by a simultaneous diamond trigger.
 const reversal=p(4,'ANVIL')*(1-frequency);
 const after=['WILD','PIZZA','BUD','CASH','WILD','FISH','DYNAMITE','PIZZA','WILD'];
 const reversalAward=jackEvaluate(after,1).total;
 const bellProbability=JACK_FREE_POOL.filter(x=>x==='BELL').length/JACK_FREE_POOL.length;
 const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return v;};
 const freeSpinEV=JACK_BELL_PAY.reduce((ev,pay,k)=>ev+pay*choose(9,k)*bellProbability**k*(1-bellProbability)**(9-k),0);
 const freeBonus=frequency*freeSpinEV*(6+2+3+5);
 const rtp=base+insurance*insuranceAward+reversal*reversalAward+freeBonus;
 assert.ok(rtp>=.94&&rtp<=.96,`RTP ${(rtp*100).toFixed(5)}% outside 94–96% range`);
 assert.ok(Math.abs(rtp-.950775279406124)<.000001,`unexpected RTP ${rtp}`);
 assert.ok(Math.abs(frequency-.26**4)<.000000000001);
 assert.equal(reversalAward,9.5);
});
