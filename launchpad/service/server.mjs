import http from 'node:http';
import {Rpc} from './core/rpc.mjs';
import {ProjectionStore} from './core/projection.mjs';
import {createApp} from './core/app.mjs';

const rpcUrl=process.env.LAUNCHPAD_RPC_URL,chainId=process.env.LAUNCHPAD_CHAIN_ID,projectionPath=process.env.LAUNCHPAD_PROJECTION_FILE;
if(!rpcUrl||!chainId||!projectionPath)throw new Error('LAUNCHPAD_RPC_URL, LAUNCHPAD_CHAIN_ID and LAUNCHPAD_PROJECTION_FILE are required');
const dispatch=createApp({rpc:new Rpc(rpcUrl),projection:new ProjectionStore(projectionPath,chainId),chainId});
const port=Number(process.env.PORT||8787);
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-methods':'GET, POST, OPTIONS','access-control-allow-headers':'content-type'};
http.createServer(async(req,res)=>{
  if(req.method==='OPTIONS'){res.writeHead(204,headers);return res.end();}
  let body=null;
  try{
    if(req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536){res.writeHead(413,headers);return res.end(JSON.stringify({error:'payload too large'}));}}body=raw?JSON.parse(raw):{};}
    const result=await dispatch({method:req.method,path:new URL(req.url,'https://launchpad.invalid').pathname,body});
    res.writeHead(result.status,headers);res.end(JSON.stringify(result.body));
  }catch(error){res.writeHead(400,headers);res.end(JSON.stringify({error:error.message||'invalid request'}));}
}).listen(port,()=>console.log('420Launchpad service listening on '+port));
