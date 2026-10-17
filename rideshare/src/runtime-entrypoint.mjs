import {readFileSync} from 'node:fs';
import {startAdmittedRuntime} from './admitted-runtime.mjs';
const path=process.env.LIFTD_DEPLOY_CONFIG_FILE;
if(!path || !path.startsWith('/run/secrets/'))throw Error('DEPLOY_MANAGED_CONFIG_REQUIRED');
const config=JSON.parse(readFileSync(path,'utf8'));
const app=await startAdmittedRuntime(config,{host:'127.0.0.1',port:8080});
const shutdown=()=>{app.stop().finally(()=>process.exit(0))};
process.once('SIGTERM',shutdown);
process.once('SIGINT',shutdown);
