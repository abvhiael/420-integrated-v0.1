// 420Bet's actual Cloudflare Workers static-assets entrypoint.
// This is NOT a Cloudflare Pages Functions deployment.
// Only the two read-only sportsbook API paths run backend code. All other
// paths are delegated to the SAME static-assets bundle that serves 420Bet.
import {createMarqueeHandler,cachedLines} from '../server/sportsbook-provider.mjs';

const marquee=createMarqueeHandler();
const BASE='/api/420bet/sportsbook/';
const apiError=(status,error)=>new Response(JSON.stringify({error}),{
 status,headers:{'Content-Type':'application/json; charset=utf-8',
 'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',
 'Referrer-Policy':'no-referrer'}
});
export async function handle420BetWorker(request,env,ctx,{marqueeHandler=marquee,linesHandler=cachedLines}={}){
 const url=new URL(request.url);
 if(url.pathname.startsWith(BASE)){
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
