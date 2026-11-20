import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTokenBinding420 } from '../src/token-read-model.js';
const w=(n:number)=>n.toString(16).padStart(64,'0'),h=(n:number)=>'0x'+w(n),a=(n:number)=>'0x'+n.toString(16).padStart(40,'0'),aw=(v:string)=>'0x'+v.slice(2).padStart(64,'0');
const b=parseTokenBinding420(JSON.stringify({chainId:31337,genesisHash:h(1),factory:a(10),vault:a(11),accounting:a(12),factoryCodeHash:h(21),metadataHash:h(22),manifestHash:h(23),dependencyRoot:h(24),interfaceHash:h(25)}));
test('Token binding rejects incomplete, aliased and reserved addresses',()=>{
 for(const x of [{...b,factory:b.vault},{...b,factory:a(0x455)},{...b,chainId:0},{...b,extra:1}])assert.throws(()=>parseTokenBinding420(JSON.stringify(x)));
});
