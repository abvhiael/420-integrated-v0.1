import {createServer} from 'node:http';
import {projectionEnvelope420} from './service.js';
import {prepareAttentionTransaction420} from './transaction-review.js';
const JSON_HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const send=(res,status,body)=>{res.writeHead(status,JSON_HEADERS);res.end(JSON.stringify(body));};
const readBody=async req=>{let s='';for await(const c of req){s+=c;if(s.length>32768)throw new Error('request body too large');}let v;try{v=JSON.parse(s||'{}');}catch{throw new Error('invalid JSON');}if(!v||typeof v!=='object'||Array.isArray(v))throw new Error('object JSON required');return v;};
const decode=s=>{try{return decodeURIComponent(s);}catch{throw new Error('invalid path encoding');}};
export async function routeAttentionHttp420(service,method,urlString,body=null){
  const url=new URL(urlString,'http://attention.local'),path=url.pathname.replace(/\/+$/,'')||'/';const p=service.projection;
  if(method==='GET'&&path==='/health')return {status:200,body:{service:'420Attention',ok:true,authoritative:false}};
  if(method==='GET'&&path==='/v1/attention/runtime')return {status:200,body:{schema:'420-attention-runtime-v1',canonical:true,authoritative:false,chainId:'0x'+BigInt(service.config.chainId).toString(16),...service.config.contracts}};
  if(method==='GET'&&path==='/v1/attention/campaigns'){const limit=Math.min(Number(url.searchParams.get('limit')||service.config.projection.pageLimit),service.config.projection.maxPageLimit);if(!Number.isSafeInteger(limit)||limit<1)return {status:400,body:{error:{code:'invalid_request',message:'invalid limit'}}};const items=p.listCampaigns().slice(0,limit);return {status:200,body:projectionEnvelope420(service,{items,nextCursor:null})};}
  let m=/^\/v1\/attention\/campaigns\/([^/]+)$/.exec(path);if(method==='GET'&&m){const campaign=p.campaign(decode(m[1]));return campaign?{status:200,body:projectionEnvelope420(service,{campaign})}:{status:404,body:{error:{code:'not_found',message:'campaign not found'}}};}
  m=/^\/v1\/attention\/accounts\/([^/]+)$/.exec(path);if(method==='GET'&&m)return {status:200,body:projectionEnvelope420(service,p.account(decode(m[1])))};
  m=/^\/v1\/attention\/proofs\/([^/]+)$/.exec(path);if(method==='GET'&&m){const proof=p.proof(decode(m[1]));return proof?{status:200,body:projectionEnvelope420(service,{proof})}:{status:404,body:{error:{code:'not_found',message:'proof not found'}}};}
  m=/^\/v1\/attention\/rewards\/([^/]+)$/.exec(path);if(method==='GET'&&m){const reward=p.reward(decode(m[1]));return reward?{status:200,body:projectionEnvelope420(service,{reward})}:{status:404,body:{error:{code:'not_found',message:'reward not found'}}};}
  m=/^\/v1\/attention\/prepare\/([^/]+)$/.exec(path);if(method==='POST'&&m){try{return {status:200,body:prepareAttentionTransaction420(service.config,decode(m[1]),body??{},service.source())};}catch(e){return {status:400,body:{error:{code:'invalid_request',message:e.message}}};}}
  return {status:404,body:{error:{code:'not_found',message:'route not found'}}};
}
export function createAttentionHttpServer420(service){return createServer(async(req,res)=>{try{const body=req.method==='POST'?await readBody(req):null;const out=await routeAttentionHttp420(service,req.method||'GET',req.url||'/',body);send(res,out.status,out.body);}catch(e){send(res,400,{error:{code:'invalid_request',message:e.message}});}});}
