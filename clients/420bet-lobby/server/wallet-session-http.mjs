// Optional same-origin HTTP boundary for BET-AUDIT-7 read-only wallet sessions.
// Caller must inject independently qualified signature and Identity policy providers.
// Not a production route, bearer store, gambling authorization, or a wallet signer.
const PATH='/api/420bet/session/';
const METHODS={challenge:'POST',authenticate:'POST',status:'POST',revoke:'POST'};
const MAX_BODY=4096;
export function createBetSessionHttpHandler({sessions,origin}={}){
 if(!sessions||!['challenge','authenticate','authorize','revoke'].every(k=>typeof sessions[k]==='function')||
  typeof origin!=='string'||new URL(origin).origin!==origin)throw Error('session server prerequisites missing');
 const send=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','Pragma':'no-cache','X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'no-referrer','Vary':'Origin'});res.end(JSON.stringify(data));};
 return async function handler(req,res){
  try{
   const url=new URL(req.url,'http://localhost'),route=url.pathname.startsWith(PATH)?url.pathname.slice(PATH.length):null;
   if(!Object.hasOwn(METHODS,route)||url.search||url.hash)return send(res,404,{error:'not found'});
   if(req.method!==METHODS[route])return send(res,405,{error:'method not allowed'});
   if(req.headers.origin!==origin)return send(res,403,{error:'origin denied'});
   if(req.headers.cookie)return send(res,403,{error:'cookies not accepted'});
   const content=req.headers['content-type'];
   const contentSize=Number(req.headers['content-length']??0);
   if(req.method==='POST'&&(content!=='application/json'||!Number.isSafeInteger(contentSize)||contentSize<0||contentSize>MAX_BODY))
    return send(res,400,{error:'invalid content'});
   let body={};
   if(req.method==='POST'){
    let size=0,chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>MAX_BODY)return send(res,413,{error:'payload too large'});chunks.push(chunk);}
    body=JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid request');
   }
   if(route==='challenge'){
    if(Object.keys(body).some(k=>!['account','chainId'].includes(k)))throw Error('invalid fields');
    return send(res,200,sessions.challenge({account:body.account,requestedChainId:body.chainId}));
   }
   if(route==='authenticate'){
    if(Object.keys(body).some(k=>!['account','chainId','nonce','signature'].includes(k)))throw Error('invalid fields');
    return send(res,200,await sessions.authenticate({account:body.account,requestedChainId:body.chainId,
     nonce:body.nonce,signature:body.signature}));
   }
   const auth=req.headers.authorization;
   if(typeof auth!=='string'||!/^Bearer [a-f0-9]{64}$/.test(auth))return send(res,401,{error:'session denied'});
   const account=req.headers['x-bet-account'],chainId=req.headers['x-bet-chain-id'];
   if(typeof account!=='string'||typeof chainId!=='string')return send(res,401,{error:'session denied'});
   const token=auth.slice(7);
   if(route==='status'){
    const result=await sessions.authorize({token,account,requestedChainId:chainId});
    return send(res,200,result);
   }
   await sessions.authorize({token,account,requestedChainId:chainId});
   sessions.revoke({token,account,requestedChainId:chainId});
   return send(res,200,{revoked:true});
  }catch{return send(res,401,{error:'session denied'});}
 };
}
