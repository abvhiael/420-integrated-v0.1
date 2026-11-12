import {CABINET_HOTSPOTS,CABINET_WIDTH,CABINET_HEIGHT,cabinetArea,assertCabinetHotspots} from '../src/emerald-cabinet-hotspots.js';
import {v2Evaluate,v2Ways,capV2Payout,UNITS,WAY_UNITS} from '../src/emerald-v2-payout.js';
import {BASE_REELS,FEATURE_REELS,visibleGrid,chooseStops,scatterReelCount,awardedFreeSpins,validateReels} from '../src/emerald-v2-strips.js';
import {practiceCreditSnapshot,practiceCreditRound,resetPracticeCredits} from '../src/practice-credits.js';
import {demoSlotBreakdown,DEMO_STAKE} from '../src/emerald-practice-paytable.js';
import {emeraldCelebration} from '../src/emerald-slots.js';
import {EMERALD_ASSETS} from '../src/emerald-slots-assets.js';
import {slotWays,slotFeatureEligible,SLOT_SYMBOLS} from '../src/emerald-slots.js';
import {plinkoMultiplierLabel,plinkoPracticeGrossPayout,plinkoSchedule,plinkoExpectedReturn,plinkoPath} from '../src/plinko-practice-paytable.js';
import {plinkoWaypoints,plinkoPosition} from '../src/plinko-board.js';
import {proposedGrossMultiplier,KENO_CANDIDATE_STATUS} from '../src/keno-candidate-paytable.js';
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {parseHTML} from 'linkedom';import {PRACTICE_GAMES,initial,next,scoreCards} from '../src/practice-engine.js';import {createPractice} from '../src/practice-ui.js';
const rand=()=>0.1;
test('eight and only eight game modes',()=>{assert.deepEqual(PRACTICE_GAMES,['dice','keno','plinko','slots','roulette','blackjack','mines','crash']);for(const id of PRACTICE_GAMES){const state=initial(id);assert.equal(state.round,0);assert.match(state.message,/no funds/i);}});
test('dice threshold bounds and 10000-outcome practice',()=>{let x=initial('dice');x=next(x,{type:'threshold',value:0},rand);assert.equal(x.threshold,5000);x=next(x,{type:'threshold',value:9000},rand);x=next(x,{type:'play'},rand);assert.equal(x.result[0],1000);assert.equal(x.round,1);});
test('Keno selects at most 10 of 80 and draws exactly 20 unique numbers',()=>{let x=initial('keno');for(let i=1;i<=12;i++)x=next(x,{type:'pick',value:i},rand);assert.equal(x.picks.length,10);x=next(x,{type:'play'},rand);assert.equal(x.result.length,20);assert.equal(new Set(x.result).size,20);assert(x.result.every(v=>v>=1&&v<=80));});
test('Plinko resolves 12 rows into one of 13 buckets',()=>{const x=next(initial('plinko'),{type:'play'},rand);assert.equal(x.result.length,12);assert(x.result.every(v=>v===0||v===1));assert(x.result.reduce((a,b)=>a+b,0)<=12);});
test('Reference Slots practice renders 5 × 4 with symbol IDs 0–6',()=>{const x=next(initial('slots'),{type:'play'},rand);assert.equal(x.result.length,20);assert(x.result.every(v=>v>=0&&v<=6));});
test('Roulette practice has 37 pockets from 0 through 36',()=>{const x=next(initial('roulette'),{type:'play'},rand);assert.equal(x.result.length,1);assert(x.result[0]>=0&&x.result[0]<=36);});
test('Blackjack hit and stand terminate without wagering',()=>{let x=next(initial('blackjack'),{type:'play'},rand);assert.equal(x.cards.length,2);if(!x.done){x=next(x,{type:'stand'},rand);assert(x.done);}assert.equal(scoreCards([0,9]),21);});
test('Mines uses 25 cells, 1–24 mines, unique simulated placement and fail-closed tile index',()=>{let x=next(initial('mines'),{type:'reset'},rand);assert.equal(x.mines.length,3);assert.equal(new Set(x.mines).size,3);x=next(x,{type:'tile',value:25},rand);assert.equal(x.open.length,0);x=next(x,{type:'mine-count',value:24},rand);x=next(x,{type:'reset'},rand);assert.equal(x.mines.length,24);});
test('Crash is auto-cashout-only and never submits a manual cashout',()=>{let x=next(initial('crash'),{type:'auto',value:3},rand);x=next(x,{type:'play'},rand);assert(x.done);assert.match(x.message,/auto target/);assert.deepEqual(next(x,{type:'cashout'},rand),x);});
test('all practice UIs render controls, re-render on simulation, and never contact wallet or network',()=>{for(const id of PRACTICE_GAMES){const {document,window}=parseHTML('<html><body></body></html>');const root=createPractice(id,document);assert.equal(root.dataset.practiceGame,id);assert(root.querySelectorAll('button').length);assert.match(root.textContent,/NO WALLET/);assert.match(root.textContent,/No funds|No funds|no funds|No funds|no funds/i);if(id==='slots'){assert(root.querySelector('.es-spin'));assert(root.querySelector('.es-reels'));continue;}const buttons=[...root.querySelectorAll('button')];if(id==='dice'||id==='plinko'||id==='slots'||id==='roulette'||id==='crash'){const play=buttons.find(b=>/Roll practice|Drop \d+ ball|Spin practice|Simulate auto/i.test(b.textContent));assert(play);play.dispatchEvent(new window.Event('click'));assert(root.querySelector('.practice-message'));}}});
test('source never invokes external authority, wallet or transaction API',()=>{for(const file of ['../src/practice-engine.js','../src/practice-ui.js']){const source=readFileSync(new URL(file,import.meta.url),'utf8');for(const banned of [/eth_requestAccounts/,/sendTransaction/,/writeContract/,/fetch\(/,/WebSocket/,/window\.ethereum/,/localStorage/,/sessionStorage/])assert.doesNotMatch(source,banned);}});

test('neon dice page preserves functional practice controls and history without wallet access',()=>{const {document,window}=parseHTML('<html><body></body></html>');const root=createPractice('dice',document);assert(root.classList.contains('neon-dice-page'));assert(root.querySelector('.nd-dice-art'));assert.equal(root.querySelectorAll('.nd-choice').length,2);const roll=root.querySelector('.nd-roll');assert(roll);roll.dispatchEvent(new window.Event('click'));assert.match(root.querySelector('.nd-big-number').textContent,/^[0-9]{4}$/);assert.equal(root.querySelectorAll('.nd-pill').length,1);assert.equal(root.querySelectorAll('iframe').length,0);assert.match(root.textContent,/No wallet connection/i);});

test('Lucky Strays Keno renders approved cabinet layout and uploaded artwork without duplicate Jack',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('keno',document);
 assert(root.classList.contains('ls-keno'));
 assert.equal(root.querySelectorAll('.ls-number').length,80);
 assert.equal(root.querySelectorAll('.ls-ball.empty').length,20);
 assert(root.querySelector('.ls-logo').getAttribute('src').includes('/catastrophe-jack/logo.png'));
 assert(root.querySelector('.ls-machine').getAttribute('src').includes('/catastrophe-jack/machine/'));
 assert.equal(root.querySelectorAll('.ls-jack-character').length,0);
 assert.equal(root.querySelectorAll('.ls-life-icon').length,9);
 assert.match(root.textContent,/NO WALLET/);
 assert.match(root.textContent,/No funds/);
});
test('Lucky Strays Keno quick pick, clear, draw, virtual credit and meter UI are functional',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('keno',document);
 const first=root.querySelector('.ls-number');
 first.dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.ls-number.picked').length,1);
 [...root.querySelectorAll('button')].find(x=>x.textContent.includes('LUCKY CLAWS')).dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.ls-number.picked').length,10);
 assert.equal(root.querySelector('.ls-draw').disabled,false);
 root.querySelector('.ls-draw').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.ls-ball').length,20);
 assert.equal(root.querySelectorAll('.ls-ball.empty').length,0);
 assert.match(root.querySelector('.ls-recent').textContent,/RECENT:/);
 assert.match(root.querySelector('.ls-win').textContent,/VIRTUAL/);
 assert.equal(root.querySelectorAll('.ls-life-icon').length,9);
 [...root.querySelectorAll('button')].find(x=>x.textContent.includes('CLEAR')).dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.ls-number.picked').length,0);
});
test('Keno INFO button reveals complete ten-spot paytable, rules and bonus mechanics',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('keno',document);
 assert.equal(root.querySelector('.ls-info-dialog'),null);
 root.querySelector('.ls-info-button').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.ls-paytable tr').length,12);
 assert.match(root.querySelector('.ls-info-dialog').textContent,/next draw with a paying result/i);
 assert.match(root.querySelector('.ls-info-dialog').textContent,/NOT APPROVED FOR WAGERING/i);
 assert.equal(root.querySelector('.ls-pick-select').getAttribute('aria-label'),'Number of Keno spots');
 root.querySelector('.ls-info-close').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.ls-info-dialog'),null);
});
test('Keno unapproved canonical paytable stays separate from Jack practice schedule',()=>{
 assert.equal(proposedGrossMultiplier(1,1),'3.6');
 assert.equal(proposedGrossMultiplier(5,3),'3');
 assert.equal(proposedGrossMultiplier(5,4),'25');
 assert.equal(proposedGrossMultiplier(5,5),'550');
 assert.equal(proposedGrossMultiplier(10,10),'20000');
 assert.equal(proposedGrossMultiplier(10,0),'0');
 assert.match(KENO_CANDIDATE_STATUS,/NOT APPROVED/);
});

test('Lucky Strays highlights selected drawn matches and preserves all twenty results',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const page=createPractice('keno',document);
 const quick=[...page.querySelectorAll('button')].find(x=>x.textContent.includes('LUCKY CLAWS'));
 quick.dispatchEvent(new window.Event('click'));
 let found=false;
 for(let i=0;i<25;i++){
  page.querySelector('.ls-draw').dispatchEvent(new window.Event('click'));
  if(page.querySelector('.ls-ball.matched')){
   assert(page.querySelector('.ls-number.hit'));
   assert(page.querySelector('.ls-number.hit .ls-hit-paw'));
   assert.equal(page.querySelectorAll('.ls-ball').length,20);
   found=true;break;
  }
 }
 assert(found);
});

test('Plinko uses approved Dice wallpaper path without affecting transaction-free simulation',()=>{const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert(css.includes('420Bet_Dice_Wallpaper_FRESH_2026-11-01.webp'));const js=readFileSync(new URL('../src/plinko-board.js',import.meta.url),'utf8');assert.doesNotMatch(js,/eth_sendTransaction|eth_requestAccounts|fetch\(/);});

test('Emerald Slots practice cabinet renders 5×4 reels, 1024-ways header and no wager flow',()=>{const {document}=parseHTML('<html><body></body></html>');const root=createPractice('slots',document);assert.equal(root.querySelectorAll('.es-symbol').length,20);assert.match(root.textContent,/1024 WAYS TO WIN/);assert.match(root.textContent,/DEMO STAKE10/);assert(root.querySelector('.es-spin'));assert.equal(SLOT_SYMBOLS.length,7);});
test('Emerald Slots ways evaluation uses consecutive reels and wild substitution',()=>{const board=Array(20).fill(6);board[0]=0;board[1]=5;board[2]=0;const ways=slotWays(board);assert(ways.some(w=>w.symbol===0&&w.reels===3&&w.ways===1));assert.equal(slotWays(Array(20).fill(6)).length,0);assert.equal(slotFeatureEligible(Array(20).fill(6)),true);});
test('Emerald Slots reduced-motion spin completes without enabling awards',()=>{const {document,window}=parseHTML('<html><body></body></html>');window.matchMedia=()=>({matches:true});const root=createPractice('slots',document);root.querySelector('.es-spin').dispatchEvent(new window.Event('click'));assert.equal(root.querySelectorAll('.es-symbol').length,20);assert.match(root.textContent,/PRACTICE CREDITS/);assert.match(root.textContent,/PRACTICE ONLY/);});

test('Emerald Slots uses canonical uploaded artwork with a real transparent button above cabinet',()=>{const {document,window}=parseHTML('<html><body></body></html>');window.matchMedia=()=>({matches:true});const root=createPractice('slots',document);assert.equal(root.querySelector('.es-cabinet-art').getAttribute('src'),EMERALD_ASSETS.cabinet);assert.equal(root.querySelector('.es-art-stage .es-spin').tagName,'BUTTON');assert.equal(EMERALD_ASSETS.symbols.length,7);assert.match(EMERALD_ASSETS.wallpaper,/assets\/420bet\/backgrounds/);root.querySelector('.es-spin').dispatchEvent(new window.Event('click'));assert.equal(root.querySelectorAll('.es-symbol-image').length,20);for(const el of root.querySelectorAll('.es-symbol-image'))assert(EMERALD_ASSETS.symbols.includes(el.getAttribute('src')));assert.equal(root.querySelector('.es-spin').disabled,false);});
test('Emerald winning highlights are positioned on evaluated ways and CSS-animated',()=>{const board=Array(20).fill(6);board[0]=0;board[1]=5;board[2]=0;const matches=slotWays(board);assert.deepEqual(matches[0].positions,[0,1,2]);const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert.match(css,/\.es-win-spark\{/);assert.match(css,/@keyframes es-spark/);assert.match(css,/\.es-art-stage \.es-spin\{/);});

test('Emerald celebration prioritizes scatter feature and gates visual BIG WIN on qualifying ways',()=>{assert.equal(emeraldCelebration([],false),null);assert.equal(emeraldCelebration([{reels:5,ways:4}],false),'bigWin');assert.equal(emeraldCelebration([{reels:5,ways:3}],false),null);assert.equal(emeraldCelebration([{reels:5,ways:9}],true),'freeSpins');});
test('Emerald overlay sources, CSS keyframes and no-wallet practice remain explicit',()=>{const source=readFileSync(new URL('../src/emerald-slots.js',import.meta.url),'utf8'),css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');assert(source.includes('EMERALD_ASSETS.bigWin'));assert(source.includes('EMERALD_ASSETS.freeSpins'));assert(css.includes('@keyframes es-celebration-enter'));assert(css.includes('@keyframes es-celebration-glow'));assert(source.includes('no payout'));assert(source.includes('clearOverlay()'));});

test('Wallet-free practice ledger credits and debits with no external settlement',()=>{resetPracticeCredits();assert.equal(practiceCreditSnapshot().balance,1000);practiceCreditRound({stake:10,payout:26});assert.equal(practiceCreditSnapshot().balance,1016);assert.deepEqual(practiceCreditSnapshot().history.at(-1),{game:'slots',stake:10,payout:26,net:16,balance:1016});assert.throws(()=>practiceCreditRound({stake:999999,payout:0}));resetPracticeCredits();});
test('Ways payouts explain regular symbols, scatter reels and feature 2x separately',()=>{const board=Array(20).fill(6);board[0]=0;board[1]=5;board[2]=0;const w=slotWays(board);const x=demoSlotBreakdown(board,w);assert.equal(x.lines[0].ways,1);assert(x.lines[0].credits>=0);assert.equal(x.scatterReels,5);assert(x.payout>=0);assert.equal(demoSlotBreakdown(board,w,{freeSpin:true}).payout,54);assert.equal(DEMO_STAKE,10);});
test('Practice credits never invoke wallets, payments or persistent storage',()=>{const src=readFileSync(new URL('../src/practice-credits.js',import.meta.url),'utf8');for(const term of ['localStorage','sessionStorage','fetch(','ethereum','WebSocket','writeContract'])assert(!src.includes(term));});

test('V2 uses five nonidentical 42-position circular strips and exactly one base Scatter each',()=>{assert.equal(validateReels(),true);assert.equal(BASE_REELS.length,5);assert.equal(new Set(BASE_REELS.map(x=>x.join(','))).size,5);for(let i=0;i<5;i++){assert.equal(BASE_REELS[i].length,42);assert.equal(BASE_REELS[i].filter(x=>x===6).length,1);assert.equal(BASE_REELS[i].filter(x=>x===5).length,2);assert.equal(FEATURE_REELS[i].filter(x=>x===6).length,0);assert.equal(FEATURE_REELS[i].filter(x=>x===5).length,3);}});
test('Every stop yields four consecutive cells per reel and never two visible special symbols',()=>{for(let reel=0;reel<5;reel++)for(let stop=0;stop<42;stop++){for(const strips of [BASE_REELS,FEATURE_REELS]){const g=visibleGrid(strips,[stop,stop,stop,stop,stop]);const symbols=[0,1,2,3].map(row=>g[row*5+reel]);assert.deepEqual(symbols,[0,1,2,3].map(d=>strips[reel][(stop+d)%42]));assert(symbols.filter(v=>v===5||v===6).length<=1);}}});
test('Distinct Scatter reels award 6/15/25 feature spins, bonus screens contain none',()=>{const stops=BASE_REELS.map(r=>r.indexOf(6));const all=visibleGrid(BASE_REELS,stops);assert.equal(scatterReelCount(all),5);assert.equal(awardedFreeSpins(all),25);for(const n of [3,4]){const x=visibleGrid(BASE_REELS,stops.map((v,i)=>i<n?v:(v+5)%42));assert.equal(scatterReelCount(x),n);assert.equal(awardedFreeSpins(x),n===3?6:15);}const bonus=visibleGrid(FEATURE_REELS,stops);assert.equal(scatterReelCount(bonus),0);assert.equal(awardedFreeSpins(bonus),0);});
test('Five independent stops are selected, not twenty random symbols',()=>{assert.deepEqual(chooseStops(()=>0),[0,0,0,0,0]);assert.equal(visibleGrid(BASE_REELS,[41,41,41,41,41]).length,20);});

test('V2 has separate 3/4/5 awards and exact 4.20x integer credit units',()=>{assert.equal(WAY_UNITS.length,5);for(const rates of WAY_UNITS){assert.equal(rates.length,3);assert(rates[0]<rates[1]&&rates[1]<rates[2]);}const board=Array(20).fill(6);board[0]=0;board[1]=0;board[2]=0;const base=v2Evaluate(board,1);assert.equal(base.lines[0].reels,3);assert.equal(base.lines[0].units,WAY_UNITS[0][0]);const featureBoard=Array(20).fill(1);const x=v2Evaluate(featureBoard,1,{feature:true});const y=v2Evaluate(featureBoard,1);assert.equal(x.grossUnits,y.grossUnits*42/10);assert(Number.isSafeInteger(x.grossUnits));});
test('V2 stake scaling 1 to 50 is exact, cap applies across full wager',()=>{const b=Array(20).fill(0);const one=v2Evaluate(b,1).grossUnits,ten=v2Evaluate(b,10).grossUnits,fifty=v2Evaluate(b,50).grossUnits;assert.equal(ten,one*10);assert.equal(fifty,one*50);assert.equal(capV2Payout(9999*UNITS,50,100),5000*UNITS);});
test('V2 all-Wild combination is paid only once at premium eligible tier',()=>{const b=Array(20).fill(6);for(let r=0;r<5;r++)b[r]=5;const x=v2Evaluate(b,10);assert.equal(x.lines.length,1);assert.equal(x.lines[0].symbol,4);assert.equal(x.lines[0].reels,5);assert.equal(x.lines[0].ways,1);});

test('Emerald clean symbol paytable is exact and linked to INFO menu',()=>{
 assert.deepEqual(WAY_UNITS,[[50000,200000,600000],[100000,300000,1000000],[100000,300000,1000000],[200000,600000,2500000],[300000,1000000,3500000]]);
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);
 const info=root.querySelector('[data-hotspot="info"]');
 assert(info);
 info.dispatchEvent(new window.Event('click'));
 const table=root.querySelector('.es-paytable');
 assert(table);
 assert.equal(table.querySelectorAll('tr').length,6);
 assert.match(table.textContent,/0.05/);
 assert.match(table.textContent,/3.50/);
 assert.match(root.querySelector('.es-console-panel').textContent,/250×/);
});
test('Emerald console bet stepper changes stake within 1–50 and locks during feature',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);
 const click=label=>{const names={'+':'increase','−':'decrease','MENU':'menu'};const btn=root.querySelector('[data-hotspot="'+names[label]+'"]');assert(btn,label);btn.dispatchEvent(new window.Event('click'));};
 assert.equal(root.querySelector('.es-bet-display strong').textContent,'10');
 click('+');assert.equal(root.querySelector('.es-bet-display strong').textContent,'11');
 click('−');assert.equal(root.querySelector('.es-bet-display strong').textContent,'10');
 for(let i=0;i<55;i++)click('+');
 assert.equal(root.querySelector('.es-bet-display strong').textContent,'50');
 assert.equal(root.querySelector('[data-hotspot="increase"]').disabled,true);
 for(let i=0;i<55;i++)click('−');
 assert.equal(root.querySelector('.es-bet-display strong').textContent,'1');
 assert.equal(root.querySelector('[data-hotspot="decrease"]').disabled,true);
 click('MENU');assert.match(root.querySelector('.es-console-panel').textContent,/AUTO PLAY/);
});
test('Emerald turbo toggle changes only presentation speed, not the reel math',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);const original=WAY_UNITS.map(x=>[...x]);
 const turbo=root.querySelector('[data-hotspot="turbo"]');
 assert(turbo);
 turbo.dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.es-turbo-toggle').getAttribute('aria-label'),/ON/);
 assert.deepEqual(WAY_UNITS,original);
 root.querySelector('.es-turbo-toggle').dispatchEvent(new window.Event('click'));
 assert.doesNotMatch(root.querySelector('.es-turbo-toggle').getAttribute('aria-label'),/ON/);
});
test('Emerald AUTO PLAY can be cancelled, and does not access wallets',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:false});
 const callbacks=[];
 window.setTimeout=(cb)=>{callbacks.push(cb);return callbacks.length};
 window.clearTimeout=()=>{};
 const root=createPractice('slots',document);
 const auto=root.querySelector('.es-auto-toggle');
 assert.match(auto.getAttribute('aria-label'),/AUTO PLAY/);
 auto.dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.es-auto-toggle').getAttribute('aria-label'),/AUTO ON/);
 assert(root.querySelector('.es-bet-up').disabled);
 root.querySelector('.es-auto-toggle').dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.es-auto-toggle').getAttribute('aria-label'),/AUTO PLAY/);
 assert.equal(root.querySelector('.es-bet-up').disabled,true); // reel still spinning, though auto is off
 root.stopAnimation();
});

test('Emerald canonical image hotspots map precisely within 1448×1086, without overlap',()=>{
 assert.equal(CABINET_WIDTH,1448);assert.equal(CABINET_HEIGHT,1086);
 assert.equal(assertCabinetHotspots(),true);
 assert.deepEqual(Object.keys(CABINET_HOTSPOTS),['info','menu','decrease','increase','spin','autoplay','turbo','betPerWay','totalBet','win','balance']);
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);
 for(const name of Object.keys(CABINET_HOTSPOTS)){
  const el=root.querySelector('[data-hotspot="'+name+'"]');
  assert(el,'missing mapped hotspot '+name);
  const expected=cabinetArea(name);
  assert.equal(el.style.left,expected.left);
  assert.equal(el.style.top,expected.top);
  assert.equal(el.style.width,expected.width);
  assert.equal(el.style.height,expected.height);
 }
 for(const name of ['info','menu','decrease','increase','spin','autoplay','turbo']){
  assert.equal(root.querySelector('[data-hotspot="'+name+'"]').tagName,'BUTTON');
  assert(root.querySelector('[data-hotspot="'+name+'"]').getAttribute('aria-label'));
 }
 assert.match(root.querySelector('[data-hotspot="betPerWay"]').textContent,/0\.009766/);
 assert.equal(root.querySelector('[data-hotspot="balance"]').textContent,'1000');
 const css=readFileSync(new URL('../src/style.css',import.meta.url),'utf8');
 assert.match(css,/aspect-ratio:1448\/1086/);
 assert.match(css,/\.es-art-stage \.es-cabinet-hotspot/);
});

test('Emerald INFO opens a gameplay and bonus dialog with paytable, and closes without changing reels',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);
 const before=root.querySelectorAll('.es-symbol').length;
 root.querySelector('[data-hotspot="info"]').dispatchEvent(new window.Event('click'));
 const dialog=root.querySelector('[role="dialog"]');
 assert(dialog);
 assert.equal(dialog.getAttribute('aria-modal'),'true');
 assert.match(dialog.textContent,/HOW TO PLAY/);
 assert.match(dialog.textContent,/BONUSES & SPECIAL SYMBOLS/);
 assert.match(dialog.textContent,/WILD/);
 assert.match(dialog.textContent,/SCATTER/);
 assert.match(dialog.textContent,/4\.20×/);
 assert.match(dialog.textContent,/PAYTABLE/);
 assert.equal(dialog.querySelectorAll('.es-paytable tr').length,6);
 assert.equal(root.querySelectorAll('.es-symbol').length,before);
 dialog.querySelector('.es-info-close').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('[role="dialog"]'),null);
 assert.equal(root.querySelectorAll('.es-symbol').length,before);
});

test('Emerald cabinet screenshot calibration keeps INFO over painted icon and readouts below captions',()=>{
 assert.deepEqual(CABINET_HOTSPOTS.info,[53,927,65,65]);
 assert.deepEqual(CABINET_HOTSPOTS.betPerWay,[271,979,74,29]);
 for(const name of ['betPerWay','totalBet','win','balance']){
  assert(CABINET_HOTSPOTS[name][1]>=976,'readout must be lower on cabinet: '+name);
 }
 assert(CABINET_HOTSPOTS.betPerWay[0]+CABINET_HOTSPOTS.betPerWay[2] <= CABINET_HOTSPOTS.increase[0]);
 assert.equal(assertCabinetHotspots(),true);
 const {document,window}=parseHTML('<html><body></body></html>');
 const root=createPractice('slots',document);
 root.querySelector('[data-hotspot="info"]').dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('[role="dialog"]').textContent,/HOW TO PLAY/);
 assert(root.querySelector('.es-paytable'));
});

test('Pete Plinko supports 8–17 landing buckets, selectable risk and multi-ball',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 window.matchMedia=()=>({matches:true});
 const root=createPractice('plinko',document);
 assert.match(root.textContent,/PRICKLY PETE/);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 const selects=[...root.querySelectorAll('.pete-plinko-controls select')];
 assert.equal(selects.length,3);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 assert.equal(root.querySelectorAll('.plinko-peg').length,136);
 root.querySelectorAll('.pete-risk-button')[2].dispatchEvent(new window.Event('click'));
 root.querySelectorAll('.pete-ball-button')[3].dispatchEvent(new window.Event('click'));
 assert.match(root.querySelector('.plinko-drop').textContent,/25 BALLS/);
 root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
 assert.match(root.textContent,/25 simulated balls landed/);
 assert.match(root.textContent,/Total practice balls25/);
 assert.equal(root.querySelectorAll('.plinko-bucket').length,17);
 assert.match(root.textContent,/NOT approved for live settlement/);
 assert.equal(plinkoPracticeGrossPayout(16,17,'riot'),0);
});
test('Pete Plinko practice schedules are symmetric, risk-sensitive, and near 96% across bucket counts',()=>{
 for(let buckets=8;buckets<=17;buckets++){
  const low=plinkoSchedule(buckets,'soundcheck'),medium=plinkoSchedule(buckets,'showtime'),high=plinkoSchedule(buckets,'riot');
  for(const schedule of [low,medium,high]){
   assert.equal(schedule.length,buckets);
   for(let i=0;i<buckets;i++)assert.equal(schedule[i],schedule[buckets-i-1]);
  }
  assert(high[0]>medium[0]&&medium[0]>low[0]);
  const c=Math.floor((buckets-1)/2);
  assert(high[c]<medium[c]&&medium[c]<low[c]);
  for(const risk of ['soundcheck','showtime','riot'])assert(Math.abs(plinkoExpectedReturn(buckets,risk)-.96)<0.0001);
 }
 assert.equal(plinkoPath(17,()=>0).length,16);
 assert.throws(()=>plinkoPath(18));
 assert.equal(plinkoWaypoints(Array(16).fill(1)).length,18);
 assert.equal(plinkoPosition(plinkoWaypoints(Array(12).fill(0)),1).y,638);
});
test('Pete Plinko prevents overlapping batches, offers cancellation and preserves zero payouts',()=>{
 const {document,window}=parseHTML('<html><body></body></html>');
 const frames=[];window.requestAnimationFrame=cb=>{frames.push(cb);return frames.length;};
 window.cancelAnimationFrame=()=>{};
 const root=createPractice('plinko',document);document.body.append(root);
 root.querySelector('.plinko-drop').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelectorAll('.plinko-bucket.landed').length,0);
 frames.shift()(100);
 root.querySelector('.pete-plinko-stop').dispatchEvent(new window.Event('click'));
 assert.equal(root.querySelector('.plinko-drop').disabled,false);
 assert(root.querySelectorAll('.plinko-bucket.landed').length>=1);
 root.stopAnimation();
});
