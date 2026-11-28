import test from 'node:test';
import assert from 'node:assert/strict';
import {SQUARES,BOARD_SIZE,checkerPlacement,checkerArtwork,playerAvatar} from '../core/checkers-art.js';
import {CHECKERS_ART} from '../scripts/checkers-art-manifest.mjs';
test('all 64 surveyed squares retain their labeled centers and checker bounds at multiple display sizes',()=>{
 assert.equal(SQUARES.length,64);assert.equal(new Set(SQUARES.map(s=>s.id)).size,64);
 assert.equal(SQUARES.filter(s=>s.dark).length,32);
 assert.equal(SQUARES[0].id,'A8');assert.equal(SQUARES[63].id,'H1');
 for(const square of SQUARES){
  assert.equal(square.dark,(square.row+square.col)%2===1);
  const p=checkerPlacement(square.id);
  for(const width of [320,768,1536]){
   const height=width*BOARD_SIZE[1]/BOARD_SIZE[0];
   assert.ok(Math.abs(p.left/100*width-square.x/BOARD_SIZE[0]*width)<1e-8);
   assert.ok(Math.abs(p.top/100*height-square.y/BOARD_SIZE[1]*height)<1e-8);
   assert.ok(Math.abs(p.width/100*width-p.height/100*height)<1e-8);
   assert.ok(p.width/100*BOARD_SIZE[0]<square.width);
   assert.ok(p.height/100*BOARD_SIZE[1]<square.height);
  }
 }
 assert.throws(()=>checkerPlacement('Z9'));
});
test('all eight piece states map uniquely to pinned masters and separate portraits',()=>{
 const paths=[];
 for(const color of ['red','black'])for(const king of [false,true])for(const selected of [false,true]){
  const path=checkerArtwork(color,king,selected);
  paths.push(path);
  assert.ok(CHECKERS_ART[path.replace('/assets/games/checkers/','').replace('.webp','.png')]);
 }
 assert.equal(new Set(paths).size,8);
 assert.notEqual(playerAvatar('red'),playerAvatar('black'));
 assert.throws(()=>checkerArtwork('green'));assert.throws(()=>playerAvatar('green'));
});
