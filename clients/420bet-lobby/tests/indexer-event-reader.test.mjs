import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {eventTopic,EVENT_SPECS,decodeKnownEvent} from '../server/indexer-event-abi.mjs';
import {createIndexerEventReader,synchronizeIndexerEvents,verifyIndexerManifest} from '../server/indexer-event-reader.mjs';

const h=n=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const a=n=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const w=n=>BigInt(n).toString(16).padStart(64,'0');
const contracts=[
 {id:'casino-accept',role:'casino-router',address:a(10),fromBlock:'1'},
 {id:'casino-close',role:'casino-settlement',address:a(11),fromBlock:'1'},
 {id:'poker',role:'poker-ledger',address:a(12),fromBlock:'1'},
 {id:'fantasy',role:'fantasy-contest',address:a(13),fromBlock:'1'},
 {id:'sports',role:'sports-tickets',address:a(14),fromBlock:'1'}
];
const manifest={chainId:'420',indexerUrl:'https://indexer.example/',contracts};
const makeLog=(c,type,block,tx,idx=0)=>{
 const spec=EVENT_SPECS[c.role].find(x=>x.type===type);
 const topics=[spec.topic0,...Array.from({length:spec.indexed},(_,i)=>h(i+100))];
 if(spec.accountIndex)topics[spec.accountIndex]='0x'+w(77);
 const data=spec.type==='FANTASY_ENTRY_ACCEPTED'
  ? '0x'+w(5)+w(12)+w(96)+w(0)
  : '0x'+w(1).repeat(spec.words);
 return {chainId:'420',address:c.address,blockNumber:String(block),blockHash:h(block),transactionHash:h(tx),
  transactionIndex:idx,logIndex:idx,topics,data};
};
function service({logs=[],head=4,corruptReceipt=false,finalityMode='confirmations'}={}){
 let requests=[];
 const blocks=new Map(Array.from({length:head+1},(_,i)=>[String(i),
  {chainId:'420',number:String(i),hash:h(i),parentHash:h(i?i-1:0),timestamp:String(i*60)}]));
 const source=async(url,opts)=>{
  const u=new URL(url);requests.push(u.pathname);
  const n=u.searchParams.get('chainId'),parts=u.pathname.split('/');
  if(n!=='420')throw Error('unexpected chain');
  let data;
  if(u.pathname==='/v1/status')data={chainId:'420',authoritative:false,indexedHead:String(head),runtime:{stale:false},
    finality:{mode:finalityMode,safeHead:String(head),confirmations:'1'}};
  else if(parts[2]==='blocks')data=blocks.get(parts[3]);
  else if(u.pathname==='/v1/logs'){
   const filtered=logs.filter(l=>l.address===u.searchParams.get('address'))
    .sort((x,y)=>Number(x.blockNumber)-Number(y.blockNumber)||x.transactionIndex-y.transactionIndex||x.logIndex-y.logIndex);
   const offset=Number(u.searchParams.get('cursor')||0),end=Math.min(offset+200,filtered.length);
   data={items:filtered.slice(offset,end),nextCursor:end<filtered.length?String(end):null};
  }else if(parts[2]==='transactions'&&parts[4]==='receipt'){
   const l=logs.find(l=>l.transactionHash===parts[3]);if(!l)throw Error('no tx');
   data={chainId:'420',transactionHash:l.transactionHash,blockNumber:l.blockNumber,blockHash:l.blockHash,
    transactionIndex:l.transactionIndex,status:corruptReceipt?0:1,contractAddress:null};
  }else throw Error('unexpected endpoint '+u.pathname);
  return {ok:true,text:async()=>JSON.stringify({apiVersion:'v1',data})};
 };
 return {fetcher:source,blocks,requests};
}
test('Ethereum Keccak topic signatures are correct, not NIST SHA3',()=>{
 assert.equal(eventTopic('Transfer(address,address,uint256)'),
 '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef');
 assert.equal(EVENT_SPECS['casino-router'][0].signature,'WagerAcceptanceCompleted(bytes32,address,bytes32,bytes32,uint256,uint256,uint256,uint256)');
});
test('recognized events enforce ABI word counts and indexed account',()=>{
 const l=makeLog(contracts[0],'WAGER_ACCEPTED',2,20);
 const got=decodeKnownEvent('casino-router',l);
 assert.equal(got.account,a(77));assert.equal(got.objectId,l.topics[1]);
 assert.throws(()=>decodeKnownEvent('casino-router',{...l,data:'0x'+w(1)}));
 assert.throws(()=>decodeKnownEvent('casino-router',{...l,topics:l.topics.slice(0,3)}));
});
test('reads real v1 routes, verifies receipts/block identity and persists restart state',async()=>{
 const logs=[
  makeLog(contracts[0],'WAGER_ACCEPTED',1,101),
  makeLog(contracts[1],'WAGER_SETTLED',2,102),
  makeLog(contracts[2],'POKER_HAND_SETTLED',2,103),
  makeLog(contracts[3],'FANTASY_POOL_SETTLED',3,104),
  makeLog(contracts[4],'SPORTS_TICKET_FUNDED',4,105)];
 const source=service({logs});
 const dir=await mkdtemp(join(tmpdir(),'bet7-'));
 try{
  const checkpointPath=join(dir,'events.json');
  const first=await synchronizeIndexerEvents({manifest,checkpointPath,fetcher:source.fetcher,maxBlocks:2});
  assert.equal(first.scanned,2);assert.equal(first.totalEvents,3);assert.equal(first.complete,false);
  const second=await synchronizeIndexerEvents({manifest,checkpointPath,fetcher:source.fetcher,maxBlocks:2});
  assert.equal(second.scanned,2);assert.equal(second.totalEvents,5);
  const snap=JSON.parse(await readFile(checkpointPath,'utf8'));
  assert.equal(snap.nextBlock,'5');assert.equal(snap.events.length,5);
  assert.equal(new Set(snap.events.map(e=>e.vertical)).size,4);
  assert.ok(source.requests.includes('/v1/logs')&&source.requests.includes('/v1/transactions/'+h(104)+'/receipt'));
  const again=await synchronizeIndexerEvents({manifest,checkpointPath,fetcher:source.fetcher});
  assert.equal(again.totalEvents,5);assert.equal(again.scanned,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('tip divergence automatically resets and rebuilds; no orphaned projections survive',async()=>{
 const log=makeLog(contracts[4],'SPORTS_TICKET_FUNDED',2,200);
 const src=service({logs:[log],head:3});
 const reader=createIndexerEventReader({manifest,fetcher:src.fetcher});
 const a1=await reader.poll(await reader.readCheckpoint('/not/a/checkpoint'),{maxBlocks:3});
 assert.equal(a1.state.events.length,1);
 const bad=makeLog(contracts[4],'SPORTS_TICKET_FUNDED',2,201);
 bad.blockHash=h(999);
 src.blocks.set('2',{chainId:'420',number:'2',hash:h(999),parentHash:h(1)});
 src.blocks.set('3',{chainId:'420',number:'3',hash:h(1000),parentHash:h(999)});
 // Reset must happen before scanning: a clean new chain fixture is used after the fork.
 const rebuilt=service({logs:[bad],head:3});
 rebuilt.blocks.set('2',src.blocks.get('2'));rebuilt.blocks.set('3',src.blocks.get('3'));
 const newReader=createIndexerEventReader({manifest,fetcher:rebuilt.fetcher});
 const result=await newReader.poll(a1.state,{maxBlocks:3});
 assert.equal(result.reorganized,true);assert.equal(result.state.events.length,1);
 assert.equal(result.state.events[0].transactionHash,h(201));
});
test('rejects forged receipts, unstable finality and incorrect manifest',async()=>{
 const log=makeLog(contracts[0],'WAGER_ACCEPTED',1,300);
 const bad=service({logs:[log],corruptReceipt:true});
 const reader=createIndexerEventReader({manifest,fetcher:bad.fetcher});
 await assert.rejects(reader.poll(await reader.readCheckpoint('/not/a/checkpoint'),{maxBlocks:1}),/receipt provenance/);
 const unsafe=service({head:2,finalityMode:'head'});
 const other=createIndexerEventReader({manifest,fetcher:unsafe.fetcher});
 await assert.rejects(other.poll(await other.readCheckpoint('/not/a/checkpoint')),/finality/);
 assert.throws(()=>verifyIndexerManifest({...manifest,contracts:[contracts[0],{...contracts[1],address:contracts[0].address}]}));
});

test('opaque-cursor pagination delivers more than 200 real-indexer-shaped events without duplicates',async()=>{
 const logs=Array.from({length:206},(_,i)=>makeLog(contracts[4],'SPORTS_TICKET_FUNDED',1,1000+i,i));
 const src=service({logs,head:1});
 const reader=createIndexerEventReader({manifest,fetcher:src.fetcher});
 const one=await reader.poll(await reader.readCheckpoint('/not/a/checkpoint'),{maxBlocks:1});
 assert.equal(one.state.events.length,206);
 const twoSrc=service({logs:[...logs,makeLog(contracts[4],'SPORTS_TICKET_FUNDED',2,2000,0)],head:2});
 const resumed=createIndexerEventReader({manifest,fetcher:twoSrc.fetcher});
 const two=await resumed.poll(one.state,{maxBlocks:1});
 assert.equal(two.state.events.length,207);
 assert.equal(new Set(two.state.events.map(e=>e.transactionHash+':'+e.logIndex)).size,207);
});
test('wrong canonical parent and stale operational metadata abort before checkpoint advancement',async()=>{
 const src=service({head:2});
 src.blocks.get('2').parentHash=h(999);
 const reader=createIndexerEventReader({manifest,fetcher:src.fetcher});
 await assert.rejects(reader.poll(await reader.readCheckpoint('/not/a/checkpoint'),{maxBlocks:2}),/parent mismatch/);
 const stale=service({head:1});
 const original=stale.fetcher;
 stale.fetcher=async(u,o)=>{
  const response=await original(u,o);
  if(new URL(u).pathname!=='/v1/status')return response;
  const data=JSON.parse(await response.text());data.data.runtime.stale=true;
  return {ok:true,text:async()=>JSON.stringify(data)};
 };
 const fail=createIndexerEventReader({manifest,fetcher:stale.fetcher});
 await assert.rejects(fail.poll(await fail.readCheckpoint('/not/a/checkpoint')),/stale indexer/);
});
test('manifest must bind every engine family and checkpoint cannot silently migrate',async()=>{
 assert.throws(()=>verifyIndexerManifest({...manifest,contracts:contracts.slice(0,-1)}),/missing required engine/);
 const src=service({head:1}),dir=await mkdtemp(join(tmpdir(),'bet7-version-'));
 try{
  const checkpointPath=join(dir,'events.json');
  await synchronizeIndexerEvents({manifest,checkpointPath,fetcher:src.fetcher,maxBlocks:1});
  const changed={...manifest,contracts:contracts.map((c,i)=>i?c:{...c,fromBlock:'2'})};
  const altered=createIndexerEventReader({manifest:changed,fetcher:src.fetcher});
  await assert.rejects(altered.readCheckpoint(checkpointPath),/manifest mismatch/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
