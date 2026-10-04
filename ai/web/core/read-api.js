function query(params={}){const q=new URLSearchParams();for(const [k,v] of Object.entries(params))if(v!==undefined&&v!==null&&v!=='')q.set(k,String(v));return q.toString();}
export class AiReadApi420{
  constructor({baseUrl,chainId,fetchImpl=globalThis.fetch}={}){if(!baseUrl)throw Error('AI read API URL unavailable');if(typeof fetchImpl!=='function')throw Error('fetch required');this.baseUrl=baseUrl.replace(/\/$/,'');this.chainId=BigInt(chainId).toString();this.fetchImpl=fetchImpl;}
  async get(path,params={}){const qs=query({chainId:this.chainId,...params});const r=await this.fetchImpl(this.baseUrl+path+(qs?'?'+qs:''),{headers:{accept:'application/json'},cache:'no-store'});if(!r.ok){const body=await r.json().catch(()=>null);throw Error(body?.error?.message||body?.message||('AI read API '+r.status));}const payload=await r.json();const data=payload?.data??payload;if(data?.schemaVersion&&data.schemaVersion!=='420-ai-read-v1')throw Error('AI read schema mismatch');return data;}
  models(request={}){return this.get('/v1/ai/models',request);}
  modelVersions(request={}){return this.get('/v1/ai/model-versions',request);}
  deployments(request={}){return this.get('/v1/ai/deployments',request);}
  jobs(request={}){return this.get('/v1/ai/jobs',request);}
  job(id){return this.get('/v1/ai/jobs/'+encodeURIComponent(id));}
  policies(request={}){return this.get('/v1/ai/policies',request);}
}
