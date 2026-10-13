// Deployment entry point. Mount reviewed configuration and CA separately; never load player signing keys.
import {readFile} from 'node:fs/promises';
import pg from 'pg';
import {FinalizedRpc} from './finalized-rpc.js';
import {createRuntime,runtimeHttpServer} from './runtime-service.js';
const required=name=>{const x=process.env[name];if(!x)throw Error(name+' required');return x;};
const config=JSON.parse(await readFile(required('HC_RUNTIME_CONFIG_FILE'),'utf8'));
const port=Number(required('PORT'));
if(!Number.isSafeInteger(port)||port<1||port>65535||!/^https:\/\//.test(config.authority?.origin))
 throw Error('reviewed HTTPS origin and valid port required');
const pool=new pg.Pool({connectionString:required('HC_DATABASE_URL'),max:8,
 ssl:{ca:await readFile(required('HC_DATABASE_CA_FILE'),'utf8'),rejectUnauthorized:true}});
try {
 const signerRpc=new FinalizedRpc(config.signerRpc);
 const runtime=await createRuntime({...config,pool,signerRpc});
 const server=runtimeHttpServer(runtime,{origin:config.authority.origin});
 server.listen(port,'0.0.0.0');
 let closing=false;
 const drain=()=>{if(closing)return;closing=true;server.close(async()=>{await pool.end();process.exit(0);});};
 process.on('SIGTERM',drain);process.on('SIGINT',drain);
}catch(error){await pool.end();throw error;}
