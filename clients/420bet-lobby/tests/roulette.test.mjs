import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {readFileSync} from 'node:fs';
import {ROULETTE_WHEEL,ROULETTE_CHIPS,STARTING_CREDITS,rouletteBetKeys,rouletteBetWins,rouletteColor,rouletteProfitOdds,rouletteSettle,rouletteRandomPocket,rouletteInsideKey} from '../src/roulette-model.js';
import {createCannabisRoulette} from '../src/roulette-ui.js';

test('American wheel contains exactly 38 unique pockets, 18 red, 18 black and two green',()=>{
 assert.equal(ROULETTE_WHEEL.length,38);
 assert.equal(new Set(ROULETTE_WHEEL).size,38);
 for(const [color,count] of [['red',18],['black',18],['green',2]])assert.equal(ROULETTE_WHEEL.filter(p=>rouletteColor(p)===color).length,count);
 assert(ROULETTE_WHEEL.includes('0'));assert(ROULETTE_WHEEL.includes('00'));
 assert.deepEqual(ROULETTE_CHIPS,[1,5,10,25,100,500]);
});
test('All straight, column, dozen and even-money bet definitions pay the correct outcomes',()=>{
 assert.equal(rouletteBetKeys().length,160);
 for(const key of rouletteBetKeys()){
  const winning=ROULETTE_WHEEL.filter(p=>rouletteBetWins(key,p));
  if(key.startsWith('straight:')){assert.equal(winning.length,1);assert.equal(rouletteProfitOdds(key),35);}
  else if(key.startsWith('column:')||key.startsWith('dozen:')){assert.equal(winning.length,12);assert.equal(rouletteProfitOdds(key),2);}
  else{assert.equal(winning.length,18);assert.equal(rouletteProfitOdds(key),1);}
 }
 assert.equal(rouletteBetWins('red','0'),false);
 assert.equal(rouletteBetWins('black','00'),false);
 assert.equal(rouletteBetWins('straight:00','00'),true);
});
test('Credits are settled with return of stake, and zero/double zero lose even bets',()=>{
 assert.deepEqual(rouletteSettle([{key:'straight:17',amount:10}], '17',1000),{
  pocket:'17',color:'black',stake:10,returned:360,net:350,balance:1350,winningKeys:['straight:17']
 });
 assert.equal(rouletteSettle([{key:'even',amount:25},{key:'red',amount:5}], '00',1000).balance,970);
 assert.equal(rouletteSettle([{key:'dozen:2',amount:10}], '17',1000).balance,1020);
 assert.throws(()=>rouletteSettle([{key:'red',amount:500}], '1',100));
 assert.throws(()=>rouletteSettle([{key:'straight:99',amount:10}], '1',100));
 assert.equal(rouletteRandomPocket(()=>0),'0');assert.equal(rouletteRandomPocket(()=>.99999),'2');
});
test('Roulette screen places chips, animates a fixed result, settles only on finish, repeats and clears',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 let scheduled=null,cleared=false;
 const root=createCannabisRoulette(document,{
  pickPocket:()=> '17',
  setTimeout:(fn,ms)=>{assert.equal(ms,4000);scheduled=fn;return 1;},
  clearTimeout:()=>{cleared=true;}
 });
 document.body.append(root);
 assert.equal(root.dataset.practiceGame,'roulette');
 assert.equal(root.querySelectorAll('.cr-wheel-number').length,38);
 assert.equal(root.querySelectorAll('[data-bet^="straight:"]').length,38);
 assert.equal(root.querySelectorAll('.cr-chip').length,6);
 root.querySelector('[data-bet="straight:17"]').click();
 assert.equal(root.querySelector('.cr-current-bet strong').textContent,'10');
 root.querySelector('.cr-spin').click();
 assert(root.querySelector('.cr-wheel-spinning'));
 assert.match(root.querySelector('.cr-wheel-disc').style.getPropertyValue('--cr-spin-to'),/deg$/);
 assert.equal(root.querySelector('.cr-credits strong').textContent,'9,990');
 scheduled();
 assert.equal(root.querySelector('.cr-credits strong').textContent,'10,350');
 assert.equal(root.querySelector('.cr-result-pocket').textContent,'17');
 root.querySelector('.cr-action').click();
 assert.equal(root.querySelector('.cr-current-bet strong').textContent,'10');
 const buttons=Array.from(root.querySelectorAll('.cr-action'));
 buttons.find(b=>b.textContent.includes('Clear')).click();
 assert.equal(root.querySelector('.cr-current-bet strong').textContent,'0');
 root.stopAnimation();assert.equal(cleared,false);
});
test('Route and dedicated roulette style are imported without changing slots paths',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/roulette.css',import.meta.url),'utf8');
 assert(main.includes("active.id==='roulette'?createCannabisRoulette(document)"));
 assert(main.includes("import './roulette.css'"));
 assert(main.includes("selectedSlotMachine.id==='mary-jane-sticky-wilds'"));
 assert(css.includes('.cr-wheel-spinning'));
 assert(css.includes('.cr-table-area'));
});

test('all inside placements follow casino intersection rules with correct odds and coverage',()=>{
 const fixtures=[
  ['split',[1,2],17,2],
  ['split',[1,4],17,2],
  ['street',[1,2,3],11,3],
  ['corner',[1,2,4,5],8,4],
  ['sixline',[1,2,3,4,5,6],5,6],
  ['trio',['0',1,2],11,3],
  ['basket',['0','00',1,2,3],6,5]
 ];
 for(const [kind,numbers,odds,coverage] of fixtures){
  const key=rouletteInsideKey(kind,numbers);
  assert(rouletteBetKeys().includes(key),key);
  assert.equal(rouletteProfitOdds(key),odds);
  assert.equal(ROULETTE_WHEEL.filter(n=>rouletteBetWins(key,n)).length,coverage);
  assert.equal(rouletteSettle([{key,amount:10}],String(numbers[0]),100).returned,10*(odds+1));
 }
 const corner=rouletteInsideKey('corner',[1,2,4,5]);
 assert.equal(corner,'corner:1,2,4,5');
 assert(!rouletteBetWins(corner,'3'));
 assert.equal(rouletteBetWins(corner,'5'),true);
 assert.throws(()=>rouletteSettle([{key:'corner:1,2,4,6',amount:10}],'1',100));
});
test('clicking four-number junction places one corner bet, can repeat, and pays 8:1',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 let finish;
 const root=createCannabisRoulette(document,{pickPocket:()=> '5',setTimeout:fn=>{finish=fn;return 10;}});
 document.body.append(root);
 assert.equal(root.querySelectorAll('.cr-spot-corner').length,22);
 assert.equal(root.querySelectorAll('.cr-spot-street').length,12);
 assert.equal(root.querySelectorAll('.cr-spot-sixline').length,11);
 assert.equal(root.querySelectorAll('.cr-zero-special').length,8);
 const corner=root.querySelector('[data-bet="corner:1,2,4,5"]');
 assert(corner,'expected playable intersection at 1/2/4/5');
 assert.equal(corner.style.left,(100/12)+'%');
 assert.equal(corner.style.top,(200/3)+'%');
 corner.click();
 assert.equal(root.querySelector('.cr-current-bet strong').textContent,'10');
 root.querySelector('.cr-spin').click();
 finish();
 assert.equal(root.querySelector('.cr-credits strong').textContent,'10,080');
 const winning=root.querySelector('[data-bet="corner:1,2,4,5"]');
 assert(winning.classList.contains('cr-winner'));
 root.stopAnimation();
});
