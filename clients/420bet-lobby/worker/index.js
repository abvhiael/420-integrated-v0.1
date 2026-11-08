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
export async function handle420BetWorker(request,env,ctx,{marqueeHandler=marquee,linesHandler=fetchBudgetedLines}={}){
 const url=new URL(request.url);
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
