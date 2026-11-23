import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {validateLabyrinthPegAtlas,labyrinthPegPositions,renderLabyrinthPegOverlay} from '../core/labyrinth-peg-overlay.js';

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
