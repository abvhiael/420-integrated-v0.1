const JSON_TYPE='application/json';
export class IndexerSourceError extends Error{constructor(code,message){super(message);this.name='IndexerSourceError';this.code=code;}}
const fail=(c,m)=>{throw new IndexerSourceError(c,m);};
async function json(response){
  if(!response?.headers?.get?.('content-type')?.toLowerCase().includes(JSON_TYPE))fail('INDEXER_RESPONSE_INVALID','420Indexer response must be JSON');
  let body;try{body=await response.json();}catch{fail('INDEXER_RESPONSE_INVALID','invalid 420Indexer JSON');}
  if(!response.ok)fail('INDEXER_HTTP_ERROR',body?.error?.message??('420Indexer HTTP '+response.status));
  if(body?.apiVersion!=='v1')fail('INDEXER_VERSION_MISMATCH','420Indexer public API v1 required');
  return body.data;
}
export class IndexerHttpProjectionSource{
  constructor({baseUrl,chainId,fetchImpl=globalThis.fetch}={}){
    if(typeof baseUrl!=='string'||!/^https?:\/\//.test(baseUrl))throw new Error('indexer baseUrl required');
    if(typeof chainId!=='string'||!/^[1-9][0-9]*$/.test(chainId))throw new Error('decimal chainId required');
    if(typeof fetchImpl!=='function')throw new Error('fetch implementation required');
    this.baseUrl=baseUrl.replace(/\/$/,'');this.chainId=chainId;this.fetchImpl=fetchImpl;
  }
  async status(){
    return json(await this.fetchImpl(this.baseUrl+'/v1/status?chainId='+encodeURIComponent(this.chainId),{headers:{accept:JSON_TYPE},cache:'no-store'}));
  }
  async readiness(){
    return json(await this.fetchImpl(this.baseUrl+'/ready?chainId='+encodeURIComponent(this.chainId),{headers:{accept:JSON_TYPE},cache:'no-store'}));
  }
  async protocolEvents({protocol='420Exchange',cursor='',limit=200}={}){
    const u=new URL(this.baseUrl+'/v1/protocols/events');
    u.searchParams.set('chainId',this.chainId);u.searchParams.set('protocol',protocol);u.searchParams.set('limit',String(limit));u.searchParams.set('direction','desc');if(cursor)u.searchParams.set('cursor',cursor);
    return json(await this.fetchImpl(u,{headers:{accept:JSON_TYPE},cache:'no-store'}));
  }
}
export class RpcHealthSource{
  constructor({url,chainId,fetchImpl=globalThis.fetch}={}){
    if(typeof url!=='string'||!/^https?:\/\//.test(url))throw new Error('rpc url required');
    this.url=url;this.chainId=BigInt(chainId);this.fetchImpl=fetchImpl;this.id=0;
  }
  async health(){
    const r=await this.fetchImpl(this.url,{method:'POST',headers:{'content-type':JSON_TYPE},body:JSON.stringify({jsonrpc:'2.0',id:++this.id,method:'eth_chainId',params:[]})});
    if(!r.ok)fail('RPC_UNAVAILABLE','RPC health request failed');
    const body=await r.json();if(body.error)fail('RPC_UNAVAILABLE',body.error.message??'RPC error');
    if(BigInt(body.result)!==this.chainId)fail('RPC_CHAIN_MISMATCH','RPC chain differs from configured chain');
    return Object.freeze({ok:true,chainId:this.chainId.toString()});
  }
}
