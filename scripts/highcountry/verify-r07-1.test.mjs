import {test} from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {verify} from './verify-r07-1.mjs';
const m=JSON.parse(fs.readFileSync('deployments/highcountry/r07-1.testnet.json')),s=JSON.parse(fs.readFileSync('contracts/config/system-addresses.json'));const copy=()=>structuredClone(m);
test('unresolved template passes structural verification but not deployment approval',()=>{verify(m,s);assert.throws(()=>verify(m,s,{ready:true}));});
test('reject reserved and duplicate contract addresses',()=>{let x=copy();x.components[0].address='0x0000000000000000000000000000000000000420';assert.throws(()=>verify(x,s));x=copy();x.components[0].address='0x1111111111111111111111111111111111111111';x.components[1].address=x.components[0].address;assert.throws(()=>verify(x,s));});
test('reject wrong dependency order',()=>{const x=copy();x.components[0].dependsOn=['PlantRegistry'];assert.throws(()=>verify(x,s));});
test('reject unreviewed production routine policy',()=>{const x=copy();x.productionRoutineSelectors=['0x12345678'];assert.throws(()=>verify(x,s));});
test('reject unsafe grant variants',()=>{const g={principal:'engine',component:'plant',action:'register',scope:'0x'+'1'.repeat(64),periodLimit:0,periodSeconds:0};for(const d of [{principal:'*'},{scope:'0x'+'0'.repeat(64)},{periodLimit:1},{periodSeconds:60}]){const x=copy();x.exactGrants=[{...g,...d}];assert.throws(()=>verify(x,s));}});
test('reject zero, negative and noninteger chain IDs',()=>{for(const chainId of [0,-1,1.5,'420']){const x=copy();x.chainId=chainId;assert.throws(()=>verify(x,s));}});

test('constructor mapping rejects missing dependency',()=>{let x=copy();x.components[12].dependsOn=[];assert.throws(()=>verify(x,s),/constructor dependency mismatch/);});

test('reject constructor source tampering',()=>{const x=copy();x.components[0].constructorParameters[0].name='fabricated_';assert.throws(()=>verify(x,s),/constructor schema diverges/);});
test('reject unknown external dependency references',()=>{const x=copy();x.components[0].constructorParameters[0].sourceRef='InvalidAuthority';assert.throws(()=>verify(x,s),/unknown constructor reference/);});
test('reject missing source',()=>{const x=copy();x.components[0].source='fake.sol';assert.throws(()=>verify(x,s),/missing verified source/);});
