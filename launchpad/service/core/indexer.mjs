import fs from 'node:fs';
import path from 'node:path';
import {hexUtf8,wordHex,decodeAddress,decodeUint,decodeBool} from './abi.mjs';
import {readSale,call} from './consumer.mjs';
import {resolveLaunchpad} from './rpc.mjs';
import {ProjectionStore} from './projection.mjs';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const QUANTITY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const MODES=['NONE','REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER'];
function validNumber(value,label){if(!QUANTITY.test(value))throw new Error('invalid '+label);return BigInt(value);}
export async function reconstructProjection(rpc,{chainId,registryAddress='0x0000000000000000000000000000000000000434',
  fromBlock='0x0',maxScanBlocks=100000,chunkSize=1000,maxCampaigns=10000}={}){
  const [network,head,rt]=await Promise.all([
    rpc.call('eth_chainId',[]),rpc.call('eth_getBlockByNumber',['latest',false]),
    resolveLaunchpad(rpc,{registryAddress})
  ]);
  if(!head||!HASH.test(head.hash)||!QUANTITY.test(head.number)||network.toLowerCase()!==chainId?.toLowerCase())
    throw new Error('indexer canonical chain mismatch');
  const start=validNumber(fromBlock,'indexer start block'),end=validNumber(head.number,'indexer chain head');
  if(start>end||end-start>=BigInt(maxScanBlocks)||!Number.isSafeInteger(chunkSize)||chunkSize<1||chunkSize>2000)
    throw new Error('indexer scan exceeds bounded historical range');
  const eventTopic=await rpc.call('web3_sha3',[hexUtf8('SaleCreated(bytes32,bytes32,address,uint128,uint128,uint64,uint64)')]);
  if(!HASH.test(eventTopic))throw new Error('invalid sale event topic');
  const found=new Map(),blockCache=new Map();
  for(let from=start;from<=end;from+=BigInt(chunkSize)){
    const to=from+BigInt(chunkSize)-1n>end?end:from+BigInt(chunkSize)-1n;
    const logs=await rpc.call('eth_getLogs',[{
      address:rt.saleRegistryAddress,topics:[eventTopic],
      fromBlock:'0x'+from.toString(16),toBlock:'0x'+to.toString(16)
    }]);
    if(!Array.isArray(logs)||logs.length>maxCampaigns)throw new Error('invalid bounded Launchpad event inventory');
    for(const log of logs){
      const height=validNumber(log.blockNumber,'sale event height'),saleId=log.topics?.[1],
        projectId=log.topics?.[2];
      if(log.removed===true||height<from||height>to||!HASH.test(log.blockHash)||
        !HASH.test(log.transactionHash)||!QUANTITY.test(log.logIndex)||
        !HASH.test(saleId)||!HASH.test(projectId)||!Array.isArray(log.topics)||
        log.topics.length!==3||log.topics[0]?.toLowerCase()!==eventTopic.toLowerCase()||
        log.address?.toLowerCase()!==rt.saleRegistryAddress.toLowerCase()||
        found.has(saleId.toLowerCase()))throw new Error('malformed or replayed Launchpad sale event');
      const key=log.blockNumber.toLowerCase();
      let canonical=blockCache.get(key);
      if(!canonical){canonical=await rpc.call('eth_getBlockByNumber',[log.blockNumber,false]);blockCache.set(key,canonical);}
      if(!canonical||canonical.hash.toLowerCase()!==log.blockHash.toLowerCase()||
        BigInt(canonical.number)!==height)throw new Error('orphaned Launchpad sale event');
      found.set(saleId.toLowerCase(),{saleId,projectId});
      if(found.size>maxCampaigns)throw new Error('indexer campaign inventory limit exceeded');
    }
  }
  const items=[];
  for(const {saleId,projectId} of found.values()){
    const sale=await readSale(rpc,rt,saleId);
    if(sale.projectId.toLowerCase()!==projectId.toLowerCase())throw new Error('sale event differs from canonical Registry state');
    const [project,rawMode]=await Promise.all([
      call(rpc,rt.projectRegistryAddress,'project(bytes32)',[wordHex(projectId)]),
      call(rpc,rt.crowdfundingIntegrationAddress,'campaignMode(bytes32)',[wordHex(saleId)])
    ]);
    if(!decodeBool(project,5))throw new Error('sale references missing canonical project');
    const mode=MODES[Number(decodeUint(rawMode))];
    if(!mode||mode==='NONE')throw new Error('sale campaign mode unresolved');
    items.push({...sale,projectId,controller:decodeAddress(project,0),
      mode,title:'Campaign '+saleId.slice(2,10),summary:'Canonical on-chain campaign; external metadata not verified'});
  }
  const after=await rpc.call('eth_getBlockByNumber',['latest',false]);
  if(after?.hash?.toLowerCase()!==head.hash.toLowerCase()||
    after?.number?.toLowerCase()!==head.number.toLowerCase())
    throw new Error('chain head changed during projection reconstruction; retry');
  return {schema:'420-launchpad-projection-v1',canonical:true,
    source:{chainId:network,blockNumber:head.number,blockHash:head.hash,
      saleRegistryAddress:rt.saleRegistryAddress,projectRegistryAddress:rt.projectRegistryAddress},
    items:items.sort((a,b)=>a.saleId.localeCompare(b.saleId))};
}
export function saveProjectionAtomically(filename,snapshot){
  if(!filename||!path.isAbsolute(filename))throw new Error('absolute projection file required');
  const parent=path.dirname(filename),temp=path.join(parent,'.'+path.basename(filename)+'.'+process.pid+'.tmp');
  const data=JSON.stringify(snapshot)+'\n';
  if(Buffer.byteLength(data)>2097152)throw new Error('projection exceeds bounded file size');
  let fd;
  try{
    fd=fs.openSync(temp,'wx',0o600);
    fs.writeFileSync(fd,data,'utf8');fs.fsyncSync(fd);fs.closeSync(fd);fd=undefined;
    fs.renameSync(temp,filename);
    const dir=fs.openSync(parent,'r');try{fs.fsyncSync(dir);}finally{fs.closeSync(dir);}
  }finally{if(fd!==undefined)fs.closeSync(fd);try{fs.unlinkSync(temp);}catch(e){if(e.code!=='ENOENT')throw e;}}
}
export async function rebuildProjection(rpc,options){
  const projection=await reconstructProjection(rpc,options);
  const target=options?.file;
  saveProjectionAtomically(target,projection);
  const store=new ProjectionStore(target,options.chainId);
  await store.verify(rpc,{
    saleRegistryAddress:projection.source.saleRegistryAddress,
    projectRegistryAddress:projection.source.projectRegistryAddress
  });
  return {blockHash:projection.source.blockHash,blockNumber:projection.source.blockNumber,
    campaigns:projection.items.length};
}
