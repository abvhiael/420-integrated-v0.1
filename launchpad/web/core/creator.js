const HASH=/^0x[0-9a-fA-F]{64}$/,ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const names=['Project','Mode & entitlements','Funding','Schedule','Review'];
const $=s=>document.querySelector(s);
const label=(s,t)=>{const el=$(s);if(el)el.textContent=String(t||'');};
const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
function tier(){
  const row=el('div','');row.className='creator-tier-row';
  for(const [name,key,pattern] of [['Name','name',''],['Description','description',''],['Minimum contribution (raw units)','price','[1-9][0-9]*'],['Quantity','quantity','[1-9][0-9]*']]){
    const field=el('label',name),input=el('input','');input.dataset.key=key;input.required=key!=='description';
    if(pattern)input.pattern=pattern;field.append(input);row.append(field);
  }
  const remove=el('button','Remove tier');remove.type='button';remove.onclick=()=>row.remove();row.append(remove);return row;
}
const stamp=v=>{const n=Date.parse(v);if(!Number.isSafeInteger(n)||n<=0)throw Error('Invalid schedule date');return String(Math.floor(n/1000));};
export class CreatorStudio{
  constructor(context){
    this.context=context;this.step=0;this.prepared=null;this.payload=null;
    const form=$('#creator-form');form?.addEventListener('submit',e=>e.preventDefault());
    form?.addEventListener('input',()=>this.invalidate());
    $('#creator-add-tier')?.addEventListener('click',()=>{$('#creator-tier-list').append(tier());this.invalidate();});
    $('#creator-mode')?.addEventListener('change',()=>{this.mode();this.invalidate();});
    $('#creator-back')?.addEventListener('click',()=>this.show(this.step-1));
    $('#creator-next')?.addEventListener('click',()=>this.next());
    $('#creator-prepare')?.addEventListener('click',()=>this.run(()=>this.prepare()));
    $('#creator-submit')?.addEventListener('click',()=>this.run(()=>this.submit()));
    $('#creator-export')?.addEventListener('click',()=>this.run(()=>this.exportBundle()));
    $('#creator-lifecycle-prepare')?.addEventListener('click',()=>this.run(()=>this.lifecycle()));
    $('#creator-refresh')?.addEventListener('click',()=>this.run(()=>this.refresh()));
    $('#creator-load-report')?.addEventListener('click',()=>this.run(()=>this.report($('#creator-report-id').value.trim())));
    $('#creator-tier-list')?.append(tier());this.mode();this.show(0);
  }
  session(){
    const {wallet,service}=this.context();
    if(!wallet||!service||!ADDRESS.test(wallet.account))throw Error('Connect Wallet on the canonical Launchpad chain first');
    return {wallet,service};
  }
  async run(cb){try{await cb();}catch(e){label('#creator-request-state',e.message||String(e));}}
  invalidate(){
    this.prepared=null;this.payload=null;$('#creator-submit').disabled=true;$('#creator-export').disabled=true;
    label('#creator-prepared','Draft modified. Prepare a fresh canonical review.');
  }
  show(i){
    this.step=Math.min(4,Math.max(0,i));
    for(const f of document.querySelectorAll('.creator-step'))f.hidden=Number(f.dataset.creatorStep)!==this.step;
    label('#creator-step-label','Step '+(this.step+1)+' of 5 — '+names[this.step]);
    $('#creator-back').disabled=this.step===0;$('#creator-next').hidden=this.step===4;
  }
  mode(){
    const mode=$('#creator-mode').value;
    $('#creator-tier-panel').hidden=!['REWARD','PRODUCT_PREORDER'].includes(mode);
    $('#creator-milestones-panel').hidden=mode!=='COMMUNITY_PROJECT';
    $('#creator-preorder-panel').hidden=mode!=='PRODUCT_PREORDER';
  }
  next(){
    const current=document.querySelector('[data-creator-step="'+this.step+'"]');
    for(const input of current.querySelectorAll('[required]'))
      if(!input.checkValidity()){input.reportValidity();return;}
    this.show(this.step+1);
  }
  draft(){
    const f=new FormData($('#creator-form')),v=k=>String(f.get(k)||'').trim(),mode=v('mode');
    const rewardTiers=['REWARD','PRODUCT_PREORDER'].includes(mode)?Array.from($('#creator-tier-list').querySelectorAll('.creator-tier-row')).map(row=>{
      const val=k=>row.querySelector('[data-key="'+k+'"]')?.value.trim()||'';
      return {name:val('name'),description:val('description'),price:val('price'),quantity:val('quantity')};
    }):[];
    if(!$('#creator-risk-check').checked)throw Error('Read and accept the campaign governance/risk notice');
    return {controller:v('controller'),saleAsset:v('saleAsset'),issuanceCommitment:v('issuanceCommitment'),
      title:v('title'),summary:v('summary'),description:v('description'),website:v('website'),mode,
      paymentAsset:v('paymentAsset'),proceedsReceiver:v('proceedsReceiver'),
      softCap:v('softCap'),hardCap:v('hardCap'),perWalletCap:v('perWalletCap'),
      tokenAllocation:v('tokenAllocation'),eligibilityPolicyHash:v('eligibilityPolicyHash'),
      liquidityCommitment:v('liquidityCommitment')||'0x'+'0'.repeat(64),
      startsAt:stamp(v('startsAt')),endsAt:stamp(v('endsAt')),claimStartsAt:stamp(v('claimStartsAt')),
      rewardTiers,milestones:mode==='COMMUNITY_PROJECT'?v('milestones').split('\n').map(s=>s.trim()).filter(Boolean):[],
      productPreorder:mode==='PRODUCT_PREORDER'?{
        productName:v('productName'),shippingRegions:v('shippingRegions'),
        estimatedDeliveryAt:stamp(v('estimatedDeliveryAt')),terms:v('productTerms'),refundPolicy:v('refundPolicy')}:null};
  }
  async prepare(){
    const {wallet,service}=this.session(),draft=this.draft();
    if(draft.controller.toLowerCase()!==wallet.account.toLowerCase())throw Error('Connected wallet must control the project');
    await this.review({kind:'CREATE_CAMPAIGN',draft},service);
  }
  async lifecycle(){
    const {wallet,service}=this.session(),saleId=$('#creator-lifecycle-sale').value.trim();
    if(!HASH.test(saleId))throw Error('Provide a canonical sale ID');
    await this.review({kind:'LIFECYCLE',saleId,account:wallet.account,action:$('#creator-lifecycle-action').value},service);
  }
  async review(payload,service){
    const prep=await service.creatorPrepare(payload),who=this.session().wallet.account;
    if(prep.governanceRequest.requester.toLowerCase()!==who.toLowerCase())throw Error('Governance review requester mismatch');
    this.prepared=prep;this.payload=payload;
    label('#creator-prepared',JSON.stringify({requestId:prep.requestId,projectId:prep.projectId,
      saleId:prep.saleId,metadataHash:prep.metadataHash||null,metadata:prep.metadata||null,
      governanceCalls:prep.governanceRequest.calls,note:prep.note},null,2));
    $('#creator-submit').disabled=false;$('#creator-export').disabled=false;this.show(4);
    label('#creator-request-state','Creator governance request prepared. Review the exact bundle. No on-chain approval or execution has occurred.');
  }
  async submit(){
    const {wallet,service}=this.session();
    if(!this.prepared||!this.payload)throw Error('Prepare a governance review first');
    const provider=globalThis.ethereum;if(!provider?.request)throw Error('Wallet provider unavailable');
    const check=async()=>{
      const [chain,accounts]=await Promise.all([provider.request({method:'eth_chainId'}),provider.request({method:'eth_accounts'})]);
      if(chain?.toLowerCase()!==wallet.chainId.toLowerCase()||!Array.isArray(accounts)||accounts.length!==1||
        accounts[0].toLowerCase()!==wallet.account.toLowerCase())throw Error('Wallet account or chain changed; reconnect');
    };
    await check();
    const signature=await provider.request({method:'personal_sign',params:[this.prepared.requestId,wallet.account]});
    await check();
    if(!/^0x(?:[0-9a-fA-F]{2}){1,1024}$/.test(signature||''))throw Error('Unsupported Wallet signature format');
    const receipt=await service.creatorSubmit({...this.payload,requestId:this.prepared.requestId,signature});
    if(receipt.requestId!==this.prepared.requestId)throw Error('Governance receipt does not match signed request');
    $('#creator-submit').disabled=true;
    label('#creator-request-state','Request received for governance review: '+receipt.requestId+'. No approval or activation implied.');
    await this.refresh();
  }
  async exportBundle(){
    if(!this.prepared)throw Error('Prepare a request before exporting');
    const data=JSON.stringify({schema:'420-launchpad-governance-bundle-v1',
      requestId:this.prepared.requestId,metadataHash:this.prepared.metadataHash||null,
      metadataJson:this.prepared.metadataJson||null,governanceRequest:this.prepared.governanceRequest},null,2);
    const url=URL.createObjectURL(new Blob([data],{type:'application/json'})),a=el('a','');
    a.href=url;a.download='launchpad-'+this.prepared.requestId.slice(2,14)+'.json';
    document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);
  }
  async refresh(){
    const {wallet,service}=this.session();$('#creator-controller').value=wallet.account;
    const campaigns=await service.creatorCampaigns(wallet.account);
    const box=$('#creator-campaign-list');box.replaceChildren();
    if(!campaigns.items.length)box.append(el('p','No discovered campaigns. Enter any owned sale ID to read a canonical report.'));
    for(const c of campaigns.items){
      const b=el('button',c.title+' · '+c.mode+' · '+c.state+' · '+c.grossRaised+' / '+c.hardCap);
      b.type='button';b.addEventListener('click',()=>this.run(()=>this.report(c.saleId)));box.append(b);
    }
    try{
      const requests=await service.creatorReceipts(wallet.account),history=$('#creator-request-history');
      history.replaceChildren();
      if(!requests.length)history.append(el('p','No signed governance requests received.'));
      for(const r of requests)history.append(el('p',r.status+' · '+r.requestKind+' · '+r.requestId));
    }catch(e){label('#creator-request-history','Request ledger unavailable: '+e.message);}
  }
  async report(saleId){
    if(!HASH.test(saleId))throw Error('Canonical sale ID required');
    const {wallet,service}=this.session(),r=await service.creatorReport(wallet.account,saleId);
    $('#creator-report-id').value=saleId;$('#creator-lifecycle-sale').value=saleId;
    const out=$('#creator-report-output');out.replaceChildren();
    const lines=['Verified owner: '+r.project.controller,'Sale state: '+r.sale.state+' · Mode: '+r.mode,
      'Approval/lifecycle: '+r.approval,'Gross recorded funding: '+r.grossRecordedFunding+' / '+r.sale.hardCap,
      'Recorded refunded principal: '+r.recordedRefundPrincipal+' (does not change historical gross raised)',
      'Canonical block: '+r.source.blockNumber+' / '+r.source.blockHash,
      'Event coverage: '+r.coverage.reason];
    if(r.events)for(const [name,count] of Object.entries(r.events))lines.push(name+': '+count.count+' events'+
      (r.coverage.completeFromGenesis?'':' (partial coverage)'));
    for(const line of lines)out.append(el('p',line));
  }
  clearWallet(){
    this.prepared=null;this.payload=null;$('#creator-controller').value='';
    $('#creator-submit').disabled=true;$('#creator-export').disabled=true;
    label('#creator-campaign-list','Wallet changed. Reconnect to see verified campaigns.');
    label('#creator-report-output','No verified report.');
    label('#creator-request-state','Wallet changed. Reprepare and sign any request.');
  }
}
