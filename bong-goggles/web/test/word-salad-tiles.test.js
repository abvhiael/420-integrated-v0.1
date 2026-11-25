import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARD_SPECS} from '../core/word-salad-rules.js';
import {HYBRID_SYMBOLS,TILE_VALUES,tileDistribution,wordText,scoreTileWord} from '../core/word-salad-tiles.js';
test('six bag profiles preserve total size and every tile type',()=>{
 for(const size of [11,13,15,17,19,21]){
 const bag=tileDistribution(size);
 assert.equal(Object.values(bag).reduce((a,b)=>a+b,0),BOARD_SPECS[size].tileCount);
 assert.equal(Object.keys(bag).length,33);
 assert.ok(Object.values(bag).every(n=>Number.isInteger(n)&&n>0));
 }
 assert.equal(HYBRID_SYMBOLS.reduce((n,s)=>n+tileDistribution(17)[s],0),15);
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
