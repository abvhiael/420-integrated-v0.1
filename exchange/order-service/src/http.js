import http from 'node:http';
import {OrderPublicationError} from './order-store.js';

function json(res,status,body){const data=JSON.stringify(body);res.writeHead(status,{'content-type':'application/json','content-length':Buffer.byteLength(data),'x-420-exchange-orders-version':'1'});res.end(data);}
async function readJson(req,{maxBytes=32768}={}){
  let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>maxBytes)throw new OrderPublicationError('REQUEST_TOO_LARGE','request body too large');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new OrderPublicationError('INVALID_JSON','invalid JSON body');}
}
export function createOrderHttpHandler({store}={}){
  if(!store)throw new Error('order store required');
  return async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(req.method==='POST'&&url.pathname==='/v1/orders'){
        const body=await readJson(req);const result=await store.publish(body);
        return json(res,result.idempotent?200:201,{schema:'420-exchange-order-publication-response-v1',idempotent:result.idempotent,order:result.record});
      }
      const match=url.pathname.match(/^\/v1\/orders\/(0x[0-9a-fA-F]{64})$/);
      if(req.method==='GET'&&match)return json(res,200,{schema:'420-exchange-order-status-response-v1',order:store.status(match[1])});
      return json(res,404,{schema:'420-exchange-order-error-v1',code:'NOT_FOUND',message:'route not found'});
    }catch(error){
      const code=error?.code??'INTERNAL_ERROR';
      const status=code==='NOT_FOUND'?404:code==='REQUEST_TOO_LARGE'?413:code==='INTERNAL_ERROR'?500:400;
      return json(res,status,{schema:'420-exchange-order-error-v1',code,message:String(error?.message??'order service error')});
    }
  };
}
export function createOrderHttpServer({store}={}){return http.createServer(createOrderHttpHandler({store}));}
