import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseHTML} from 'linkedom';
import {createRoyalKush,royalKushAction,evaluateRoyalKush,RK_PAY,shuffledDeck} from '../src/royal-kush-engine.js';
import {createRoyalKushTable} from '../src/royal-kush-ui.js';
import {blackjackCardArt} from '../src/blackjack-card-art.js';
const cards=(ranks,suit='♠')=>ranks.map(rank=>({rank:String(rank),suit}));
test('Royal Kush nine pay rows reproduce the approved 1–5 credit schedule',()=>{
 assert.deepEqual(RK_PAY.map(x=>x.unit),[800,50,25,9,6,4,3,2,1]);
 assert.equal(RK_PAY[0].unit*5,4000);
 assert.equal(RK_PAY[3].unit*5,45);
});
test('Royal Kush categorizes all nine payouts with wheel, low ace, and kickers',()=>{
 const cases=[
  ['royal',[{rank:'10',suit:'♥'},{rank:'J',suit:'♥'},{rank:'Q',suit:'♥'},{rank:'K',suit:'♥'},{rank:'A',suit:'♥'}]],
  ['straight-flush',cards(['5','6','7','8','9'])],
  ['quads',[...cards(['A','A','A'],'♠').map((c,i)=>({...c,suit:['♠','♥','♦'][i]})),{rank:'A',suit:'♣'},{rank:'2',suit:'♥'}]],
  ['full-house',[{rank:'K',suit:'♠'},{rank:'K',suit:'♥'},{rank:'K',suit:'♦'},{rank:'2',suit:'♠'},{rank:'2',suit:'♦'}]],
  ['flush',cards(['2','6','8','Q','A'],'♣')],
  ['straight',[{rank:'A',suit:'♠'},{rank:'2',suit:'♥'},{rank:'3',suit:'♣'},{rank:'4',suit:'♦'},{rank:'5',suit:'♠'}]],
  ['trips',[{rank:'9',suit:'♠'},{rank:'9',suit:'♥'},{rank:'9',suit:'♦'},{rank:'K',suit:'♣'},{rank:'2',suit:'♠'}]],
  ['two-pair',[{rank:'J',suit:'♠'},{rank:'J',suit:'♥'},{rank:'8',suit:'♠'},{rank:'8',suit:'♥'},{rank:'2',suit:'♣'}]],
  ['jacks',[{rank:'Q',suit:'♠'},{rank:'Q',suit:'♥'},{rank:'8',suit:'♠'},{rank:'5',suit:'♥'},{rank:'2',suit:'♣'}]]
 ];
 for(const [expected,hand] of cases)assert.equal(evaluateRoyalKush(hand).key,expected,expected);
 assert.equal(evaluateRoyalKush([{rank:'10',suit:'♠'},{rank:'10',suit:'♥'},{rank:'4',suit:'♣'},{rank:'6',suit:'♦'},{rank:'A',suit:'♠'}]).unit,0);
 assert.throws(()=>evaluateRoyalKush(cards(['A','A','A','A','A'])),RangeError);
});
test('Shuffled poker deck has exactly 52 unique cards',()=>{
 const shuffled=shuffledDeck(()=>0);
 assert.equal(shuffled.length,52);
 assert.equal(new Set(shuffled.map(c=>c.rank+c.suit)).size,52);
});
test('Hold/Draw replaces only unheld cards and pays once',()=>{
 const s=createRoyalKush({credits:100,bet:5,rng:()=>0});
 assert(royalKushAction(s,'deal'));assert.equal(s.credits,95);assert.equal(s.hand.length,5);
 const before=s.hand.map(c=>c.rank+c.suit);
 assert(royalKushAction(s,'hold',0));assert(royalKushAction(s,'hold',2));
 assert.equal(royalKushAction(s,'bet',1),false);
 assert(royalKushAction(s,'draw'));assert.equal(s.phase,'finished');
 assert.equal(s.hand[0].rank+s.hand[0].suit,before[0]);
 assert.equal(s.hand[2].rank+s.hand[2].suit,before[2]);
 assert.equal(royalKushAction(s,'draw'),false);
 assert.equal(s.credits,95+s.win);
 assert(royalKushAction(s,'bet-max'));assert.equal(s.bet,5);
});
test('Royal Kush uses blackjack artwork and dedicated lobby route',()=>{
 const {document}=parseHTML('<html><body></body></html>');
 const root=createRoyalKushTable(document,{credits:100,bet:5,rng:()=>0});
 assert.equal(root.dataset.practiceGame,'video-poker');
 assert.equal(root.querySelectorAll('.rk-card').length,5);
 assert.equal(root.querySelectorAll('.rk-pay-row').length,9);
 assert.equal(root.querySelectorAll('.rk-pay-value').length,45);
 const image=root.querySelector('.rk-card-art');
 assert.equal(image.getAttribute('src'),blackjackCardArt({rank:'K',suit:'♠'}));
 assert.match(root.textContent,/ROYAL FLUSH/);
 assert.match(root.textContent,/PRACTICE ONLY/);
 const deal=root.querySelector('.rk-deal');deal.click();
 assert.equal(root.gameState.phase,'draw');
 root.querySelector('.rk-card').click();
 assert(root.gameState.held[0]);
 assert(root.querySelector('.rk-held'));
 deal.click();assert.equal(root.gameState.phase,'finished');
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 assert(main.includes("active.id==='video-poker'"));
 assert(main.includes("createRoyalKushTable(document)"));
 const css=readFileSync(new URL('../src/royal-kush.css',import.meta.url),'utf8');
 assert(css.includes('royal-kush-wallpaper.svg'));
 const svg=readFileSync(new URL('../public/assets/420bet/royal-kush/royal-kush-wallpaper.svg',import.meta.url),'utf8');
 assert(svg.includes('<svg'));
});

test('Royal Kush compact full-width wallpaper extends through its header without affecting other games',()=>{
 const main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 const css=readFileSync(new URL('../src/royal-kush.css',import.meta.url),'utf8');
 assert(main.includes("active.id==='video-poker'?'immersive royal-kush-immersive'"));
 assert(css.includes('.royal-kush-immersive .gamebar'));
 assert(css.includes('.royal-kush-immersive .view-scroll'));
 assert(css.includes('.royal-kush-immersive .rk-shell'));
 assert(css.includes("royal-kush-wallpaper.webp"));
 assert(css.includes('.royal-kush-immersive .rk-card-board'));
 assert(css.includes('@media(min-width:951px) and (max-height:850px)'));
 assert(css.includes('.royal-kush-immersive .rk-title-stack'));
});
