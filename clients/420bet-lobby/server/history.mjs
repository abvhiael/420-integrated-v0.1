import {normalizeAccount} from '../src/wallet.js';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const UINT=/^(0|[1-9][0-9]*)$/;
const gameKey=/^[a-z][a-z0-9-]{0,49}$/;
function fail(message){throw new Error(message);}
function requireUint(value){if(typeof value!=='string'||!UINT.test(value))fail('invalid indexer integer');return BigInt(value);}
function validOrigin(raw){const url=new URL(raw);if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1'].includes(url.hostname))fail('indexer URL must be HTTPS or loopback HTTP');return url;}
export function createGameHistoryLookup({indexerUrl,chainId,gameContracts,fetcher=fetch}={}){
 if(!Number.isSafeInteger(chainId)||chainId<1||!gameContracts||typeof gameContracts!=='object')fail('invalid game history configuration');
 const base=validOrigin(indexerUrl);
 const mapping=new Map(),all=new Set();
 for(const [id,contracts] of Object.entries(gameContracts)){if(!gameKey.test(id)||!Array.isArray(contracts)||!contracts.length)fail('invalid game contracts');const set=new Set(contracts.map(normalizeAccount));if(set.has(null)||set.size!==contracts.length||[...set].some(x=>all.has(x)))fail('invalid or shared game contract');for(const x of set)all.add(x);mapping.set(id,set);}
 if(!mapping.size)fail('no approved game contract bindings');
 const get=async(path,params)=>{const url=new URL(path,base);for(const [k,v] of Object.entries(params))url.searchParams.set(k,String(v));const response=await fetcher(url.href,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',headers:{Accept:'application/json'}});if(!response.ok)fail('indexer unavailable');const envelope=await response.json();if(envelope?.apiVersion!=='v1'||!envelope.data||typeof envelope.data!=='object')fail('invalid indexer response');return envelope.data;};
 return async({account,requestedChainId,gameId}={})=>{
   const wallet=normalizeAccount(account),contracts=mapping.get(gameId);
   if(!wallet||requestedChainId!==chainId||!contracts)fail('history scope denied');
   const status=await get('/v1/status',{chainId});
   if(status.chainId!==String(chainId)||status.authoritative!==false||status.runtime?.stale===true||status.finality?.safeHead==null)fail('indexer finality unavailable');
   const safeHead=requireUint(status.finality.safeHead);
   const page=await get('/v1/transactions',{chainId,address:wallet,limit:100,direction:'desc'});
   if(!Array.isArray(page.items)||page.items.length>100)fail('invalid transaction page');
   const entries=[],seen=new Set();
   for(const tx of page.items){
     if(!tx||tx.chainId!==String(chainId)||normalizeAccount(tx.from)!==wallet||!contracts.has(normalizeAccount(tx.to))||typeof tx.hash!=='string'||!HASH.test(tx.hash)||seen.has(tx.hash.toLowerCase()))continue;
     if(requireUint(tx.blockNumber)>safeHead)continue;
     const receipt=await get('/v1/transactions/'+tx.hash+'/receipt',{chainId});
     if(receipt.chainId!==String(chainId)||receipt.transactionHash.toLowerCase()!==tx.hash.toLowerCase()||receipt.blockHash!==tx.blockHash||receipt.blockNumber!==tx.blockNumber||![0,1].includes(receipt.status))fail('receipt provenance mismatch');
     const block=await get('/v1/blocks/'+tx.blockNumber,{chainId});
     if(block.chainId!==String(chainId)||block.hash!==tx.blockHash||block.number!==tx.blockNumber)fail('block provenance mismatch');
     const timestamp=requireUint(block.timestamp);
     if(timestamp>BigInt(Number.MAX_SAFE_INTEGER))fail('timestamp out of bounds');
     seen.add(tx.hash.toLowerCase());
     entries.push({account:wallet,chainId,gameId,hash:tx.hash,status:receipt.status===1?'confirmed':'failed',game:gameId,timestamp:Number(timestamp)});
   }
   return entries;
 };
}
export function createGameHistoryHandler(lookup){
 return async(req,res)=>{
   const send=(status,payload)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(payload));};
   if(req.method!=='GET')return send(405,{error:'method not allowed'});
   let url;try{url=new URL(req.url,'http://localhost');}catch{return send(400,{error:'invalid request'});}
   if(url.pathname!=='/api/420bet/player-history'||[...url.searchParams.keys()].some(k=>!['account','chainId','gameId'].includes(k)))return send(404,{error:'not found'});
   const chain=Number(url.searchParams.get('chainId'));
   if(!Number.isSafeInteger(chain)||chain<=0)return send(400,{error:'invalid chain'});
   try{send(200,await lookup({account:url.searchParams.get('account'),requestedChainId:chain,gameId:url.searchParams.get('gameId')}));}
   catch{send(503,{error:'verified game history unavailable'});}
 };
}
