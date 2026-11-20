function cleanBase(base){return String(base||'').replace(/\/$/,'');}
const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
async function json(fetchImpl,url,options){
  const response=await fetchImpl(url,options);
  if(!response.ok){
    let error;try{error=(await response.json()).error;}catch{}
    throw new Error(error||'Launchpad service '+response.status);
  }
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
    if(!HASH.test(payload?.source?.blockHash||'')||!/^0x[0-9a-fA-F]+$/.test(payload?.source?.chainId||''))throw new Error('projection provenance incomplete');
    return payload;
  }
  _canonical(result,schema){
    if(result?.schema!==schema||result.canonical!==true||
      !HASH.test(result?.source?.blockHash||'')||!/^0x[0-9a-fA-F]+$/.test(result?.source?.chainId||''))throw new Error('untrusted '+schema);
    return result;
  }
  async runtime(){
    const result=await json(this.fetch,this.baseUrl+'/v1/launchpad/runtime',{cache:'no-store'});
    if(result?.schema!=='420-launchpad-runtime-v1'||result?.canonical!==true||
       !/^0x[0-9a-fA-F]+$/.test(result.chainId||''))throw new Error('untrusted Launchpad runtime');
    for(const name of ['launchpadRouterAddress','saleRegistryAddress','projectRegistryAddress','allocationRegistryAddress','crowdfundingIntegrationAddress','arbitrationCasesAddress'])
      if(!ADDRESS.test(result[name]||''))throw new Error('incomplete canonical runtime: '+name);
    return result;
  }
  async campaigns({cursor='',limit=24,search='',mode='',state=''}={}){
    const q=new URLSearchParams({limit:String(limit)});if(cursor)q.set('cursor',cursor);if(search)q.set('search',search);if(mode)q.set('mode',mode);if(state)q.set('state',state);
    return this._verify(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns?'+q,{cache:'no-store'}));
  }
  async campaign(saleId){
    return this._verify(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns/'+encodeURIComponent(saleId),{cache:'no-store'}));
  }
  async participant(saleId,address){
    return this._verify(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns/'+encodeURIComponent(saleId)+'/participants/'+encodeURIComponent(address),{cache:'no-store'}));
  }
  async position(saleId,address){
    if(!HASH.test(saleId)||!ADDRESS.test(address))throw new Error('invalid position identity');
    return this._canonical(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns/'+saleId+'/position/'+address,{cache:'no-store'}),'420-launchpad-position-v1');
  }
  async checkout(saleId,account,amount,nonce){
    if(!HASH.test(saleId)||!ADDRESS.test(account))throw new Error('invalid checkout identity');
    const q=new URLSearchParams({account,amount:String(amount),nonce:String(nonce)});
    const result=this._canonical(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns/'+saleId+'/checkout?'+q,{cache:'no-store'}),'420-launchpad-checkout-v1');
    if(!HASH.test(result.invoiceId||'')||result.saleId.toLowerCase()!==saleId.toLowerCase())throw new Error('invalid canonical invoice context');
    if(result.checkoutUrl){
      const u=new URL(result.checkoutUrl);
      if(u.origin!=='https://420pay.420integrated.org'||u.pathname!=='/'||u.search||!u.hash.startsWith('#pay?v=1&kind=invoice&chain='))throw new Error('untrusted 420Pay checkout origin');
    }
    return result;
  }
  async conversionQuote(saleId,account,terms){
    if(!HASH.test(saleId)||!ADDRESS.test(account))throw new Error('invalid conversion identity');
    const q=new URLSearchParams({account,...terms});
    const result=this._canonical(await json(this.fetch,this.baseUrl+'/v1/launchpad/campaigns/'+saleId+'/conversion-quote?'+q,{cache:'no-store'}),'420-launchpad-conversion-quote-v1');
    if(result.saleId.toLowerCase()!==saleId.toLowerCase()||!HASH.test(result.quoteId||'')||!ADDRESS.test(result.paymentRouterAddress||'')||
      !ADDRESS.test(result.approval?.to||'')||!ADDRESS.test(result.approval?.spender||'')||
      !/^0x[0-9a-fA-F]+$/.test(result.transaction?.data||''))throw new Error('invalid canonical Pay conversion terms');
    return result;
  }
  async transaction(txHash,account){
    if(!HASH.test(txHash)||!ADDRESS.test(account))throw new Error('invalid transaction identity');
    const q=new URLSearchParams({account});
    return this._canonical(await json(this.fetch,this.baseUrl+'/v1/launchpad/transactions/'+txHash+'?'+q,{cache:'no-store'}),'420-launchpad-transaction-status-v1');
  }
  async prepare(kind,payload){
    if(!['approve-conversion','pay-conversion','contribute','claim','refund','bind-identity','register-intent','open-dispute','link-dispute','publish-outcome','recover-unallocated','reconcile-refund'].includes(kind))throw new Error('unsupported Launchpad transaction kind');
    const result=await json(this.fetch,this.baseUrl+'/v1/launchpad/prepare/'+kind,{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    });
    if(result?.schema!=='420-launchpad-transaction-review-v1')throw new Error('untrusted transaction review schema');
    if(result?.canonical!==true||!ADDRESS.test(result?.transaction?.to||''))throw new Error('invalid canonical transaction review');
    if(!/^0x[0-9a-fA-F]*$/.test(result?.transaction?.data||''))throw new Error('invalid transaction calldata');
    return result;
  }
  async creatorRequest(payload){
    const result=await json(this.fetch,this.baseUrl+'/v1/launchpad/creator-requests',{
      method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(payload)
    });
    if(result?.schema!=='420-launchpad-creator-request-v1'||result?.canonical!==true||result?.requiresGovernance!==true)throw new Error('invalid creator governance request');
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
export function remaining(campaign){return (campaign.hardCap>campaign.raised?campaign.hardCap-campaign.raised:0n).toString();}
