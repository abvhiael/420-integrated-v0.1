function cleanBase(base){return String(base||'').replace(/\/$/,'');}
async function json(fetchImpl,url,options){
  const response=await fetchImpl(url,options);
  if(!response.ok)throw new Error(`Launchpad service ${response.status}`);
  return response.json();
}
export class LaunchpadService {
  constructor({baseUrl,fetchImpl=globalThis.fetch,expectedSchema='420-launchpad-projection-v1'}={}){
    if(!baseUrl)throw new Error('Launchpad service URL unresolved');
    this.baseUrl=cleanBase(baseUrl);this.fetch=fetchImpl;this.expectedSchema=expectedSchema;
  }
  _verify(payload){
    if(payload?.schema!==this.expectedSchema)throw new Error('untrusted Launchpad projection schema');
    if(payload?.canonical!==true)throw new Error('projection lacks canonical provenance');
    if(!payload?.source?.blockHash||!payload?.source?.chainId)throw new Error('projection provenance incomplete');
    return payload;
  }
  async campaigns({cursor='',limit=24}={}){
    const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',cursor);
    return this._verify(await json(this.fetch,`${this.baseUrl}/v1/launchpad/campaigns?${q}`,{cache:'no-store'}));
  }
  async campaign(saleId){
    return this._verify(await json(this.fetch,`${this.baseUrl}/v1/launchpad/campaigns/${encodeURIComponent(saleId)}`,{cache:'no-store'}));
  }
  async participant(saleId,address){
    return this._verify(await json(this.fetch,`${this.baseUrl}/v1/launchpad/campaigns/${encodeURIComponent(saleId)}/participants/${encodeURIComponent(address)}`,{cache:'no-store'}));
  }
  async prepare(kind,payload){
    if(!['contribute','claim','refund','creator'].includes(kind))throw new Error('unsupported Launchpad transaction kind');
    const result=await json(this.fetch,`${this.baseUrl}/v1/launchpad/prepare/${kind}`,{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    });
    if(result?.schema!=='420-launchpad-transaction-review-v1')throw new Error('untrusted transaction review schema');
    if(result?.canonical!==true||!/^0x[0-9a-fA-F]{40}$/.test(result?.transaction?.to||''))throw new Error('invalid canonical transaction review');
    if(!/^0x[0-9a-fA-F]*$/.test(result?.transaction?.data||''))throw new Error('invalid transaction calldata');
    return result;
  }
}
export function normalizeCampaign(item){
  if(!item?.saleId||!item?.projectId)throw new Error('campaign identity missing');
  return {
    saleId:String(item.saleId),projectId:String(item.projectId),title:String(item.title||'Untitled campaign'),
    summary:String(item.summary||''),mode:String(item.mode||'UNKNOWN'),state:String(item.state||'UNKNOWN'),
    raised:BigInt(item.raised||0),hardCap:BigInt(item.hardCap||0),softCap:BigInt(item.softCap||0),
    startsAt:Number(item.startsAt||0),endsAt:Number(item.endsAt||0),claimStartsAt:Number(item.claimStartsAt||0),
    paymentAsset:String(item.paymentAsset||''),proceedsReceiver:String(item.proceedsReceiver||''),
    controller:String(item.controller||''),eligibilityPolicyHash:String(item.eligibilityPolicyHash||''),
  };
}
export function progress(campaign){
  if(campaign.hardCap===0n)return 0;
  const pct=Number(campaign.raised*10000n/campaign.hardCap)/100;
  return Math.max(0,Math.min(100,pct));
}
