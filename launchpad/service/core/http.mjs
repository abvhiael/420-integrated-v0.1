import http from 'node:http';
const LIMIT=65536,WINDOW=60000,MAX_PER_WINDOW=120,MAX_INFLIGHT=32;
export function createHttpHandler(dispatch,{allowedOrigin='',maxBytes=LIMIT,now=()=>Date.now()}={}){
  if(allowedOrigin){
    const url=new URL(allowedOrigin);
    if(url.origin!==allowedOrigin||url.protocol!=='https:')throw new Error('LAUNCHPAD_CORS_ORIGIN must be an exact HTTPS origin');
  }
  const clients=new Map();let inflight=0;
  return async function handler(req,res){
    const base={'content-type':'application/json; charset=utf-8','cache-control':'no-store',
      'x-content-type-options':'nosniff','x-frame-options':'DENY','vary':'Origin'};
    const origin=req.headers.origin;
    const allowed=!origin||origin===allowedOrigin;
    if(origin&&allowed)base['access-control-allow-origin']=origin;
    const finish=(status,body)=>{
      if(res.writableEnded)return;
      res.writeHead(status,base);res.end(JSON.stringify(body));
    };
    if(!allowed)return finish(403,{error:'origin not permitted'});
    if(req.method==='OPTIONS'){
      base['access-control-allow-methods']='GET, POST, OPTIONS';
      base['access-control-allow-headers']='content-type';
      res.writeHead(204,base);return res.end();
    }
    if(!['GET','POST'].includes(req.method))return finish(405,{error:'method not permitted'});
    if(typeof req.url!=='string'||Buffer.byteLength(req.url)>2048)return finish(414,{error:'request URI too long'});
    if(Number(req.headers['content-length'])>maxBytes)return finish(413,{error:'payload too large'});
    if(req.method==='POST'&&!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))
      return finish(415,{error:'JSON content type required'});
    if(clients.size>5000)for(const [key,entry] of clients){if(now()-entry.start>WINDOW)clients.delete(key);}
    const ip=req.socket?.remoteAddress||'unknown',time=now(),prev=clients.get(ip);
    const entry=prev&&time-prev.start<WINDOW?prev:{start:time,count:0};
    entry.count++;clients.set(ip,entry);
    if(entry.count>MAX_PER_WINDOW)return finish(429,{error:'request rate limit exceeded'});
    if(inflight>=MAX_INFLIGHT)return finish(503,{error:'service at capacity'});
    inflight++;
    try{
      let raw=Buffer.alloc(0);
      for await(const chunk of req){
        raw=Buffer.concat([raw,chunk]);
        if(raw.length>maxBytes)return finish(413,{error:'payload too large'});
      }
      if(req.method==='GET'&&raw.length)return finish(400,{error:'GET body not permitted'});
      let body=null;
      if(req.method==='POST'){
        try{body=raw.length?JSON.parse(raw.toString('utf8')):{};}catch{return finish(400,{error:'malformed JSON'});}
        if(!body||Array.isArray(body)||typeof body!=='object')return finish(400,{error:'JSON object required'});
        const safe=(v,depth=0)=>{
          if(depth>12)return false;
          if(v&&typeof v==='object'){
            if(Object.keys(v).length>128)return false;
            return Object.entries(v).every(([k,x])=>k!=='__proto__'&&k!=='constructor'&&k!=='prototype'&&safe(x,depth+1));
          }
          return typeof v!=='string'||v.length<=8192;
        };
        if(!safe(body))return finish(400,{error:'invalid JSON structure'});
      }
      let url;
      try{url=new URL(req.url,'https://launchpad.invalid');}
      catch{return finish(400,{error:'invalid URL'});}
      const used=new Set();
      for(const [key] of url.searchParams){
        if(used.has(key))return finish(400,{error:'duplicate query parameter'});
        used.add(key);
        if(used.size>24)return finish(400,{error:'too many query parameters'});
      }
      const result=await dispatch({method:req.method,path:url.pathname,query:url.searchParams,body});
      if(!Number.isSafeInteger(result.status)||result.status<200||result.status>599)
        throw new Error('invalid dispatch status');
      finish(result.status,result.body);
    }catch{
      finish(503,{error:'Launchpad service temporarily unavailable'});
    }finally{inflight--;}
  };
}
export function serveLaunchpad(dispatch,port,options){
  if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('invalid listening port');
  const server=http.createServer(createHttpHandler(dispatch,options));
  return server.listen(port);
}
