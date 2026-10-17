import {createServer} from 'node:http';
import {normalizeCultivarName,screenName} from './cultivar-governance.mjs';
const reply=(res,status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));};
export function createCultivarGovernanceApi({auth,store,appointments,reviewer,price,entitlements,csrf,limit,bodyLimit=16384}) {
 if(![auth,store,appointments,reviewer,price,entitlements,csrf,limit].every(Boolean))throw Error('missing-security-dependency');
 return createServer(async(req,res)=>{
  try{
   if(!req.url?.startsWith('/admin/cultivars/')&&!req.url?.startsWith('/api/cultivars/'))return reply(res,404,{error:'not-found'});
   if(!['GET','POST'].includes(req.method))return reply(res,405,{error:'method'});
   const principal=await auth.authenticate(req);
   if(!principal?.id||!principal?.sessionId)return reply(res,401,{error:'unauthenticated'});
   if(!await limit.allow(principal.id,req.url))return reply(res,429,{error:'rate-limit'});
   const url=new URL(req.url,'http://localhost'),path=url.pathname;
   const admin=path.startsWith('/admin/');
   if(admin&&!await auth.authorized(principal,'cultivar-moderation:read'))return reply(res,403,{error:'forbidden'});
   let input={};
   if(req.method==='POST'){
    if(!await csrf.verify(req,principal))return reply(res,403,{error:'csrf'});
    const parts=[];let size=0;
    for await(const chunk of req){size+=chunk.length;if(size>bodyLimit)return reply(res,413,{error:'oversize'});parts.push(chunk);}
    input=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!input||typeof input!=='object'||Array.isArray(input))return reply(res,400,{error:'body'});
   }
   if(req.method==='GET'&&path==='/admin/cultivars/queue')return reply(res,200,{items:await store.assignedQueue(principal.id)});
   if(req.method==='GET'&&path==='/admin/cultivars/appointments')return reply(res,200,{items:await store.appointments(principal.id)});
   if(req.method==='GET'&&path==='/api/cultivars/quote')return reply(res,200,await price.currentQuote());
   if(req.method==='GET'&&path==='/api/cultivars/status')return reply(res,200,{usable:await entitlements.usable(url.searchParams.get('id'),principal)});
   if(req.method==='POST'&&path==='/admin/cultivars/appoint'){
    if(!await auth.authorized(principal,'cultivar-moderation:appoint'))return reply(res,403,{error:'forbidden'});
    return reply(res,201,{grantId:await appointments.appoint({...input,actor:principal.id})});
   }
   if(req.method==='POST'&&path==='/admin/cultivars/review'){
    if(!await auth.authorized(principal,'cultivar-moderation:review'))return reply(res,403,{error:'forbidden'});
    return reply(res,200,{decision:await reviewer.review({...input,reviewer:principal.id})});
   }
   if(req.method==='POST'&&path==='/api/cultivars/propose'){
    const named=screenName(input.name,{blocked:await store.blockedTerms(),heritage:await store.verifiedHeritage()});
    if(named.state==='REJECT')return reply(res,422,{error:'name-prohibited'});
    const result=await reviewer.submit({...input,owner:principal.id});
    return reply(res,202,{id:result.id,status:result.status});
   }
   return reply(res,404,{error:'route'});
  }catch(e){return reply(res,e instanceof SyntaxError?400:422,{error:'request-rejected'});}
 });
}
