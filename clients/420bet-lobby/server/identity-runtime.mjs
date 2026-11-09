// BET-AUDIT-7: explicit production-equivalent Node service composition.
// The service FAILS TO START if any approved deployment/policy/provider binding
// is missing. It never fabricates a credential, RPC, approval or signed wallet.
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {createPublicClient,http,keccak256} from 'viem';
import {createWalletSignatureVerifier} from './wallet-signature-verifier.mjs';
import {createCanonicalIdentityEligibility} from './canonical-identity-eligibility.mjs';
import {createRemoteBetIdentityAuthority} from './identity-authority-provider.mjs';
import {createBetWalletSessions} from './wallet-identity-sessions.mjs';
import {createBetSessionHttpHandler} from './wallet-session-http.mjs';

const HEX=/^0x[0-9a-fA-F]{64}$/;
const UINT=/^[1-9][0-9]*$/;
function need(ok,message){if(!ok)throw Error(message);}
export function approvedSessionSettings(env){
 const keys=['BET_SESSION_ORIGIN','BET_SESSION_CHAIN_ID','BET_IDENTITY_RPC_URL','BET_IDENTITY_CONTRACT_ADDRESS',
  'BET_IDENTITY_RUNTIME_CODE_HASH','BET_IDENTITY_CREDENTIAL_TYPES','BET_IDENTITY_AUTHORITY_URL',
  'BET_IDENTITY_AUTHORITY_TOKEN','BET_IDENTITY_POLICY_VERSION','BET_IDENTITY_POLICY_APPROVAL_DIGEST',
  'BET_SESSION_BACKEND_TOKEN'];
 for(const key of keys)need(typeof env[key]==='string'&&env[key].length>0,'missing required Identity configuration: '+key);
 need(UINT.test(env.BET_SESSION_CHAIN_ID),'invalid Identity chain');
 need(HEX.test(env.BET_IDENTITY_RUNTIME_CODE_HASH)&&HEX.test(env.BET_IDENTITY_POLICY_APPROVAL_DIGEST),
  'invalid code or policy digest');
 const credentials=JSON.parse(env.BET_IDENTITY_CREDENTIAL_TYPES);
 need(Array.isArray(credentials)&&credentials.length>0&&credentials.length<=8&&credentials.every(x=>HEX.test(x)),
  'invalid approved credential manifest');
 need(env.BET_SESSION_BACKEND_TOKEN.length>=32&&env.BET_SESSION_BACKEND_TOKEN.length<=4096,
  'invalid backend auth secret');
 need(env.BET_IDENTITY_POLICY_APPROVAL_DIGEST!=='0x'+'0'.repeat(64),
  'missing independent policy approval digest');
 const port=Number(env.BET_SESSION_PORT??8788);
 need(Number.isSafeInteger(port)&&port>=1&&port<=65535,'invalid session port');
 const host=env.BET_SESSION_HOST??'127.0.0.1';
 need(host==='127.0.0.1'||host==='0.0.0.0','invalid session listener host');
 return Object.freeze({origin:env.BET_SESSION_ORIGIN,chainId:env.BET_SESSION_CHAIN_ID,
  rpcUrl:env.BET_IDENTITY_RPC_URL,identityAddress:env.BET_IDENTITY_CONTRACT_ADDRESS,
  runtimeHash:env.BET_IDENTITY_RUNTIME_CODE_HASH.toLowerCase(),
  credentialTypes:credentials,authorityUrl:env.BET_IDENTITY_AUTHORITY_URL,
  authorityToken:env.BET_IDENTITY_AUTHORITY_TOKEN,policyVersion:env.BET_IDENTITY_POLICY_VERSION,
  approvalDigest:env.BET_IDENTITY_POLICY_APPROVAL_DIGEST.toLowerCase(),
  backendToken:env.BET_SESSION_BACKEND_TOKEN,port,host});
}
export function createBetIdentityRuntime({settings,fetcher=fetch,publicClient}={}){
 need(settings&&typeof settings==='object','identity settings required');
 const client=publicClient??createPublicClient({transport:http(settings.rpcUrl,{timeout:10000,retryCount:0})});
 const remote=createRemoteBetIdentityAuthority({origin:settings.authorityUrl,
  bearerToken:settings.authorityToken,chainId:settings.chainId,policyVersion:settings.policyVersion,policyApprovalDigest:settings.approvalDigest,fetcher});
 const canonical=createCanonicalIdentityEligibility({rpcUrl:settings.rpcUrl,
  chainId:settings.chainId,identityAddress:settings.identityAddress,
  expectedRuntimeHash:settings.runtimeHash,hashRuntimeCode:code=>keccak256(code),
  credentialTypes:settings.credentialTypes,resolveSubjectId:remote.resolveSubjectId,
  verifyPolicy:remote.verifyPolicy,fetcher});
 const sessions=createBetWalletSessions({origin:settings.origin,chainId:settings.chainId,
  verifySignature:createWalletSignatureVerifier({publicClient:client,chainId:settings.chainId}),
  verifyIdentity:canonical.verifyIdentity});
 async function readiness(){
  const chain=await client.getChainId();
  if(!Number.isSafeInteger(chain)||BigInt(chain)!==BigInt(settings.chainId))return false;
  const response=await fetcher(settings.rpcUrl,{method:'POST',redirect:'error',
   credentials:'omit',cache:'no-store',
   headers:{'Content-Type':'application/json',Accept:'application/json'},
   body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_getCode',
    params:[settings.identityAddress.toLowerCase(),'latest']}),
   signal:AbortSignal.timeout(8000)});
  if(!response?.ok)return false;
  const text=await response.text();if(text.length>100000)return false;
  const data=JSON.parse(text);
  if(data?.jsonrpc!=='2.0'||data.id!==1||typeof data.result!=='string'||
    !/^0x(?:[0-9a-fA-F]{2})+$/.test(data.result)||data.result==='0x00'|| 
    keccak256(data.result).toLowerCase()!==settings.runtimeHash)return false;
  return remote.checkReadiness();
 }
 const handler=createBetSessionHttpHandler({origin:settings.origin,sessions,readiness});
 // Cloudflare proxy authentication is mandatory before exposing this handler.
 function authorized(request){
  const token=request.headers['x-bet-edge-secret'];
  if(typeof token!=='string'||token.length!==settings.backendToken.length)return false;
  return timingSafeEqual(Buffer.from(token),Buffer.from(settings.backendToken));
 }
 const httpHandler=(request,response)=>{
  if(!authorized(request)){
   response.writeHead(403,{'Content-Type':'application/json','Cache-Control':'no-store'});
   response.end('{"error":"upstream access denied"}');return;
  }
  void handler(request,response).catch(()=>{
   if(!response.headersSent){response.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});
    response.end('{"error":"identity unavailable"}');}
  });
 };
 return {httpHandler,sessionHandler:handler,sessions};
}
export function startBetIdentityServer({env=process.env}={}){
 const settings=approvedSessionSettings(env);
 const runtime=createBetIdentityRuntime({settings});
 const server=createServer(runtime.httpHandler);
 server.listen(settings.port,settings.host,()=>console.log('420Bet read-only Identity service configured on '+settings.port));
 return server;
}
