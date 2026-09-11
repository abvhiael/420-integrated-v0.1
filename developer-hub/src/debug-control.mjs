const HASH_RE=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS_RE=/^0x[0-9a-fA-F]{40}$/;
export class DebugControlError420 extends Error{constructor(message){super(message);this.name='DebugControlError420';}}
function assert420(c,m){if(!c)throw new DebugControlError420(m);}
function hash420(v){assert420(typeof v==='string'&&HASH_RE.test(v),'transaction hash is invalid');return v.toLowerCase();}
function address420(v){assert420(typeof v==='string'&&ADDRESS_RE.test(v),'address is invalid');return v.toLowerCase();}
function limit420(v,fallback=50){if(v===undefined)return fallback;assert420(Number.isInteger(v)&&v>=1&&v<=200,'limit must be an integer between 1 and 200');return v;}
export function createDebugClient420({network,indexer,rpc}){
 assert420(network&&typeof network.chainIdDecimal==='string','discovered network is required');
 assert420(indexer&&indexer.canonicalAuthority===false,'DEVHUB-11 indexer client is required');
 assert420(indexer.chainId===network.chainIdDecimal,'indexer/network chain mismatch');
 assert420(rpc&&typeof rpc.request==='function','canonical RPC adapter is required');
 async function canonicalReceipt420(txHash){const receipt=await rpc.request('eth_getTransactionReceipt',[txHash]);return receipt;}
 async function canonicalTransaction420(txHash){return rpc.request('eth_getTransactionByHash',[txHash]);}
 return Object.freeze({
  schemaVersion:'1.0.0',chainId:network.chainIdDecimal,source:'Developer Hub diagnostics',canonicalAuthority:false,
  transaction:async(txHash)=>{const hash=hash420(txHash);const [indexedTx,indexedReceipt,canonicalTx,canonicalReceipt]=await Promise.all([indexer.transaction(hash),indexer.receipt(hash),canonicalTransaction420(hash),canonicalReceipt420(hash)]);return Object.freeze({schemaVersion:'1.0.0',kind:'transaction-debug',chainId:network.chainIdDecimal,transactionHash:hash,canonicalAuthority:false,indexer:{source:'420Indexer',canonical:false,transaction:indexedTx,receipt:indexedReceipt},canonical:{source:'420-chain-rpc',transaction:canonicalTx,receipt:canonicalReceipt},rules:Object.freeze({indexerMayLag:true,canonicalReceiptRequiredForFinality:true})});},
  logs:async(options={})=>Object.freeze({schemaVersion:'1.0.0',kind:'log-query',chainId:network.chainIdDecimal,canonicalAuthority:false,source:'420Indexer',logs:await indexer.logs({address:options.address?address420(options.address):undefined,limit:limit420(options.limit),direction:options.direction??'desc'}),securityRule:'logs are indexed projections; revalidate security-sensitive conclusions against canonical RPC/contract state'}),
  protocolEvents:async(options={})=>Object.freeze({schemaVersion:'1.0.0',kind:'protocol-event-query',chainId:network.chainIdDecimal,canonicalAuthority:false,source:'420Indexer',events:await indexer.protocolEvents({protocol:options.protocol,objectKey:options.objectKey,limit:limit420(options.limit),direction:options.direction??'desc'}),securityRule:'protocol events are indexed projections and cannot authorize protocol transitions'}),
  diagnostics:async()=>Object.freeze({schemaVersion:'1.0.0',kind:'debug-diagnostics',chainId:network.chainIdDecimal,canonicalAuthority:false,indexer:await indexer.diagnostics(),rpc:{source:'420-chain-rpc',canonical:true,chainId:await rpc.request('eth_chainId',[])},boundaries:Object.freeze(['Indexer/search/log views are projections','RPC receipt and owning contracts remain canonical','Developer Hub never signs or mutates protocol state'])})
 });
}
export function createDebugControlView420(client){assert420(client&&client.schemaVersion==='1.0.0','DEVHUB-15 debug client is required');return Object.freeze({title:'Logs, events & debugging',chainId:client.chainId,canonicalAuthority:false,supported:['transaction-debug','logs','protocol-events','diagnostics'],securityRule:'diagnostic correlation cannot replace canonical chain/protocol authority'});}
