#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadNetworkManifest420, discoverNetwork420 } from '../../../developer-hub/src/network-discovery.mjs';
import { createIndexerClient420 } from '../../../developer-hub/src/indexer-client.mjs';
import { createStatusAggregator420, createStatusControlView420 } from '../../../developer-hub/src/status-control.mjs';
const here=dirname(fileURLToPath(import.meta.url));const repoRoot=resolve(here,'../../..');
function fail(message){console.error(`420_STATUS_ERROR=${message}`);process.exit(1);}
function print(value){process.stdout.write(`${JSON.stringify(value,null,2)}\n`);}
async function network420(path){return discoverNetwork420(await loadNetworkManifest420(resolve(process.cwd(),path??resolve(repoRoot,'developer-hub/manifests/local.example.json'))));}
function indexer420(network){return createIndexerClient420({network,transport:{async request(endpoint,{method='GET'}={}){const response=await fetch(endpoint,{method,headers:{accept:'application/json'}});let body;try{body=await response.json();}catch{throw new Error(`420Indexer HTTP ${response.status} returned non-JSON`);}return {status:response.status,body};}}});}
function rpc420(network){const endpoint=network.rpc[0];return {async request(method,params=[]){const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});if(!response.ok)throw new Error(`RPC HTTP ${response.status}`);const body=await response.json();if(body.error)throw new Error(`RPC ${body.error.code}: ${body.error.message}`);return body.result;}};}
async function probe420(_name,endpoint){const response=await fetch(`${endpoint.replace(/\/$/,'')}/health`,{headers:{accept:'application/json'}});return {state:response.ok?'healthy':'degraded',live:response.status<500,ready:response.ok,detail:`health HTTP ${response.status}`};}
async function main(){const [command='view',manifest]=process.argv.slice(2);const network=await network420(manifest);if(command==='view')return print(createStatusControlView420(network));if(command==='check')return print(await createStatusAggregator420({network,rpc:rpc420(network),indexer:indexer420(network),serviceProbe:probe420}).snapshot());fail('usage: 420-status view|check [MANIFEST_JSON]');}
main().catch(error=>fail(error instanceof Error?error.message:String(error)));
