import {createHash} from 'node:crypto';
import {readFile,writeFile,rename,open,mkdir} from 'node:fs/promises';
import {dirname} from 'node:path';
import {EVENT_SPECS,decodeKnownEvent} from './indexer-event-abi.mjs';

// Read-only Indexer V1 adapter: never claims a log to be a settlement verdict.
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const UINT=/^(0|[1-9][0-9]*)$/;
const MAX_BLOCKS=64, MAX_PAGES=5000, ANCHORS=512;
function demand(ok,why){if(!ok)throw Error(why);}
function uint(v){demand(typeof v==='string'&&UINT.test(v),'noncanonical indexer integer');return BigInt(v);}
function hash(v){demand(typeof v==='string'&&HASH.test(v),'invalid hash');return v.toLowerCase();}
function address(v){demand(typeof v==='string'&&ADDRESS.test(v),'invalid contract address');return v.toLowerCase();}
function same(a,b){return hash(a)===hash(b);}
const canonical=value=>JSON.stringify(value);
export function verifyIndexerManifest(config){
 demand(config&&typeof config==='object'&&!Array.isArray(config),'invalid manifest');
 uint(config.chainId);demand(BigInt(config.chainId)>0n,'invalid chain');
 const url=new URL(config.indexerUrl);
 demand(!url.username&&!url.password&&!url.search&&!url.hash&&
  (url.protocol==='https:'||(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))),
  'indexer URL must be HTTPS or local HTTP');
 demand(Array.isArray(config.contracts)&&config.contracts.length>0&&config.contracts.length<=32,'invalid contracts');
 const ids=new Set(),addresses=new Set();
 const contracts=config.contracts.map(item=>{
  demand(item&&typeof item==='object'&&typeof item.id==='string'&&/^[a-z][a-z0-9-]{0,48}$/.test(item.id),'invalid binding id');
  demand(Object.hasOwn(EVENT_SPECS,item.role),'unsupported contract role');
  const addr=address(item.address);
  demand(!ids.has(item.id)&&!addresses.has(addr),'duplicate contract binding');
  ids.add(item.id);addresses.add(addr);
  return Object.freeze({id:item.id,role:item.role,address:addr,fromBlock:uint(item.fromBlock).toString()});
 });
 return Object.freeze({chainId:config.chainId,indexerUrl:url.origin+url.pathname,contracts});
}
const digest=config=>createHash('sha256').update(canonical(config)).digest('hex');
function empty(config){
 const first=config.contracts.reduce((a,c)=>BigInt(c.fromBlock)<a?BigInt(c.fromBlock):a,BigInt(config.contracts[0].fromBlock));
 return {schema:'bet-indexer-checkpoint-v1',manifestHash:digest(config),chainId:config.chainId,
  firstBlock:first.toString(),nextBlock:first.toString(),tipHash:null,anchors:[],
  cursors:Object.fromEntries(config.contracts.map(c=>[c.id,null])),events:[]};
}
async function readCheckpoint(file,config){
 let snapshot;try{snapshot=JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')return empty(config);throw Error('checkpoint cannot be read');}
 demand(snapshot?.schema==='bet-indexer-checkpoint-v1'&&snapshot.manifestHash===digest(config)&&snapshot.chainId===config.chainId,'checkpoint manifest mismatch');
 const initial=empty(config);
 demand(snapshot.firstBlock===initial.firstBlock&&uint(snapshot.nextBlock)>=uint(snapshot.firstBlock),'invalid persisted checkpoint');
 demand(snapshot.tipHash===null||HASH.test(snapshot.tipHash),'invalid persisted tip');
 demand(Array.isArray(snapshot.anchors)&&snapshot.anchors.length<=ANCHORS&&Array.isArray(snapshot.events)&&
  snapshot.events.length<=200000&&snapshot.cursors&&typeof snapshot.cursors==='object','invalid persisted checkpoint payload');
 for(const c of config.contracts)demand(snapshot.cursors[c.id]===null||typeof snapshot.cursors[c.id]==='string','invalid persisted cursor');
 const expected=uint(snapshot.nextBlock)-1n;
 if(snapshot.tipHash!==null)demand(snapshot.anchors.length>0&&snapshot.anchors.at(-1).number===expected.toString()&&
  same(snapshot.tipHash,snapshot.anchors.at(-1).hash),'checkpoint tip inconsistency');
 return snapshot;
}
async function persistCheckpoint(file,state){
 await mkdir(dirname(file),{recursive:true});
 const tmp=file+'.'+process.pid+'.tmp';let handle;
 try{
  handle=await open(tmp,'wx',0o600);
  await handle.writeFile(canonical(state)+'\n');await handle.sync();await handle.close();handle=null;
  await rename(tmp,file);
  // Directory fsync improves crash durability on POSIX filesystems.
  try{const dir=await open(dirname(file),'r');try{await dir.sync();}finally{await dir.close();}}catch{}
 }finally{if(handle)await handle.close();}
}
function appendEvent(current,item){
 const id=item.transactionHash+':'+item.logIndex+':'+item.contract;
 const index=current.findIndex(x=>x.transactionHash+':'+x.logIndex+':'+x.contract===id);
 if(index<0)current.push(item);
 else demand(canonical(current[index])===canonical(item),'conflicting canonical event');
}
export function createIndexerEventReader({manifest,fetcher=fetch,timeoutMs=12000}={}){
 const config=verifyIndexerManifest(manifest);
 demand(Number.isSafeInteger(timeoutMs)&&timeoutMs>=100&&timeoutMs<=60000,'invalid timeout');
 const base=new URL(config.indexerUrl);
 async function get(path,params={}){
  const url=new URL(path,base);for(const [k,v] of Object.entries(params))if(v!==null&&v!==undefined)url.searchParams.set(k,String(v));
  const response=await fetcher(url.href,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',
   headers:{Accept:'application/json'},signal:AbortSignal.timeout(timeoutMs)});
  demand(response?.ok,'420Indexer unavailable');
  const text=await response.text();demand(text.length<=2_000_000,'indexer response too large');
  const result=JSON.parse(text);demand(result?.apiVersion==='v1'&&result.data!==null&&typeof result.data==='object','invalid indexer v1 envelope');
  return result.data;
 }
 async function status(){
  const s=await get('/v1/status',{chainId:config.chainId});
  demand(s.chainId===config.chainId&&s.authoritative===false&&s.runtime?.stale!==true,'untrusted or stale indexer');
  demand(['confirmations','finalized'].includes(s.finality?.mode)&&s.finality.safeHead!==null,'insufficient finality policy');
  demand(uint(s.indexedHead)>=uint(s.finality.safeHead),'inconsistent indexed/safe heads');
  return s;
 }
 async function block(number){
  const b=await get('/v1/blocks/'+number,{chainId:config.chainId});
  demand(b.chainId===config.chainId&&b.number===number,'block identity mismatch');
  return {number,hash:hash(b.hash),parentHash:hash(b.parentHash)};
 }
 async function eventLogs(c,target,fromCursor,blockCache){
  let cursor=fromCursor,latestCursor=cursor,stop=false,seen=new Set(),events=[];
  for(let pageNumber=0;pageNumber<MAX_PAGES;pageNumber++){
   const page=await get('/v1/logs',{chainId:config.chainId,address:c.address,limit:200,direction:'asc',cursor});
   demand(Array.isArray(page.items)&&page.items.length<=200&&(page.nextCursor===null||typeof page.nextCursor==='string'),'invalid logs page');
   let within=true;
   for(const log of page.items){
    const number=uint(log.blockNumber);
    if(number>target){within=false;stop=true;break;}
    if(number<BigInt(c.fromBlock))continue;
    const stamp=log.transactionHash+':'+log.logIndex;
    demand(!seen.has(stamp),'duplicated indexer position');seen.add(stamp);
    demand(log.chainId===config.chainId&&address(log.address)===c.address,'cross-chain or wrong-emitter log');
    demand(Number.isSafeInteger(log.transactionIndex)&&log.transactionIndex>=0&&
      Number.isSafeInteger(log.logIndex)&&log.logIndex>=0,'invalid log position');
    const b=blockCache.get(log.blockNumber);
    demand(b&&same(log.blockHash,b.hash),'log block not canonical');
    const decoded=decodeKnownEvent(c.role,log);
    if(!decoded)continue; // other ABI events from the same verified contract are not asserted
    const receipt=await get('/v1/transactions/'+hash(log.transactionHash)+'/receipt',{chainId:config.chainId});
    demand(receipt.chainId===config.chainId&&same(receipt.transactionHash,log.transactionHash)&&
      receipt.blockNumber===log.blockNumber&&same(receipt.blockHash,b.hash)&&
      receipt.transactionIndex===log.transactionIndex&&receipt.status===1,'log receipt provenance mismatch');
    events.push({chainId:config.chainId,gameId:c.id,vertical:c.role.split('-')[0],
      contract:c.address,role:c.role,blockNumber:log.blockNumber,blockHash:b.hash,
      transactionHash:hash(log.transactionHash),transactionIndex:log.transactionIndex,
      logIndex:String(log.logIndex),...decoded});
   }
   if(!within)break;
   if(page.nextCursor===null){stop=true;break;}
   demand(page.nextCursor!==cursor&&page.items.length>0,'nonadvancing indexer cursor');
   cursor=page.nextCursor;latestCursor=cursor;
  }
  demand(stop,'indexer log scan exceeded safety page limit');
  return {events,cursor:latestCursor};
 }
 async function poll(state,{maxBlocks=MAX_BLOCKS}={}){
  demand(Number.isSafeInteger(maxBlocks)&&maxBlocks>0&&maxBlocks<=MAX_BLOCKS,'invalid poll window');
  const observed=await status(),head=uint(observed.finality.safeHead);
  let snapshot=structuredClone(state),reorganized=false;
  const oldTip=uint(snapshot.nextBlock)-1n;
  if(snapshot.tipHash!==null){
   if(oldTip>head||!same((await block(oldTip.toString())).hash,snapshot.tipHash)){
    snapshot=empty(config);reorganized=true; // full deterministic rebuild; no stale orphan survives
   }
  }
  const start=uint(snapshot.nextBlock);
  if(start>head)return {state:snapshot,scanned:0,reorganized,complete:true};
  const end=start+BigInt(maxBlocks)-1n>head?head:start+BigInt(maxBlocks)-1n;
  const blockCache=new Map(),anchors=snapshot.anchors.slice(),prior=snapshot.tipHash;
  for(let n=start;n<=end;n++){
   const b=await block(n.toString());
   if(prior!==null)demand(b.parentHash===prior,'canonical block parent mismatch');
   blockCache.set(b.number,b);
   anchors.push({number:b.number,hash:b.hash});
   if(anchors.length>ANCHORS)anchors.shift();
   prior=b.hash;
  }
  for(const contract of config.contracts){
   const result=await eventLogs(contract,end,snapshot.cursors[contract.id],blockCache);
   for(const evt of result.events)appendEvent(snapshot.events,evt);
   snapshot.cursors[contract.id]=result.cursor;
  }
  // Prevent committing if the indexer changed the canonical range while scanning.
  const observedAgain=await status();
  demand(uint(observedAgain.finality.safeHead)>=end&&same((await block(end.toString())).hash,prior),'indexer reorg during scan');
  snapshot.tipHash=prior;snapshot.nextBlock=(end+1n).toString();snapshot.anchors=anchors;
  snapshot.events.sort((a,b)=>{
   const n=BigInt(a.blockNumber)-BigInt(b.blockNumber);
   if(n!==0n)return n<0n?-1:1;
   return a.transactionIndex-b.transactionIndex||Number(a.logIndex)-Number(b.logIndex);
  });
  return {state:snapshot,scanned:Number(end-start+1n),reorganized,complete:end>=uint(observedAgain.finality.safeHead)};
 }
 return {config,poll,readCheckpoint:file=>readCheckpoint(file,config)};
}
export async function synchronizeIndexerEvents({manifest,checkpointPath,fetcher,maxBlocks}){
 demand(typeof checkpointPath==='string'&&checkpointPath.length>0,'checkpoint path required');
 const reader=createIndexerEventReader({manifest,fetcher});
 await mkdir(dirname(checkpointPath),{recursive:true});
 const lock=await open(checkpointPath+'.lock','wx',0o600);
 try{
  const previous=await reader.readCheckpoint(checkpointPath);
  const outcome=await reader.poll(previous,{maxBlocks});
  await persistCheckpoint(checkpointPath,outcome.state);
  return {scanned:outcome.scanned,reorganized:outcome.reorganized,complete:outcome.complete,
   nextBlock:outcome.state.nextBlock,totalEvents:outcome.state.events.length};
 }finally{await lock.close();const {unlink}=await import('node:fs/promises');await unlink(checkpointPath+'.lock');}
}
