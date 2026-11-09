// 420Bet's actual Cloudflare Workers static-assets entrypoint.
// This is NOT a Cloudflare Pages Functions deployment.
// Only the two read-only sportsbook API paths run backend code. All other
// paths are delegated to the SAME static-assets bundle that serves 420Bet.
import {createMarqueeHandler} from '../server/sportsbook-provider.mjs';
export {SportsbookOddsBudget} from './odds-budget.js';

const marquee=createMarqueeHandler();
async function fetchBudgetedLines({request,env}){
 const ns=env?.SPORTSBOOK_ODDS_BUDGET;
 if(!ns)return apiError(503,'odds_budget_not_configured');
 try{
  const stub=typeof ns.getByName==='function'?ns.getByName('420bet-free-odds-v1'):
   ns.get(ns.idFromName('420bet-free-odds-v1'));
  return await stub.fetch(new Request('https://internal.invalid/internal/read-lines',{method:'GET'}));
 }catch{return apiError(503,'budgeted_odds_unavailable');}
}

// Protected 420Wallet/Identity proxy. Nothing is activated until the operator
// explicitly provisions an independently approved backend and enables it.
// The backend token is never returned to clients or forwarded from clients.
const SESSION_BASE='/api/420bet/session/';
function sessionConfigured(env){
 return env?.BET_IDENTITY_ENABLED==='true'&&
  typeof env?.BET_SESSION_BACKEND_URL==='string'&&
  typeof env?.BET_SESSION_BACKEND_TOKEN==='string'&&env.BET_SESSION_BACKEND_TOKEN.length>=32;
}
function sessionBackendUrl(env){
 try{
  const u=new URL(env.BET_SESSION_BACKEND_URL);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||
   !u.hostname)return null;
  return u.origin;
 }catch{return null;}
}
async function sessionProxy(request,env,fetcher=fetch){
 const url=new URL(request.url);
 const route=url.pathname.slice(SESSION_BASE.length);
 if(!['challenge','authenticate','status','revoke'].includes(route)||url.search)return apiError(404,'unknown_session_endpoint');
 if(request.method!=='POST')return apiError(405,'method_not_allowed');
 const sourceOrigin=url.origin;
 if(request.headers.get('Origin')!==sourceOrigin||request.headers.has('Cookie'))return apiError(403,'session_origin_denied');
 if(request.headers.get('Content-Type')!=='application/json')return apiError(400,'invalid_session_content');
 if(!sessionConfigured(env)||!sessionBackendUrl(env))return apiError(503,'identity_not_configured');
 const body=await request.text();
 if(body.length>4096)return apiError(413,'session_payload_too_large');
 const headers={'Content-Type':'application/json','Accept':'application/json','Origin':sourceOrigin,
  'X-Bet-Edge-Secret':env.BET_SESSION_BACKEND_TOKEN};
 for(const [input,output] of [['Authorization','Authorization'],['X-Bet-Account','X-Bet-Account'],
   ['X-Bet-Chain-Id','X-Bet-Chain-Id']]){
  const value=request.headers.get(input);
  if(value)headers[output]=value;
 }
 try{
  const result=await fetcher(sessionBackendUrl(env)+url.pathname,{
   method:'POST',redirect:'manual',headers,body,signal:AbortSignal.timeout(12000)});
  if(![200,400,401,403,405,413,429,503].includes(result.status)||
   !result.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
   return apiError(503,'identity_provider_unavailable');
  const text=await result.text();if(text.length>8192)return apiError(503,'identity_response_too_large');
  JSON.parse(text);
  return new Response(text,{status:result.status,headers:{'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'}});
 }catch{return apiError(503,'identity_provider_unavailable');}
}

const BASE='/api/420bet/sportsbook/';
export const SPORTSBOOK_WORKER_BUILD='sportsbook-worker-diagnostics-2026-11-08';
function diagnostics(env){
 // No outbound API calls, secret values, user identifiers or usage credits.
 return new Response(JSON.stringify({
  service:'420bet-sportsbook-worker',
  revision:SPORTSBOOK_WORKER_BUILD,
  workerRoutes:true,
  oddsApiSecretConfigured:typeof env?.THE_ODDS_API_KEY==='string'&&env.THE_ODDS_API_KEY.length>=16,
  oddsBudgetBindingConfigured:!!env?.SPORTSBOOK_ODDS_BUDGET,
  assetsBindingConfigured:typeof env?.ASSETS?.fetch==='function',
  marqueePath:BASE+'marquee',linesPath:BASE+'lines'
 }),{status:200,headers:{
  'Content-Type':'application/json; charset=utf-8',
  'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'
 }});
}
const apiError=(status,error)=>new Response(JSON.stringify({error}),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'}
});
export async function handle420BetWorker(request,env,ctx,{marqueeHandler=marquee,linesHandler=fetchBudgetedLines,sessionFetch=fetch}={}){
 const url=new URL(request.url);
 if(url.pathname.startsWith(SESSION_BASE)){
  if(url.pathname===SESSION_BASE+'capabilities'){
   if(request.method!=='GET'||url.search)return apiError(405,'invalid_session_capabilities_request');
   return new Response(JSON.stringify({readOnlyIdentityAvailable:Boolean(sessionConfigured(env)&&sessionBackendUrl(env))}),{
    status:200,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
  }
  return sessionProxy(request,env,sessionFetch);
 }
 if(url.pathname.startsWith(BASE)){
  if(url.pathname===BASE+'status'){
   if(request.method!=='GET'||url.search)return apiError(405,'invalid_status_request');
   return diagnostics(env);
  }
  if(url.pathname===BASE+'marquee')
   return marqueeHandler({request,env,waitUntil:ctx?.waitUntil?.bind(ctx)});
  if(url.pathname===BASE+'lines')
   return linesHandler({request,env,waitUntil:ctx?.waitUntil?.bind(ctx)});
  return apiError(404,'unknown_sportsbook_endpoint');
 }
 if(!env?.ASSETS||typeof env.ASSETS.fetch!=='function')
  return apiError(503,'static_assets_unavailable');
 return env.ASSETS.fetch(request);
}
export default {
 fetch(request,env,ctx){return handle420BetWorker(request,env,ctx);}
};
