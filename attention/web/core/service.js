function cleanBase(base){return String(base||'').replace(/\/$/,'');}
async function json(fetchImpl,url,options={}){
  const response=await fetchImpl(url,{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',...options});
  if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error?.message||body?.message||`Attention service ${response.status}`);}
  return response.json();
}
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HEX=/^0x[0-9a-fA-F]*$/;
export class AttentionService420{
  constructor({baseUrl,fetchImpl=globalThis.fetch,expectedSchema='420-attention-projection-v1'}={}){
    if(!baseUrl)throw new Error('Attention service URL unresolved');
    if(typeof fetchImpl!=='function')throw new Error('fetch required');
    this.baseUrl=cleanBase(baseUrl);this.fetch=fetchImpl;this.expectedSchema=expectedSchema;
  }
  _projection(payload){
    if(payload?.schema!==this.expectedSchema)throw new Error('untrusted Attention projection schema');
    if(payload?.canonical!==true)throw new Error('projection lacks canonical provenance');
    if(!payload?.source?.blockHash||!payload?.source?.chainId)throw new Error('projection provenance incomplete');
    return payload;
  }
  async runtime(){
    const p=await json(this.fetch,`${this.baseUrl}/v1/attention/runtime`);
    if(p?.schema!=='420-attention-runtime-v1'||p?.canonical!==true||!p?.chainId)throw new Error('untrusted Attention runtime');
    return p;
  }
  campaigns({cursor='',limit=24}={}){
    const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',cursor);
    return json(this.fetch,`${this.baseUrl}/v1/attention/campaigns?${q}`).then(p=>this._projection(p));
  }
  campaign(campaignId){return json(this.fetch,`${this.baseUrl}/v1/attention/campaigns/${encodeURIComponent(campaignId)}`).then(p=>this._projection(p));}
  account(account){return json(this.fetch,`${this.baseUrl}/v1/attention/accounts/${encodeURIComponent(account)}`).then(p=>this._projection(p));}
  proof(proofId){return json(this.fetch,`${this.baseUrl}/v1/attention/proofs/${encodeURIComponent(proofId)}`).then(p=>this._projection(p));}
  reward(rewardId){return json(this.fetch,`${this.baseUrl}/v1/attention/rewards/${encodeURIComponent(rewardId)}`).then(p=>this._projection(p));}
  async prepare(kind,payload){
    const allowed=new Set(['set-global-consent','set-campaign-consent','claim-reward','create-campaign','fund-campaign','activate-campaign','pause-campaign','close-campaign','cancel-campaign']);
    if(!allowed.has(kind))throw new Error('unsupported Attention transaction kind');
    const p=await json(this.fetch,`${this.baseUrl}/v1/attention/prepare/${kind}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});
    if(p?.schema!=='420-attention-transaction-review-v1'||p?.canonical!==true)throw new Error('untrusted Attention transaction review');
    if(!ADDRESS.test(p?.transaction?.to||'')||!HEX.test(p?.transaction?.data||''))throw new Error('invalid Attention transaction');
    if(p.transaction.value!=null&&!/^0x[0-9a-fA-F]+$/.test(p.transaction.value))throw new Error('invalid Attention transaction value');
    if(!p?.source?.chainId||!p?.source?.blockHash)throw new Error('transaction review provenance incomplete');
    return p;
  }
}
export function normalizeCampaign(item){
  if(!item?.campaignId||!ADDRESS.test(String(item.sponsor||''))||!ADDRESS.test(String(item.verifier||'')))throw new Error('campaign identity incomplete');
  return Object.freeze({
    campaignId:String(item.campaignId),sponsor:String(item.sponsor).toLowerCase(),verifier:String(item.verifier).toLowerCase(),
    state:String(item.state||'UNKNOWN'),metadataHash:String(item.metadataHash||''),audiencePolicyHash:String(item.audiencePolicyHash||''),
    declaredBudget:BigInt(item.declaredBudget||0),rewardPerUnit:BigInt(item.rewardPerUnit||0),maxRewardPerAccount:BigInt(item.maxRewardPerAccount||0),
    startsAt:Number(item.startsAt||0),endsAt:Number(item.endsAt||0),funded:BigInt(item.funded||0),reserved:BigInt(item.reserved||0),paid:BigInt(item.paid||0)
  });
}
