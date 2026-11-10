// Dedicated private backend. NEVER expose this process as a browser route.
// An approved reverse proxy must provide TLS, network isolation and logging.
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRpcCanonicalOwnershipSource,createBetOwnershipAuthority} from './ownership-authority.mjs';
import {createPrivateOwnerDirectories} from './ownership-directories.mjs';
import {createOwnershipHTTPHandler} from './ownership-http.mjs';
import {verifyConfiguredRegistry} from './verify-registry.mjs';
import {verifyIndexerManifest} from './indexer-event-reader.mjs';

const env=process.env;
const required=name=>{const value=env[name];if(!value)throw Error('420Bet ownership service: '+name+' required');return value;};
const manifest=verifyIndexerManifest(JSON.parse(await readFile(required('BET_INDEXER_EVENT_MANIFEST'),'utf8')));
const approved=await verifyConfiguredRegistry({env,indexerManifest:manifest});
if(approved.result.qualified!==true)throw Error('420Bet ownership service: Registry unqualified');
if(approved.config.chainId!==required('BET_OWNERSHIP_CHAIN_ID'))
 throw Error('420Bet ownership service: chain binding mismatch');
const wagerRegistry=approved.config.contracts.wagerRegistry.address;
const sources=manifest.contracts;
const canonicalSource=createRpcCanonicalOwnershipSource({
 chainId:approved.config.chainId,sources,rpcUrl:required('BET_OWNERSHIP_RPC_URL'),
 betRegistryAddress:wagerRegistry
 // Sportsbook always fails closed until a separately qualified real ticket
 // reader is connected. No architecture proposal is a live source.
});
const directories=createPrivateOwnerDirectories({
 chainId:approved.config.chainId,identityOrigin:required('BET_IDENTITY_AUTHORITY_URL'),
 identityToken:required('BET_IDENTITY_AUTHORITY_TOKEN'),
 consentOrigin:required('BET_NOTIFICATIONS_CONSENT_URL'),
 consentToken:required('BET_NOTIFICATIONS_CONSENT_TOKEN')
});
const authority=createBetOwnershipAuthority({
 chainId:approved.config.chainId,sources,canonicalSource,
 betRegistryAddress:wagerRegistry,
 verifyRegistry:()=>verifyConfiguredRegistry({env,indexerManifest:manifest}),
 resolveIdentity:directories.resolveIdentity,
 subscriptions:directories.subscriptions
});
const handler=createOwnershipHTTPHandler({authority,bearerToken:required('BET_OWNERSHIP_AUTHORITY_TOKEN')});
const host=env.BET_OWNERSHIP_BIND_HOST??'127.0.0.1';
if(!['127.0.0.1','::1','localhost'].includes(host))
 throw Error('420Bet ownership service: only private loopback binding allowed');
const port=Number(env.BET_OWNERSHIP_BIND_PORT??8448);
if(!Number.isSafeInteger(port)||port<1||port>65535)throw Error('invalid ownership listener port');
const server=createServer((req,res)=>{void handler(req,res).catch(()=>{
 if(!res.headersSent){res.writeHead(503,{'Cache-Control':'no-store'});res.end('unavailable');}
});});
await new Promise((resolve,reject)=>{
 server.once('error',reject);
 server.listen(port,host,()=>{server.off('error',reject);resolve();});
});
console.log(JSON.stringify({service:'420Bet private ownership authority',
 state:'listening',network:'loopback',chainId:approved.config.chainId,
 sportsbook:'unavailable-until-canonical-ticket-authority'}));
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{
 server.close(()=>{process.exitCode=0;});
});
