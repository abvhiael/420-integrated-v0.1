// LOCAL TEST FIXTURE ONLY. Never expose this issuer on an internet-facing deployment.
import {createServer} from 'node:http';
export function createHighCountryLocalAuthHttp420({issuer,origin}={}){
 if(typeof issuer?.register!=='function'||typeof issuer?.login!=='function'||typeof issuer?.logout!=='function'||typeof origin!=='string')throw Error('local-auth-config-invalid');
 return createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':origin,'access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'POST,OPTIONS','vary':'Origin'});res.end(JSON.stringify(body));};
  if(req.headers.origin!==origin)return send(403,{error:'origin-denied'});
  if(req.method==='OPTIONS'){res.writeHead(204,{'access-control-allow-origin':origin,'access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'authorization,content-type','vary':'Origin'});return res.end();}
  if(req.method!=='POST')return send(405,{error:'method-denied'});
  const route=new URL(req.url,'http://localhost').pathname;
  if(!['/auth/register','/auth/login','/auth/logout'].includes(route))return send(404,{error:'not-found'});
  let raw='';
  try{
   if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))throw Error('invalid-request');
   for await(const piece of req){raw+=piece;if(raw.length>4096)throw Error('request-too-large');}
   const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error('invalid-request');
   if(route==='/auth/register'){if(Object.keys(body).sort().join(',')!=='password,username')throw Error('invalid-request');
     return send(201,{result:await issuer.register(body)});}
   if(route==='/auth/login'){if(Object.keys(body).sort().join(',')!=='password,username')throw Error('invalid-request');
     return send(200,{result:issuer.login(body)});}
   if(Object.keys(body).length)throw Error('invalid-request');
   const token=/^Bearer ([^\s]{1,4096})$/.exec(req.headers.authorization||'')?.[1];
   issuer.logout(token);return send(200,{result:{loggedOut:true}});
  }catch{return send(403,{error:'authentication-denied'});}
 });
}
