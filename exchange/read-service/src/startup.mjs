import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadCatalogue} from './catalogue.mjs';
import {IndexerHttpProjectionSource,RpcHealthSource} from './indexer-source.mjs';
import {FileProjectionStore} from './projection-store.mjs';
import {ExchangeReadService} from './service.mjs';
import {createExchangeReadHttpServer} from './http.mjs';

function integer(v,label,{min=0,max=65535}={}){if(!Number.isSafeInteger(v)||v<min||v>max)throw new Error('invalid '+label);return v;}
export function loadExchangeReadConfig(file){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));
  if(raw?.schema!=='420-exchange-read-service-config-v1')throw new Error('read-service config schema mismatch');
  if(typeof raw.indexerBaseUrl!=='string'||typeof raw.rpcUrl!=='string'||typeof raw.chainId!=='string')throw new Error('indexer/rpc/chain config required');
  return Object.freeze({
    schema:raw.schema,host:raw.host??'127.0.0.1',port:integer(raw.port??7420,'port',{min:0}),
    indexerBaseUrl:raw.indexerBaseUrl,rpcUrl:raw.rpcUrl,chainId:raw.chainId,
    cataloguePath:path.resolve(path.dirname(file),raw.cataloguePath),storagePath:path.resolve(path.dirname(file),raw.storagePath),
    refreshOnStart:raw.refreshOnStart!==false,shutdownTimeoutMs:integer(raw.shutdownTimeoutMs??5000,'shutdownTimeoutMs',{min:1,max:60000}),
  });
}
export async function composeExchangeReadService(config,{fetchImpl=globalThis.fetch}={}){
  const catalogue=loadCatalogue(config.cataloguePath),store=new FileProjectionStore(config.storagePath).open();
  const indexer=new IndexerHttpProjectionSource({baseUrl:config.indexerBaseUrl,chainId:config.chainId,fetchImpl});
  const rpc=new RpcHealthSource({url:config.rpcUrl,chainId:config.chainId,fetchImpl});
  const service=new ExchangeReadService({indexer,rpc,store,catalogue});
  if(config.refreshOnStart)await service.refresh();
  return {service,store};
}
export async function startExchangeReadService(config,{fetchImpl=globalThis.fetch,registerSignals=true}={}){
  const {service,store}=await composeExchangeReadService(config,{fetchImpl});
  const server=createExchangeReadHttpServer(service);
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(config.port,config.host,()=>{server.off('error',reject);resolve();});});
  let closing=false;
  const close=async()=>{if(closing)return;closing=true;await new Promise(resolve=>server.close(resolve));store.close();};
  if(registerSignals){for(const sig of ['SIGTERM','SIGINT'])process.once(sig,()=>{const timer=setTimeout(()=>process.exit(1),config.shutdownTimeoutMs);timer.unref();close().then(()=>{clearTimeout(timer);process.exit(0);});});}
  return Object.freeze({server,service,store,close,address:server.address()});
}
export const moduleDir=path.dirname(fileURLToPath(import.meta.url));
