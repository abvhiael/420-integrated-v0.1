import {createServer} from 'node:http';
const deny=c=>{throw Object.assign(new Error(c),{code:c});};
export function highCountryRoutineHttpServer420(authority,{origin}={}){
 if(typeof authority?.invoke!=='function'||typeof origin!=='string'||
 !/^https:\/\/[^/?#]+$/.test(origin))deny('r066-http-config-invalid');
 return createServer(async(req,res)=>{
  res.setHeader('content-type','application/json');res.setHeader('cache-control','no-store');
  res.setHeader('x-content-type-options','nosniff');res.setHeader('vary','Origin');
  if(req.headers.origin===origin){
   res.setHeader('access-control-allow-origin',origin);
   res.setHeader('access-control-allow-methods','POST,OPTIONS');
   res.setHeader('access-control-allow-headers','authorization,content-type');
  }
  if(req.method==='OPTIONS'&&req.headers.origin===origin){res.statusCode=204;return res.end();}
  try{
   if(req.method!=='POST'||req.url!=='/v1/routine/execute'||
    (req.headers.origin&&req.headers.origin!==origin)||
    !/^Bearer [^\s]{1,4096}$/.test(req.headers.authorization??'')||
    !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type']??''))
    deny('r066-http-denied');
   let raw='',size=0;for await(const data of req){size+=data.length;
    if(size>16384)deny('r066-http-too-large');raw+=data;}
   let body;try{body=JSON.parse(raw);}catch{deny('r066-http-json-invalid');}
   if(!body||typeof body!=='object'||Array.isArray(body)||
    Object.keys(body).sort().join(',')!=='action,body,escalation,operation,sessionId')
    deny('r066-http-shape-invalid');
   const result=await authority.invoke({...body,token:req.headers.authorization.slice(7)});
   res.end(JSON.stringify({ok:true,result:result??null}));
  }catch(e){res.statusCode=e?.code?.endsWith('-unavailable')?503:e?.code?.startsWith('r066-')?403:503;
   res.end(JSON.stringify({ok:false,error:res.statusCode===403?e.code:'routine-service-unavailable'}));}
 });
}
