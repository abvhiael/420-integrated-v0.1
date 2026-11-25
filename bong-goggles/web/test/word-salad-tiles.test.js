import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SPECS} from '../core/word-salad-rules.js';
import {HYBRID_SYMBOLS,TILE_VALUES,tileDistribution,wordText,scoreTileWord} from '../core/word-salad-tiles.js';
test('six bag profiles preserve total size and every tile type',()=>{
 for(const size of [11,13,15,17,19,21]){
 const bag=tileDistribution(size);
 assert.equal(Object.values(bag).reduce((a,b)=>a+b,0),BOARD_SPECS[size].tileCount);
 assert.equal(Object.keys(bag).length,42);
 assert.ok(Object.values(bag).every(n=>Number.isInteger(n)&&n>0));
 }
 assert.equal(HYBRID_SYMBOLS.reduce((n,s)=>n+tileDistribution(17)[s],0),32);
});
test('hybrids remain joined and premiums score physical tiles',()=>{
 const tiles=[{symbol:'SH',newlyPlaced:true,premium:'concentrate'},{symbol:'A'},{symbol:'T'},{symbol:'T'},{symbol:'E'},{symbol:'R'}];
 const dictionaries={general:new Set(['SHATTER']),cannabis:new Set(['SHATTER'])};
 assert.equal(wordText(tiles),'SHATTER');
 assert.deepEqual(scoreTileWord(tiles,dictionaries),{word:'SHATTER',cannabis:true,score:34});
 assert.equal(scoreTileWord(tiles,{...dictionaries,mode:'straight-greens'}).score,17);
 assert.throws(()=>wordText([{symbol:'?',assignment:'SH'},{symbol:'A'}]));
 assert.throws(()=>wordText([{symbol:'SH',assignment:'S'},{symbol:'A'}]));
 assert.throws(()=>wordText([{symbol:'4'},{symbol:'A'}]));
 assert.equal(TILE_VALUES.GH,4);
});

test('all fifteen hybrid symbols retain their printed order and face values',()=>{
 const expected={QU:8,TH:3,PH:5,SH:3,CH:5,GH:4,CK:4,NG:3,WH:4,SC:4,ST:2,TR:2,LL:3,SS:2,OO:2};
 assert.deepEqual(HYBRID_SYMBOLS,Object.keys(expected));
 for(const [symbol,value] of Object.entries(expected)){
 assert.equal(TILE_VALUES[symbol],value);
 assert.equal(wordText([{symbol},{symbol:'A'}]),symbol+'A');
 assert.equal(wordText([{symbol:'A'},{symbol}]),'A'+symbol);
 }
 for(const [size,total] of [[11,15],[13,19],[15,23],[17,32],[19,42],[21,54]])
 assert.equal(HYBRID_SYMBOLS.reduce((n,s)=>n+tileDistribution(size)[s],0),total);
});
