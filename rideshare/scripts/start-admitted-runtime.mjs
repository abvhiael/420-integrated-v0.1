#!/usr/bin/env node
import {readFileSync,statSync} from 'node:fs';
import {startAdmittedRuntime} from '../src/admitted-runtime.mjs';
const path=process.env.LIFTD_RUNTIME_CONFIG_FILE;
if(path!=='/run/secrets/liftd-runtime-config')throw Error('MANAGED_CONFIG_REQUIRED');
const stat=statSync(path);
if(!stat.isFile()||(stat.mode&0o077)!==0||stat.size>16384)throw Error('MANAGED_CONFIG_PERMISSIONS');
const config=JSON.parse(readFileSync(path,'utf8'));
const server=await startAdmittedRuntime(config,{host:'127.0.0.1',port:8080});
let closing=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{if(closing)return;closing=true;void server.stop().then(()=>process.exit(0)).catch(()=>process.exit(1));});
