import { createServer } from 'node:http';
import { Fault, requireThat, integer, keys } from './security.mjs';

export function commerceServer(service, auth, { origin, now = Date.now, rateLimit = 120 } = {}) {
  const rates=new Map(); let active=0;
  const server=createServer(async (req,res)=>{
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'",'X-Frame-Options':'DENY','Permissions-Policy':'camera=(), microphone=(), geolocation=(), payment=()','Referrer-Policy':'no-referrer',...(origin.startsWith('https:')?{'Strict-Transport-Security':'max-age=31536000'}:{})};
    let counted=false;
    const send=(status,value)=>{if(!res.writableEnded){res.writeHead(status,headers);res.end(JSON.stringify({schema:'420-commerce-api-v1',...value}));}};
    try {
      requireThat(active<32,'service_capacity',429); active++; counted=true;
      // Reverse proxy must NOT rewrite this using untrusted X-Forwarded-For.
      const key=req.socket.remoteAddress, window=Math.floor(now()/60000), rate=rates.get(key);
      for(const [k,v] of rates)if(v.window!==window)rates.delete(k);
      requireThat(rates.size<10000||rates.has(key),'rate_capacity',429);
      if(!rate||rate.window!==window)rates.set(key,{window,count:1});else {rate.count++;requireThat(rate.count<=rateLimit,'rate_limit',429);}
      requireThat(req.url.length<=2048&&!req.url.includes('%')&&!req.url.includes('..'),'invalid_path');
      const url=new URL(req.url,'http://commerce.internal'),path=url.pathname,method=req.method;
      requireThat(['GET','POST','PUT','PATCH'].includes(method),'method_not_allowed',405);
      if(req.headers.origin)requireThat(req.headers.origin===origin,'origin_mismatch',403);
      const query={}; for(const [k,v] of url.searchParams){requireThat(!Object.hasOwn(query,k),'duplicate_query');query[k]=v;}
      let raw=Buffer.alloc(0);
      const maximum=path.endsWith('/media')?5*1024*1024:65536;
      if(req.headers['content-length'])requireThat(Number(req.headers['content-length'])<=maximum,'body_size',413);
      for await(const chunk of req){requireThat(raw.length+chunk.length<=maximum,'body_size',413);raw=Buffer.concat([raw,chunk]);}
      if(method==='GET')requireThat(raw.length===0,'get_body');
      const publicPath=['/v1/health','/v1/storefronts','/v1/search','/v1/categories'].includes(path)||/^\/v1\/(storefronts|products|media)\/[^/]+$/.test(path)||/^\/v1\/products\/[a-f0-9]{64}\/availability$/.test(path);
      let actor=null;
      if(!publicPath && path!=='/v1/auth/challenge'){
        // Browser GET omits the forbidden Origin header. Same-origin Fetch plus
        // exact Host permits the signed origin binding; no cookie authorization.
        const browserOrigin=method==='GET'&&!req.headers.origin&&req.headers['sec-fetch-site']==='same-origin'&&req.headers.host===new URL(origin).host?origin:req.headers.origin;
        actor=await auth.authenticate(req.headers,method,req.url,raw,browserOrigin);
      }
      let input=null;
      if(raw.length&&!path.endsWith('/media')){requireThat(req.headers['content-type']==='application/json','content_type');try{input=JSON.parse(raw);}catch{throw new Fault('invalid_json');}}
      const pageInteger=(value,min,max)=>{requireThat(typeof value==='string'&&/^(0|[1-9][0-9]*)$/.test(value),'invalid_integer');return integer(Number(value),min,max);};
      const pagination=()=>{keys(query,['query','offset','limit','storeId','category']); const result={query:query.query??''}; if(query.offset!==undefined)result.offset=integer(Number(query.offset),0,100000);if(query.limit!==undefined)result.limit=pageInteger(query.limit,1,100);if(query.storeId)result.storeId=query.storeId;if(query.category)result.category=query.category;return result;};
      let data;
      if(path==='/v1/auth/challenge'&&method==='POST'){keys(input,['wallet']);data=auth.challenge(input.wallet);}
      else if(path==='/v1/health'&&method==='GET'){keys(query,[]);data=service.projection.health();}
      else if(path==='/v1/storefronts'&&method==='GET')data=service.publicStores(pagination());
      else if(path==='/v1/search'&&method==='GET')data=service.search(pagination());
      else if(path==='/v1/categories'&&method==='GET'){keys(query,[]);data=service.globalCategories();}
      else if(/^\/v1\/products\/[a-f0-9]{64}\/availability$/.test(path)&&method==='GET'){keys(query,[]);data=await service.availability(path.split('/')[3]);}
      else if(/^\/v1\/storefronts\/[^/]+$/.test(path)&&method==='GET'){keys(query,[]);data=service.publicStore(path.split('/').at(-1));}
      else if(/^\/v1\/products\/[^/]+$/.test(path)&&method==='GET'){keys(query,[]);data=service.search({productId:path.split('/').at(-1)});requireThat(data.items.length,'not_found',404);}
      else if(/^\/v1\/media\/[^/]+$/.test(path)&&method==='GET'){keys(query,[]);const media=service.publicMedia(path.split('/').at(-1));res.writeHead(200,{...headers,'Content-Type':media.content_type});res.end(Buffer.from(media.content));return;}
      else {
        const notificationFeed=method==='GET'&&/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/notifications$/.test(path);
        const analyticsPage=method==='GET'&&/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/analytics$/.test(path);
        keys(query,notificationFeed?['limit','cursor']:analyticsPage?['offset','limit']:[]);
        const parts=path.split('/'),storeId=parts[4],action=parts[5];
        if(/^\/v1\/merchant\/identity\/0x[a-f0-9]{64}$/.test(path)&&method==='GET')data=await service.identity(actor,parts[4]);
        else if(path==='/v1/merchant/registration'&&method==='POST')data=await service.registration(actor,input);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders$/.test(path)&&method==='GET')data=await service.merchantOperations(actor,storeId,{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/disputes$/.test(path)&&method==='GET')data=await service.merchantDisputes(actor,storeId);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/notifications\/preferences$/.test(path)&&method==='GET'){keys(query,[]);data=await service.merchantNotificationPreferences(actor,storeId);}
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/notifications\/preferences$/.test(path)&&method==='POST')data=await service.merchantNotificationPreferences(actor,storeId,input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/notifications$/.test(path)&&method==='GET'){keys(query,['limit','cursor']);data=await service.merchantNotifications(actor,storeId,{limit:query.limit===undefined?25:pageInteger(query.limit,1,100),cursor:query.cursor??null});}
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/notifications\/[a-f0-9]{64}\/read$/.test(path)&&method==='POST')data=await service.merchantNotificationRead(actor,storeId,parts[7],input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/refunds$/.test(path)&&method==='GET')data=await service.merchantRefunds(actor,storeId);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/analytics$/.test(path)&&method==='GET')data=await service.merchantAnalytics(actor,storeId,{offset:query.offset===undefined?0:pageInteger(query.offset,0,Number.MAX_SAFE_INTEGER),limit:query.limit===undefined?100:pageInteger(query.limit,1,100)});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/integrations$/.test(path)&&method==='GET')data=await service.merchantIntegrations(actor,storeId);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders\/[a-f0-9]{64}\/arbitration\/prepare$/.test(path)&&method==='POST')data=await service.merchantArbitrationPrepare(actor,storeId,parts[7],input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders\/[a-f0-9]{64}\/arbitration\/bind$/.test(path)&&method==='POST')data=await service.merchantArbitrationBind(actor,storeId,parts[7],input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders\/[a-f0-9]{64}\/arbitration\/evidence$/.test(path)&&method==='POST')data=await service.merchantArbitrationAction(actor,storeId,parts[7],'submitEvidence',input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders\/[a-f0-9]{64}\/arbitration\/appeal$/.test(path)&&method==='POST')data=await service.merchantArbitrationAction(actor,storeId,parts[7],'appeal',input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/operations\/orders\/[a-f0-9]{64}\/(refund|dispute)$/.test(path)&&method==='POST')data=await service.merchantRemedy(actor,storeId,parts[7],parts[8],input??{});
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/listings\/0x[a-f0-9]{64}$/.test(path)&&method==='GET')data=await service.merchantListing(actor,storeId,parts[6]);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/products\/[a-f0-9]{64}\/listing-plan$/.test(path)&&method==='POST')data=await service.listingPlan(actor,storeId,parts[6],input);
        else if(path==='/v1/merchant/storefronts'&&method==='POST')data=await service.createStore(actor,input);
        else if(parts[1]==='v1'&&parts[2]==='merchant'&&parts[3]==='storefronts'&&parts.length===5){if(method==='GET')data=await service.draft(actor,storeId);else if(method==='PATCH')data=await service.updateStore(actor,storeId,input);else throw new Fault('method_not_allowed',405);}
        else if(parts[1]==='v1'&&parts[2]==='merchant'&&parts[3]==='storefronts'&&parts.length===6&&method==='GET')data=action==='builder'?await service.builder(actor,storeId):await service.section(actor,storeId,action);
        else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/media\/[a-f0-9]{64}$/.test(path)&&method==='GET')data=await service.privateMedia(actor,storeId,parts[6]);
        else if(parts[1]==='v1'&&parts[2]==='merchant'&&parts[3]==='storefronts'&&parts.length===6&&method==='POST'){
          if(action==='branding')data=await service.branding(actor,storeId,input);
          else if(action==='delegates')data=await service.delegate(actor,storeId,input);
          else if(action==='categories')data=await service.category(actor,storeId,input);
          else if(action==='products')data=await service.product(actor,storeId,input);
          else if(action==='media')data=await service.upload(actor,storeId,raw,req.headers['content-type']);
          else throw new Fault('not_found',404);
        } else if(/^\/v1\/merchant\/storefronts\/[a-f0-9]{64}\/products\/[a-f0-9]{64}\/variants$/.test(path)&&method==='POST')data=await service.variant(actor,storeId,parts[6],input);
        else if(path==='/v1/carts'&&method==='POST')data=service.cart(actor,input);
        else if(path==='/v1/checkout/prepare'&&method==='POST')data=await service.prepare(actor,input);
        else if(/^\/v1\/checkout\/[a-f0-9]{64}$/.test(path)&&method==='GET')data=await service.status(actor,parts[3]);
        else if(/^\/v1\/checkout\/[a-f0-9]{64}\/delivery$/.test(path)){if(method==='GET')data=await service.readDelivery(actor,parts[3]);else if(method==='PUT')data=await service.putDelivery(actor,parts[3],input);else throw new Fault('method_not_allowed',405);}
        else throw new Fault('not_found',404);
      }
      send(200,{data});
    } catch(error){const known=error instanceof Fault;const conflict=String(error.code).startsWith('SQLITE_CONSTRAINT');send(known?error.status:conflict?409:503,{error:{code:known?error.code:conflict?'constraint_conflict':'service_unavailable'}});}
    finally{if(counted)active--;}
  });
  server.requestTimeout=10000;server.headersTimeout=10000;server.keepAliveTimeout=5000;server.maxHeadersCount=40;
  return server;
}
