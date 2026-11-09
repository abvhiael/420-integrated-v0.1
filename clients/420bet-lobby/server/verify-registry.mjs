// Trusted read-only 420Registry verification, never a betting authorization.
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {createPublicClient,http} from 'viem';
import {createBetRegistryVerifier,assertIndexerRegistryBinding} from './registry-verifier.mjs';

function approvedRpc(raw){
 const url=new URL(raw);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
  !(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))))
  throw Error('420Registry RPC must use approved HTTPS or local test HTTP');
 return url.origin;
}
export async function verifyConfiguredRegistry({
 env=process.env,read=readFile,publicClient,indexerManifest
}={}){
 if(!env.BET_REGISTRY_MANIFEST||!env.BET_REGISTRY_TRUSTED_APPROVER||!env.BET_REGISTRY_RPC_URL)
  throw Error('approved registry manifest, signer and read-only RPC are required');
 const endpoint=approvedRpc(env.BET_REGISTRY_RPC_URL);
 const body=await read(env.BET_REGISTRY_MANIFEST,'utf8');
 if(body.length>300000)throw Error('registry manifest too large');
 const manifest=JSON.parse(body);
 const client=publicClient??createPublicClient({
  transport:http(endpoint,{timeout:12000,retryCount:0})
 });
 const verifier=createBetRegistryVerifier({manifest,client,
  trustedApprover:env.BET_REGISTRY_TRUSTED_APPROVER});
 const result=await verifier.verify();
 if(indexerManifest)assertIndexerRegistryBinding(indexerManifest,verifier.config);
 return {result,config:verifier.config};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const outcome=await verifyConfiguredRegistry();
 console.log(JSON.stringify({
  kind:'bet-registry-check',qualified:outcome.result.qualified,chainId:outcome.result.chainId,
  block:outcome.result.registryBlock,blockHash:outcome.result.registryBlockHash,
  revision:outcome.result.manifestRevision,gameCount:outcome.result.games.length,
  approvalDigest:outcome.result.approvalDigest
 }));
}
