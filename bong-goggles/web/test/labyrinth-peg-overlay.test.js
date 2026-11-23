import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LABYRINTH_PRINTED_GUIDES} from '../core/labyrinth-printed-guides.js';
import {validateLabyrinthPegAtlas,labyrinthPhysicalLaneScores,labyrinthPegPositions,renderLabyrinthPegOverlay} from '../core/labyrinth-peg-overlay.js';

const blank=Object.freeze({schemaVersion:1,scoreTarget:325,
 artSHA256:'4634051491e6bcadec3f7e065ed61b8cbf92ca4ef3f3f488da1811730f91f5f5',
 tracks:[[],[]],guideAnchors:{}});

test('BC-2.4 incomplete, copied or forged pegging map never generates physical pegs',()=>{
 assert.equal(validateLabyrinthPegAtlas(null),false);
 assert.equal(validateLabyrinthPegAtlas(blank),false);
 assert.equal(validateLabyrinthPegAtlas({...blank,tracks:[Array(326).fill(0),Array(326).fill(1)]}),false);
 assert.deepEqual(labyrinthPegPositions({scores:[0,325],teams:[0,1]},blank),[]);
 assert.equal(renderLabyrinthPegOverlay({scores:[0,325],teams:[0,1]},blank),'');
});

test('BC-2.4 responsive overlay uses exact unscaled source-image coordinates',async()=>{
 const css=await readFile(new URL('../labyrinth.css',import.meta.url),'utf8');
 const runtime=await readFile(new URL('../core/labyrinth-route-runtime.js',import.meta.url),'utf8');
 assert.match(css,/\.lab-peg-overlay\{position:absolute;inset:0;width:100%;height:100%/);
 assert.match(runtime,/validateLabyrinthPegAtlas/);
 assert.match(runtime,/renderLabyrinthPegOverlay/);
 assert.match(runtime,/\/core\/labyrinth-peg-map\.json/);
 assert.match(css,/\.lab-physical-peg--1/);
});

test('BC-2.4 partnered scoring shares one physical peg while independent players keep separate virtual scores',()=>{
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[325,8],teams:[0,1]}),[
  {team:0,lane:0,score:325},{team:1,lane:1,score:8}]);
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[12,23,12,23],teams:[0,1,0,1]}),[
  {team:0,lane:0,score:12},{team:1,lane:1,score:23}]);
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[12,23,11,23],teams:[0,1,0,1]}),[]);
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[11,22,33],teams:[0,1,2]}),[]);
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[11,22,33,44],teams:[0,1,2,3]}),[]);
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[-1,22],teams:[0,1]}),[]);
});

test('BC-2.4 all 32 decade markers are independently located on the supplied original board',()=>{
 const entries=Object.entries(LABYRINTH_PRINTED_GUIDES);
 assert.equal(entries.length,32);
 for(let n=10;n<=320;n+=10){
  const p=LABYRINTH_PRINTED_GUIDES[n];
  assert.equal(p?.length,2,'missing printed numeral '+n);
  assert.ok(p.every(x=>Number.isInteger(x)&&x>=0&&x<1254));
 }
});

test('BC-2.4 every winning score 0..325 is preserved on the correct physical lane',()=>{
 for(let score=0;score<=325;score++){
  assert.deepEqual(labyrinthPhysicalLaneScores({scores:[score,325-score],teams:[0,1]}),[
   {team:0,lane:0,score},{team:1,lane:1,score:325-score}]);
  assert.deepEqual(labyrinthPhysicalLaneScores({scores:[score,22,score,22],teams:[0,1,0,1]}),[
   {team:0,lane:0,score},{team:1,lane:1,score:22}]);
 }
 // Authoritative scores can overshoot during a scoring award: the physical
 // finish peg stops at hole 325, without modifying the true reported score.
 assert.deepEqual(labyrinthPhysicalLaneScores({scores:[327,4],teams:[0,1]}),[
  {team:0,lane:0,score:325},{team:1,lane:1,score:4}]);
});
