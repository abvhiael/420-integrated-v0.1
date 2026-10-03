import http from 'node:http';
import {Rpc} from './core/rpc.mjs';
import {ProjectionStore} from './core/projection.mjs';
import {createApp} from './core/app.mjs';

const rpcUrl=process.env.LAUNCHPAD_RPC_URL;
const chainId=process.env.LAUNCHPAD_CHAIN_ID;
const projectionPath=process.env.LAUNCHPAD_PROJECTION_FILE;
if(!rpcUrl||!chainId||!projectionPath)throw new Error('LAUNCHPAD_RPC_URL, LAUNCHPAD_CHAIN_ID and LAUNCHPAD_PROJECTION_FILE are required');
const dispatch=createApp({rpc:new Rpc(rpcUrl),projection:new ProjectionStore(projectionPath),chainId});
const port=Number(process.env.PORT||8787);
http.createServer(async(req,res)=>{
  let body=null;
  if(req.method==='POST'){let raw='';for await(const chunk of req)raw+=chunk;if(raw.length>65536){res.writeHead(413);return res.end('payload too large');}body=raw?JSON.parse(raw):{};}
  const result=await dispatch({method:req.method,path:new URL(req.url,'http://localhost').pathname,body});
  res.writeHead(result.status,{'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*'});
  res.end(JSON.stringify(result.body));
}).listen(port,()=>console.log('420Launchpad service listening on '+port));
