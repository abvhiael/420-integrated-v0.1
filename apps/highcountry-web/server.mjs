import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateHighCountryRuntime} from './src/runtime.js';
const here=fileURLToPath(new URL('.',import.meta.url));
const root=resolve(here,'dist');
export function createHighCountryServer({config,distRoot=root}={}){
 const runtime=validateHighCountryRuntime(config);
 return createServer(async(req,res)=>{
  const send=(code,body,type='text/plain')=>{res.writeHead(code,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'self'; connect-src 'self' "+(runtime.mode==='connected'?runtime.rpcUrl+' '+runtime.apiUrl:'')+"; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",'referrer-policy':'no-referrer'});res.end(body);};
  if(req.method!=='GET'&&req.method!=='HEAD')return send(405,'Method not allowed');
  let path;
  try{path=new URL(req.url,'http://localhost').pathname;}catch{return send(400,'Bad path');}
  if(path==='/runtime-config.json')return send(200,JSON.stringify(config),'application/json');
  if(path==='/'||['/play','/account','/settings','/about'].includes(path))path='/index.html';
  const resolved=resolve(distRoot,'.'+decodeURIComponent(path));
  if(resolved!==distRoot&&!resolved.startsWith(distRoot+sep))return send(403,'Forbidden');
  try{
   const data=await readFile(resolved);
   const type=({'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json'}[extname(resolved)]||'application/octet-stream');
   return send(200,req.method==='HEAD'?'':data,type);
  }catch{return send(404,'Not found');}
 });
}
if(process.argv[1]&&resolve(process.argv[1])===resolve(fileURLToPath(import.meta.url))){
 const configPath=process.env.HIGHCOUNTRY_RUNTIME_CONFIG;
 if(!configPath)throw Error('HIGHCOUNTRY_RUNTIME_CONFIG required; no production mocks');
 const config=JSON.parse(await readFile(resolve(configPath),'utf8'));
 const port=Number(process.env.PORT||4174);
 if(!Number.isInteger(port)||port<1||port>65535)throw Error('invalid-port');
 createHighCountryServer({config}).listen(port,'127.0.0.1',()=>console.log('High Country shell ready on '+port));
}
