#!/usr/bin/env node
// Read-only local Go-Explorer compatibility transport over real PostgreSQL
// 420Indexer data. This is NOT the production indexer API or real consensus.
// It only runs on 127.0.0.1 against synthetic chain 31337; missing consensus
// and Stake APIs return 503 rather than invented finalized/validator records.
import { createServer } from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const { PostgresSql420 }=await import('../../420-indexer/dist/src/postgres.js');
const { EvmJsonRpcSource420,HttpJsonRpcTransport420 }=
  await import('../../420-indexer/dist/src/rpc-source.js');
const args=process.argv.slice(2);
function option(name){const i=args.indexOf('--'+name);if(i<0||!args[i+1])throw Error(name+' required');return args[i+1];}
function need(value,msg){if(!value)throw Error('GOV-PRE-08 Explorer PostgreSQL bridge: '+msg);}
const tag=option('tag'),rpcUrl=option('rpc'),port=Number(option('port'));
need(/^[ab]$/.test(tag) && /^http:\/\/127\.0\.0\.1:\d{3,5}$/.test(rpcUrl)
  && Number.isInteger(port) && port>1024 && port<65535,'loopback test-only binding');
const graph=JSON.parse(await fs.readFile(option('graph'),'utf8'));
need(graph.chainId===31337 && !graph.approvedV4,'unapproved synthetic chain 31337 only');
const dbURL=process.env.INDEXER_PG_URL;
need(/^postgres(?:ql)?:\/\/[^@]+@127\.0\.0\.1:5432\/[a-z0-9_]+$/i.test(dbURL||''),
  'no remote database');
const db=new PostgresSql420({connectionString:dbURL,
  options:'-c search_path=gov_pre08_step3_'+tag});
const source=new EvmJsonRpcSource420(new HttpJsonRpcTransport420(rpcUrl));
const SCOPE='LOCAL_INDEXER_VERIFIED_NOT_NETWORK_FINALITY';
const chainId=31337;
const schema='GOV_PRE_08_STEP3_UNFINALIZED_LOCAL_PROJECTION';
async function select(sql,params=[]){return(await db.query(sql,params)).rows;}
async function canonical(){
  need(await source.chainId()===31337n,'RPC chain changed');
  const cp=(await select('select block_number::text as height,block_hash from idx_checkpoints where chain_id=$1',['31337']))[0];
  need(cp && BigInt(cp.height)>30n,'durable PostgreSQL source checkpoint absent');
  const current=await source.getBlockByNumber(BigInt(cp.height));
  const remoteHead=await source.blockNumber();
  need(current && current.hash.toLowerCase()===cp.block_hash.toLowerCase()
       && remoteHead===BigInt(cp.height),
       'PostgreSQL projection is stale, diverged or not fully ingested');
  const observation=(await select('select observed_head_hash,observed_at,local_scope from gov_pre08_local_observation where chain_id=$1',['31337']))[0];
  need(observation && observation.observed_head_hash.toLowerCase()===cp.block_hash.toLowerCase()
       && observation.local_scope===SCOPE
       && observation.observed_at instanceof Date &&
       Date.now()-observation.observed_at.getTime()<300000,
       'PostgreSQL worker source observation is absent or stale');
  return {head:Number(cp.height),hash:cp.block_hash,
          lastIngestAt:observation.observed_at.toISOString()};
}
function response(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store','x-420-canonical-authority':'false',
    'x-420-test-only':'GOV-PRE-08-chain-31337'});
  res.end(JSON.stringify(body));
}
function block(row){
  return {chainId,number:Number(row.block_number),hash:row.block_hash,
    parentHash:row.parent_hash,timestamp:Number(row.block_timestamp),
    finality:'HEAD',schemaVersion:schema};
}
const toLog=row=>({
  chainId,blockNumber:Number(row.block_number),blockHash:row.block_hash,
  transactionHash:row.tx_hash,transactionIndex:Number(row.tx_index),
  logIndex:Number(row.log_index),address:row.address,
  topics:row.topics,data:row.data,decoderVersion:schema
});
const id32=s=>/^0x[0-9a-fA-F]{64}$/.test(s);
const address=s=>/^0x[0-9a-fA-F]{40}$/.test(s);
async function serviceVersion(service,revision){
  const rows=await select(
    "select block_number::text as block_number,block_hash,fields from idx_protocol_events where chain_id=$1 and protocol='420Registry' and event_name='ServiceVersionPublished' and lower(fields->>'serviceId')=$2 and fields->>'version'=$3 order by block_number desc limit 1",
    ['31337',service.toLowerCase(),String(revision)]);
  need(rows.length===1,'service version not indexed');
  const ev=rows[0],f=ev.fields;
  const profiles=await select(
    "select fields from idx_protocol_events where chain_id=$1 and protocol='420Registry' and event_name='ServiceRegistrationProfilePublished' and lower(fields->>'serviceId')=$2 and fields->>'version'=$3 order by block_number desc limit 1",
    ['31337',service.toLowerCase(),String(revision)]);
  need(profiles.length===1,'registry profile event absent');
  const p=profiles[0].fields;
  need(address(f.implementation) && id32(f.codeHash) && id32(f.metadataHash),
       'Registry service publication is incomplete');
  return {serviceId:service.toLowerCase(),version:revision,
    implementation:f.implementation.toLowerCase(),codeHash:f.codeHash,
    metadataHash:f.metadataHash,componentType:Number(p.componentType),
    manifestHash:p.manifestHash,dependencyRoot:p.dependencyRoot,
    interfaceHash:p.interfaceHash,activatedBlock:Number(ev.block_number),
    activatedHash:ev.block_hash,active:f.active===true};
}
async function route(url){
  const p=url.pathname,canon=await canonical();
  const empty=()=>({canonicalAuthority:false});
  if(p==='/v1/health')
    return {health:{chainId,indexedHeight:canon.head,safeHeight:0,
      finalizedHeight:0,schemaVersion:schema,decoderSet:'CANONICAL_SOURCE_ABI_NOT_CONSENSUS_FINALITY',
      state:'READY',lastIngestAt:canon.lastIngestAt},canonicalAuthority:false};
  if(p==='/v1/blocks'){
    const limit=url.searchParams.has('limit')?Number(url.searchParams.get('limit')):50;
    need(Number.isInteger(limit) && limit>0 && limit<=250,'block page limit invalid');
    let before=canon.head+1;
    const cursor=url.searchParams.get('cursor');
    if(cursor){
      const c=JSON.parse(Buffer.from(cursor,'base64url').toString('utf8'));
      need(c.chainId===31337 && c.snapshotHash===canon.hash && Number.isInteger(c.before)
           && c.before>=0 && c.before<=canon.head,
           'stale or wrong-chain paged cursor');
      before=c.before;
    }
    const rs=await select(
      'select * from idx_blocks where chain_id=$1 and block_number<$2 order by block_number desc limit $3',
      ['31337',String(before),limit+1]);
    const page=rs.slice(0,limit);
    const meta={chainId,snapshotHeight:canon.head,snapshotHash:canon.hash,
      safeHeight:0,finalizedHeight:0,schemaVersion:schema};
    if(rs.length>limit)meta.nextCursor=Buffer.from(JSON.stringify({
      chainId,snapshotHash:canon.hash,before:Number(page.at(-1).block_number)})).toString('base64url');
    return {meta,blocks:page.map(block)};
  }
  const byNumber=/^\/v1\/blocks\/([0-9]+)$/.exec(p);
  if(byNumber){
    const n=Number(byNumber[1]);need(Number.isSafeInteger(n),'invalid block height');
    const r=await select('select * from idx_blocks where chain_id=$1 and block_number=$2',['31337',String(n)]);
    need(r.length===1,'block not indexed');
    return block(r[0]);
  }
  const logsPath=/^\/v1\/blocks\/([0-9]+)\/logs$/.exec(p);
  if(logsPath){
    const n=Number(logsPath[1]);need(Number.isSafeInteger(n),'invalid block number');
    const r=await select('select * from idx_logs where chain_id=$1 and block_number=$2 order by tx_index,log_index',['31337',String(n)]);
    return {...empty(),data:r.map(toLog)};
  }
  const tx=/^\/v1\/transactions\/(0x[0-9a-fA-F]{64})$/.exec(p);
  if(tx){
    const rows=await select('select * from idx_transactions where chain_id=$1 and lower(tx_hash)=$2',
       ['31337',tx[1].toLowerCase()]);
    need(rows.length===1,'transaction unavailable');
    const x=rows[0];
    return {...empty(),data:{chainId,blockNumber:Number(x.block_number),
      blockHash:x.block_hash,hash:x.tx_hash,index:Number(x.tx_index),
      from:x.from_address,to:x.to_address,
      valueWei:String(x.value_wei),input:x.input}};
  }
  const receipt=/^\/v1\/receipts\/(0x[0-9a-fA-F]{64})$/.exec(p);
  if(receipt){
    const rs=await select('select * from idx_receipts where chain_id=$1 and lower(tx_hash)=$2',
       ['31337',receipt[1].toLowerCase()]);
    need(rs.length===1,'receipt unavailable');
    const x=rs[0];
    const native=await source.getTransactionReceipt(receipt[1]);
    need(native && native.blockHash.toLowerCase()===x.block_hash.toLowerCase()
         && native.status===Number(x.status),
         'live receipt does not match durable indexed receipt');
    const raw=await source.transport.request('eth_getTransactionReceipt',[receipt[1]]);
    need(raw && raw.blockHash.toLowerCase()===x.block_hash.toLowerCase(),
         'native RPC receipt changed');
    const gasUsed=BigInt(raw.gasUsed),price=BigInt(raw.effectiveGasPrice??'0x0');
    return {...empty(),data:{chainId,blockNumber:Number(x.block_number),
      blockHash:x.block_hash,transactionHash:x.tx_hash,
      transactionIndex:Number(x.tx_index),status:Number(x.status),
      gasUsed:Number(gasUsed),effectiveGasPriceWei:price.toString(),
      actualFeeWei:(gasUsed*price).toString(),contractAddress:x.contract_address}};
  }
  const service=/^\/v1\/services\/(0x[0-9a-fA-F]{64})\/versions\/([1-9][0-9]*)$/.exec(p);
  if(service)return {...empty(),data:await serviceVersion(service[1],Number(service[2]))};
  throw Error('unsupported local projection route; no fabricated consensus or Stake evidence');
}
const server=createServer(async(req,res)=>{
  if(req.method!=='GET')return response(res,405,{error:'GET only',canonicalAuthority:false});
  try{
    const u=new URL(req.url,'http://127.0.0.1:'+port);
    response(res,200,await route(u));
  }catch(err){
    response(res,503,{error:String(err.message||err),canonicalAuthority:false});
  }
});
server.listen(port,'127.0.0.1',()=>console.log('GOV_PRE_08_STEP3_REAL_POSTGRES_LOCAL_EXPLORER_BRIDGE_READY '+port));
let stopping=false;
async function close(){if(stopping)return;stopping=true;server.close();await db.close();}
process.on('SIGTERM',()=>void close());
process.on('SIGINT',()=>void close());
