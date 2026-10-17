import {createServer} from 'node:http';
import {validateDeploymentConfig,assessReadiness} from './deployment-security.mjs';
import {createDatabasePool} from './postgres-store.mjs';

const fail=code=>{throw Object.assign(new Error(code),{code})};
/**
 * Internal admitted runtime gateway. No public trip/payment paths are enabled:
 * independent production authorization and separately mounted services are required.
 * A TLS ingress must publish the admitted application only after external acceptance.
 */
export function createAdmittedRuntime({config,pool,host='127.0.0.1',port=8080,readiness=assessReadiness}){
 const attestation=validateDeploymentConfig(config);
 if(host!=='127.0.0.1'&&host!=='::1')fail('DEPLOY_BIND_DENIED');
 if(!Number.isSafeInteger(port)||port<0||port>65535)fail('DEPLOY_PORT_INVALID');
 if(typeof readiness!=='function'||typeof pool?.connect!=='function')fail('DEPLOY_DATABASE_UNAVAILABLE');
 let listening=false;
 const server=createServer(async(req,res)=>{
  const send=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','connection':'close'});res.end(JSON.stringify(body))};
  if(req.method!=='GET'||(req.url!=='/internal/live'&&req.url!=='/internal/ready'))return send(404,{error:'NOT_FOUND'});
  if(req.url==='/internal/live')return send(200,{live:true});
  try{
   const state=await readiness(pool);
   if(state?.ready!==true)return send(503,{ready:false});
   return send(200,{ready:true,releaseSha:attestation.releaseSha});
  }catch{return send(503,{ready:false})}
 });
 server.requestTimeout=config.limits.timeoutMs;
 server.headersTimeout=Math.min(config.limits.timeoutMs,15000);
 server.maxRequestsPerSocket=100;
 return Object.freeze({
  attestation,
  async start(){
   if(listening)fail('DEPLOY_ALREADY_STARTED');
   await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve()})});
   listening=true;return server.address();
  },
  async stop(){if(!listening)return;await new Promise((resolve,reject)=>server.close(e=>e?reject(e):resolve()));listening=false},
 });
}
export async function startAdmittedRuntime(config,{port=8080,host='127.0.0.1'}={}){
 validateDeploymentConfig(config);
 // pg-connection TLS is verified against the independently managed database CA.
 const pool=createDatabasePool({connectionString:config.databaseUrl,ssl:{rejectUnauthorized:true}});
 const runtime=createAdmittedRuntime({config,pool,host,port});
 try{await assessReadiness(pool);await runtime.start()}
 catch(e){await pool.end();throw e}
 return Object.freeze({runtime,async stop(){await runtime.stop();await pool.end()}});
}
