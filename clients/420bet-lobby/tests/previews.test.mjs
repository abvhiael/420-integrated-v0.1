import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../src/previews.js',import.meta.url),'utf8');
test('read-only adapters never request wallet access or send transactions',()=>{for(const p of [/eth_requestAccounts/,/writeContract/,/sendTransaction/,/fetch\(/,/WebSocket/,/submit\(/])assert.doesNotMatch(source,p)});
test('only identified Dice and Fantasy interfaces have source-aligned adapters',()=>{assert.match(source,/id==='dice'/);assert.match(source,/id==='fantasy'/);assert.match(source,/\:null/)});
