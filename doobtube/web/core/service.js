function baseURL(value,label){
  if(!value)throw Error(label+' URL unresolved');
  const u=new URL(value,globalThis.location?.href);
  const loop=['localhost','127.0.0.1','::1'].includes(u.hostname);
  if(u.protocol!=='https:'&&!(loop&&u.protocol==='http:'))throw Error(label+' requires HTTPS');
  if(u.username||u.password||u.hash)throw Error(label+' URL credentials/fragments forbidden');
  return u.toString().replace(/\/$/,'');
}
function bounded(value,max=512){const s=String(value??'').trim();if(s.length>max)throw Error('input too long');return s;}
async function json(response,label){
  const text=await response.text();
  if(text.length>2*1024*1024)throw Error(label+' response too large');
  let body;try{body=JSON.parse(text);}catch{throw Error('invalid '+label+' JSON');}
  if(!response.ok){const e=Error(body?.error?.message||label+' '+response.status);e.code=body?.error?.code||'UNAVAILABLE';e.status=response.status;throw e;}
  if(body?.version&&body.version!=='v1')throw Error(label+' API version mismatch');
  return Object.prototype.hasOwnProperty.call(body||{},'data')?body.data:body;
}
function idem(key){key=bounded(key,128);if(!key)throw Error('idempotency key required');return {'content-type':'application/json','Idempotency-Key':key};}
class Client{
  constructor(url,label,fetchImpl=globalThis.fetch){this.base=baseURL(url,label);this.label=label;this.fetch=fetchImpl;}
  async req(path,options={}){return json(await this.fetch(this.base+path,{cache:'no-store',headers:{accept:'application/json',...(options.headers||{})},...options}),this.label);}
}
export class DoobTubeService extends Client{
  constructor(args={}){super(args.baseUrl,'DoobTube',args.fetchImpl);}
  feed({cursor='',limit=24}={}){const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',bounded(cursor));return this.req('/v1/feed?'+q);}
  preferences(){return this.req('/v1/preferences');}
  savePreferences(payload,key){return this.req('/v1/preferences',{method:'PUT',headers:idem(key),body:JSON.stringify(payload)});}
}
export class MediaService extends Client{
  constructor(args={}){super(args.baseUrl,'420Media',args.fetchImpl);}
  capabilities(){return this.req('/v1/capabilities');}
  compatibility(){return this.req('/v1/compatibility');}
  assets({cursor='',limit=24}={}){const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',bounded(cursor));return this.req('/v1/assets?'+q);}
  asset(id){id=bounded(id);if(!id)throw Error('asset id required');return this.req('/v1/assets/'+encodeURIComponent(id));}
  search(query,{cursor='',limit=24}={}){const q=new URLSearchParams({q:bounded(query,160),limit:String(limit)});if(cursor)q.set('cursor',bounded(cursor));return this.req('/v1/search?'+q);}
  prepareUpload(payload,key){return this.req('/v1/uploads/prepare',{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
  async uploadBytes(endpoint,file){
    if(!(file instanceof Blob))throw Error('video file required');
    const u=new URL(endpoint);if(u.protocol!=='https:'||u.username||u.password)throw Error('unsafe upload endpoint');
    const r=await this.fetch(u.toString(),{method:'PUT',body:file,headers:{'content-type':file.type||'application/octet-stream'}});
    if(!r.ok)throw Error('upload transport '+r.status);return true;
  }
  createLive(payload,key){return this.req('/v1/livestreams',{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
  live(id,controller){return this.req('/v1/livestreams/'+encodeURIComponent(bounded(id))+'?controller='+encodeURIComponent(bounded(controller)));}
  liveAction(id,action,payload,key){if(!['start','stop'].includes(action))throw Error('invalid live action');return this.req('/v1/livestreams/'+encodeURIComponent(bounded(id))+'/'+action,{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
  subscribe(payload,key){return this.req('/v1/notifications/subscriptions',{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
  unsubscribe(id){return this.req('/v1/notifications/subscriptions/'+encodeURIComponent(bounded(id)),{method:'DELETE'});}
  report(payload,key){return this.req('/v1/moderation/reports',{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
  appeal(decisionId,payload,key){return this.req('/v1/moderation/decisions/'+encodeURIComponent(bounded(decisionId))+'/appeals',{method:'POST',headers:idem(key),body:JSON.stringify(payload)});}
}
export function safeMediaURL(value,base=globalThis.location?.href){
  const raw=String(value||'').trim();if(!raw)return null;
  try{const u=new URL(raw,base);const loop=['localhost','127.0.0.1','::1'].includes(u.hostname);
    if(u.username||u.password)return null;
    if(u.protocol==='https:'||u.protocol==='blob:'||(loop&&u.protocol==='http:'))return u.toString();
  }catch{}return null;
}
