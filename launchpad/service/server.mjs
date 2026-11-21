import {Rpc} from './core/rpc.mjs';
import {ProjectionStore} from './core/projection.mjs';
import {createApp} from './core/app.mjs';
import {serveLaunchpad} from './core/http.mjs';
const rpcUrl=process.env.LAUNCHPAD_RPC_URL,chainId=process.env.LAUNCHPAD_CHAIN_ID,
  projectionPath=process.env.LAUNCHPAD_PROJECTION_FILE;
if(!rpcUrl||!chainId||!projectionPath)
  throw new Error('LAUNCHPAD_RPC_URL, LAUNCHPAD_CHAIN_ID and LAUNCHPAD_PROJECTION_FILE are required');
const dispatch=createApp({rpc:new Rpc(rpcUrl),projection:new ProjectionStore(projectionPath,chainId),chainId});
const port=Number(process.env.PORT||8787);
const server=serveLaunchpad(dispatch,port,{allowedOrigin:process.env.LAUNCHPAD_CORS_ORIGIN||''});
server.requestTimeout=10000;
server.headersTimeout=12000;
server.keepAliveTimeout=5000;
console.log('420Launchpad service listening on '+port);
