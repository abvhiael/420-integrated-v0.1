import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChessScreen} from '../core/chess-ui.js';
import {chessArtPaths} from '../scripts/chess-art.mjs';
import {fixture,id} from './chess-fixture.mjs';
test('approved artwork on setup and active board, never private art during recovery',()=>{
 assert.equal(chessArtPaths.size,30);
 const guest=renderChessScreen('intro',{status:'guest'});
 assert.match(guest,/Starting position preview/);
 assert.equal((guest.match(/class="chess-piece"/g)||[]).length,32);
 assert.doesNotMatch(guest,/data-chess-square=/);
 const raw=fixture(0),session={...raw,seat:0,view:raw.privateView};
 const html=renderChessScreen('play',{status:'ready',session,actions:[]});
 assert.equal((html.match(/data-chess-square=/g)||[]).length,64);
 const paths=new Set([...html.matchAll(/src="\/(assets\/games\/chess\/pieces\/[^"]+)"/g)].map(m=>m[1]));
 assert.equal(paths.size,12);
 for(const path of paths)assert.ok(chessArtPaths.has(path));
 for(const status of ['idle','guest','unavailable']){
  const recovery=renderChessScreen('play',{target:id,status});
  assert.match(recovery,/chess-logo\.webp/);
  assert.doesNotMatch(recovery,/data-chess-start|data-chess-square|class="chess-piece"|Starting position preview/);
 }
});
