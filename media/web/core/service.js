function cleanBase(value){return String(value||'').replace(/\/$/,'');}
function boundedText(value,max=512){const v=String(value??'').trim();if(v.length>max)throw new Error('input too long');return v;}
function envelope(payload){
  if(!payload||payload.version!=='v1'||!Object.prototype.hasOwnProperty.call(payload,'data'))throw new Error('untrusted Media API envelope');
  return payload.data;
}
async function parseJSON(response){
  const text=await response.text();
  if(text.length>2*1024*1024)throw new Error('Media response too large');
  let payload;
  try{payload=JSON.parse(text);}catch{throw new Error('invalid Media JSON response');}
  if(!response.ok){
    const code=payload?.error?.code||'unavailable';
    const message=payload?.error?.message||('Media API '+response.status);
    const error=new Error(message);error.code=code;error.status=response.status;throw error;
  }
  return envelope(payload);
}
function idempotencyHeaders(key){
  key=boundedText(key,128);
  if(!key)throw new Error('idempotency key required');
  return {'content-type':'application/json','idempotency-key':key};
}
export class MediaService{
  constructor({baseUrl,fetchImpl=globalThis.fetch}={}){
    if(!baseUrl)throw new Error('Media API URL unresolved');
    const u=new URL(baseUrl,globalThis.location?.href);
    const loopback=['localhost','127.0.0.1','::1'].includes(u.hostname);
    if(u.protocol!=='https:'&&!(loopback&&u.protocol==='http:'))throw new Error('Media API requires HTTPS');
    if(u.username||u.password)throw new Error('Media API URL may not contain credentials');
    this.baseUrl=cleanBase(u.toString());this.fetch=fetchImpl;
  }
  async _request(path,options={}){
    const response=await this.fetch(this.baseUrl+path,{cache:'no-store',...options});
    return parseJSON(response);
  }
  capabilities(){return this._request('/v1/capabilities');}
  compatibility(){return this._request('/v1/compatibility');}
  assets({cursor='',limit=24}={}){
    if(!Number.isInteger(limit)||limit<1||limit>200)throw new Error('invalid asset page limit');
    const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',boundedText(cursor));
    return this._request('/v1/assets?'+q);
  }
  asset(id){id=boundedText(id);if(!id)throw new Error('asset id required');return this._request('/v1/assets/'+encodeURIComponent(id));}
  prepareUpload(payload,key){
    return this._request('/v1/uploads/prepare',{method:'POST',headers:idempotencyHeaders(key),body:JSON.stringify(payload)});
  }
  async uploadBytes(endpoint,file,{signal}={}){
    if(!(file instanceof Blob))throw new Error('upload file required');
    const u=new URL(endpoint,globalThis.location?.href);
    const loopback=['localhost','127.0.0.1','::1'].includes(u.hostname);
    if(u.protocol!=='https:'&&!(loopback&&u.protocol==='http:'))throw new Error('unsafe upload endpoint');
    if(u.username||u.password)throw new Error('upload endpoint may not contain credentials');
    const response=await this.fetch(u.toString(),{method:'PUT',body:file,signal,headers:{'content-type':file.type||'application/octet-stream'}});
    if(!response.ok)throw new Error('upload transport '+response.status);
    return true;
  }
  createLivestream(payload,key){
    return this._request('/v1/livestreams',{method:'POST',headers:idempotencyHeaders(key),body:JSON.stringify(payload)});
  }
  livestream(id,controller){
    id=boundedText(id);controller=boundedText(controller);
    if(!id||!controller)throw new Error('livestream id and controller required');
    return this._request('/v1/livestreams/'+encodeURIComponent(id)+'?controller='+encodeURIComponent(controller));
  }
  livestreamAction(id,action,payload,key){
    if(!['start','stop'].includes(action))throw new Error('unsupported livestream action');
    id=boundedText(id);if(!id)throw new Error('livestream id required');
    return this._request('/v1/livestreams/'+encodeURIComponent(id)+'/'+action,{method:'POST',headers:idempotencyHeaders(key),body:JSON.stringify(payload)});
  }
}
export function safeMediaURL(value,base=globalThis.location?.href){
  value=String(value||'').trim();if(!value)return null;
  try{
    const u=new URL(value,base);
    const loopback=['localhost','127.0.0.1','::1'].includes(u.hostname);
    if(u.protocol==='blob:'||u.protocol==='https:'||(loopback&&u.protocol==='http:'))return u.toString();
  }catch{}
  return null;
}
