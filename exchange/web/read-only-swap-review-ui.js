import {QuoteReviewSession} from './core/quote-review-session.js';
import {assertCandidateMatchesEntry,buildMetadataSwapReviewRequest,normalizeReviewCatalogue} from './core/read-only-swap-entry.js';

const full=value=>typeof value==='string'?value:String(value??'');
const addRow=(documentRef,dl,label,value,{code=false,key=null}={})=>{
  const wrapper=documentRef.createElement('div');
  if(key)wrapper.setAttribute('data-review-key',key);
  const dt=documentRef.createElement('dt');dt.textContent=label;
  const dd=documentRef.createElement('dd');
  const node=code?documentRef.createElement('code'):dd;
  if(code){node.textContent=full(value);dd.append(node);}else dd.textContent=full(value);
  wrapper.append(dt,dd);dl.append(wrapper);
};

export function readOnlyReviewLines(candidate,entry=null){
  if(candidate?.status!=='REVIEW_CANDIDATE_ONLY'||!candidate.projection||!candidate.prepared?.context)throw Error('Canonical review candidate required');
  const {projection:p,prepared:{context}}=candidate;
  const fee=p.fees?.status==='DISCLOSED'
    ? `${p.fees.totalFee} ${p.output.symbol} (${p.fees.totalFeeRaw} raw)${p.fees.rateBps===null?'':` · ${p.fees.rateBps} bps`}`
    : 'Unavailable in current candidate schema — execution remains disabled';
  return Object.freeze([
    'REVIEW CANDIDATE ONLY — transport/schema checked; producer authenticity is not established',
    entry?.market?`Configured market: ${entry.market.label} · ${entry.market.marketId}`:null,
    `Chain: ${context.chainId}`,
    `Input: ${p.amountIn} ${p.input.symbol} · raw ${p.amountInRaw} · ${p.input.address}`,
    `Minimum net output: ${p.minimumOutput} ${p.output.symbol} · raw ${p.minimumOutputRaw} · ${p.output.address}`,
    `Fees: ${fee}`,
    `Recipient: ${p.recipient}`,
    `Router / spender target: ${p.envelope.to}`,
    `Quote: ${p.quoteId}`,
    `Route commitment: ${p.expectedPathHash}`,
    ...p.hops.map((hop,index)=>`Hop ${index+1}: market ${hop.marketId} · route ${hop.routeId} · token ${hop.tokenOut} · minimum raw ${hop.minAmountOutRaw}`),
    `Transaction fingerprint: ${p.envelope.transactionFingerprint}`,
    `Quote expires (Unix seconds): ${context.expiresAt}`,
    'Wallet signing and transaction submission remain disabled.',
  ].filter(Boolean));
}

export function mountReadOnlySwapReview({documentRef,controller,fetchReview,nowSeconds}={}){
  if(!documentRef?.createElement||!documentRef?.querySelector||!controller)throw Error('Browser document and wallet controller required');
  const panel=documentRef.createElement('section');panel.id='v15-quote-review';panel.className='pre03-review-panel';panel.setAttribute('aria-label','Read-only swap review');
  const heading=documentRef.createElement('h3');heading.textContent='Swap review · read only';panel.append(heading);
  const warning=documentRef.createElement('p');warning.className='pre03-review-warning';warning.textContent='Qualified configured asset metadata only. Display snapshots and fixtures never authorize trading. Quote producer authenticity is a later PRE-05 gate.';panel.append(warning);

  const form=documentRef.createElement('div');form.className='pre03-entry-grid';
  const marketLabel=documentRef.createElement('label');marketLabel.textContent='Qualified market';
  const market=documentRef.createElement('select');market.id='v15-review-market';market.setAttribute('aria-label','Qualified market');marketLabel.append(market);form.append(marketLabel);
  const amountLabel=documentRef.createElement('label');amountLabel.textContent='Input amount';
  const amount=documentRef.createElement('input');amount.id='v15-review-amount';amount.inputMode='decimal';amount.autocomplete='off';amount.setAttribute('aria-label','Input amount');amountLabel.append(amount);form.append(amountLabel);
  const minimumLabel=documentRef.createElement('label');minimumLabel.textContent='Minimum net output';
  const minimum=documentRef.createElement('input');minimum.id='v15-review-minimum';minimum.inputMode='decimal';minimum.autocomplete='off';minimum.setAttribute('aria-label','Minimum net output');minimumLabel.append(minimum);form.append(minimumLabel);
  const recipientLabel=documentRef.createElement('label');recipientLabel.textContent='Recipient';
  const recipient=documentRef.createElement('input');recipient.id='v15-review-recipient';recipient.autocomplete='off';recipient.spellcheck=false;recipient.setAttribute('aria-label','Recipient');recipientLabel.append(recipient);form.append(recipientLabel);
  panel.append(form);

  const raw=documentRef.createElement('p');raw.id='v15-review-raw-preview';raw.className='pre03-raw-preview';raw.setAttribute('aria-live','polite');raw.textContent='Canonical raw units will be derived exactly from qualified token decimals.';panel.append(raw);
  const button=documentRef.createElement('button');button.type='button';button.id='v15-quote-review-fetch';button.textContent='Fetch read-only review candidate';panel.append(button);
  const status=documentRef.createElement('p');status.id='v15-quote-review-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');panel.append(status);
  const result=documentRef.createElement('section');result.id='v15-quote-review-result';result.className='pre03-review-result';result.hidden=true;result.setAttribute('aria-label','Canonical swap review');result.setAttribute('tabindex','-1');panel.append(result);

  const view=documentRef.querySelector('#app-view');
  if(!view)throw Error('Exchange view unavailable');
  const session=new QuoteReviewSession({controller,...(fetchReview?{fetchReview}:{}),...(nowSeconds?{nowSeconds}:{})});
  let disposed=false,catalogue=null,currentEntry=null;

  function clear(reason='Review cleared'){
    if(disposed)return;session.invalidate();currentEntry=null;result.hidden=true;result.replaceChildren?.();result.textContent='';status.textContent=reason;
  }
  function configured(){
    return typeof controller.runtime?.api?.executableQuoteUrl==='string'&&controller.runtime.deployment?.status==='RESOLVED'&&controller.runtime.deployment.environment==='testnet';
  }
  function loadCatalogue(){
    try{catalogue=normalizeReviewCatalogue(controller.runtime);return catalogue;}
    catch{catalogue=null;return null;}
  }
  function renderMarkets(){
    const selected=market.value;market.replaceChildren();
    const empty=documentRef.createElement('option');empty.value='';empty.textContent='Select qualified market';market.append(empty);
    const cat=loadCatalogue();
    for(const item of cat?.markets??[]){
      const option=documentRef.createElement('option');option.value=item.marketId;option.textContent=item.label;market.append(option);
    }
    if(cat?.markets.some(item=>item.marketId===selected))market.value=selected;
    market.disabled=!cat?.markets.length;
  }
  function previewRaw(){
    const cat=catalogue??loadCatalogue(),selected=cat?.markets.find(item=>item.marketId===market.value);
    if(!selected){raw.textContent='Select a qualified configured market to derive canonical raw units.';return;}
    try{
      const entry=buildMetadataSwapReviewRequest({
        runtime:controller.runtime,account:controller.wallet?.session?.account,marketId:selected.marketId,
        recipient:recipient.value.trim(),amountIn:amount.value.trim(),minimumOutput:minimum.value.trim(),
      });
      raw.textContent=`Canonical request: ${entry.request.amountInRaw} raw ${selected.input.symbol} · minimum ${entry.request.minimumOutputRaw} raw ${selected.output.symbol}`;
    }catch{raw.textContent=`Enter valid ${selected.input.symbol}/${selected.output.symbol} decimal amounts and recipient; raw units are never accepted as user display input.`;}
  }
  function refresh(){
    if(disposed)return;
    const visible=Boolean(view.querySelector?.('#swap-review'));
    if(!visible){if(panel.parentElement)panel.remove();clear('Navigate to Swap to request a read-only review');return;}
    if(panel.parentElement!==view)view.append(panel);
    renderMarkets();
    const connected=Boolean(controller.wallet?.session?.account);
    if(connected&&!recipient.value)recipient.value=controller.wallet.session.account;
    button.disabled=!configured()||!connected||!catalogue?.markets.length;
    if(!catalogue)status.textContent='Qualified configured asset/market metadata unavailable; review entry is disabled.';
    else if(!configured())status.textContent='Executable quote endpoint and verified testnet deployment not configured; trading disabled.';
    else if(!connected)status.textContent='Connect a wallet to request a read-only quote.';
    else if(!market.value)status.textContent='Select a qualified configured market.';
    previewRaw();
  }
  function invalidateFromInput(){
    controller.invalidateExecution('trade-input-change');
    clear('Trade input changed; request a new quote.');
    previewRaw();
  }
  for(const input of [market,amount,minimum,recipient])input.addEventListener(input===market?'change':'input',invalidateFromInput);

  function renderCandidate(candidate,entry){
    result.replaceChildren?.();result.textContent='';
    const banner=documentRef.createElement('p');banner.className='pre03-source-banner';banner.textContent='REVIEW CANDIDATE ONLY · transport/schema checked · producer authenticity not established · no execution authority';result.append(banner);
    const dl=documentRef.createElement('dl');dl.className='pre03-review-grid';
    const p=candidate.projection,context=candidate.prepared.context;
    addRow(documentRef,dl,'Configured market',entry.market.label,{key:'configured-market'});
    addRow(documentRef,dl,'Chain',context.chainId,{code:true,key:'chain'});
    addRow(documentRef,dl,'Input',`${p.amountIn} ${p.input.symbol} (${p.amountInRaw} raw)`,{key:'input'});
    addRow(documentRef,dl,'Input token',p.input.address,{code:true,key:'input-token'});
    addRow(documentRef,dl,'Minimum net output',`${p.minimumOutput} ${p.output.symbol} (${p.minimumOutputRaw} raw)`,{key:'minimum-output'});
    addRow(documentRef,dl,'Output token',p.output.address,{code:true,key:'output-token'});
    const fee=p.fees?.status==='DISCLOSED'?`${p.fees.totalFee} ${p.output.symbol} (${p.fees.totalFeeRaw} raw)${p.fees.rateBps===null?'':` · ${p.fees.rateBps} bps`}`:'Unavailable in current candidate schema; do not treat this as complete fee disclosure';
    addRow(documentRef,dl,'Fees',fee,{key:'fees'});
    addRow(documentRef,dl,'Recipient',p.recipient,{code:true,key:'recipient'});
    addRow(documentRef,dl,'Router / spender',p.envelope.to,{code:true,key:'router'});
    addRow(documentRef,dl,'Quote ID',p.quoteId,{code:true,key:'quote-id'});
    addRow(documentRef,dl,'Route commitment',p.expectedPathHash,{code:true,key:'route-commitment'});
    addRow(documentRef,dl,'Transaction fingerprint',p.envelope.transactionFingerprint,{code:true,key:'transaction-fingerprint'});
    addRow(documentRef,dl,'Expiry',String(context.expiresAt),{key:'expiry'});
    result.append(dl);

    const details=documentRef.createElement('details');details.className='pre03-route-details';
    const summary=documentRef.createElement('summary');summary.textContent=`Inspect full route identifiers (${p.hops.length} hop${p.hops.length===1?'':'s'})`;details.append(summary);
    const routes=documentRef.createElement('ol');routes.className='pre03-route-list';
    p.hops.forEach((hop,index)=>{
      const item=documentRef.createElement('li');
      item.textContent=`Hop ${index+1}\nmarket: ${hop.marketId}\nroute: ${hop.routeId}\noutput token: ${hop.tokenOut}\nminimum raw: ${hop.minAmountOutRaw}`;
      routes.append(item);
    });
    details.append(routes);result.append(details);
    const warning=documentRef.createElement('p');warning.textContent='Wallet signing and transaction submission remain disabled.';result.append(warning);
    result.hidden=false;result.focus?.();
  }

  async function onFetch(){
    clear('Retrieving review candidate…');
    status.setAttribute('aria-busy','true');
    let entry;
    try{
      entry=buildMetadataSwapReviewRequest({
        runtime:controller.runtime,account:controller.wallet?.session?.account,marketId:market.value,
        recipient:recipient.value.trim(),amountIn:amount.value.trim(),minimumOutput:minimum.value.trim(),
      });
    }catch(error){status.removeAttribute?.('aria-busy');status.textContent=String(error?.message??'Invalid swap review input');return;}
    button.disabled=true;
    try{
      const candidate=await session.request({request:entry.request});
      if(disposed||!view.querySelector?.('#swap-review')||panel.parentElement!==view){clear('Review invalidated by navigation');return;}
      session.current();assertCandidateMatchesEntry(candidate,entry);
      currentEntry=entry;renderCandidate(candidate,entry);
      status.textContent='Read-only candidate received. Review source is not authenticated and no wallet transaction is available.';
    }catch(error){if(!disposed){result.hidden=true;result.replaceChildren?.();result.textContent='';status.textContent=String(error?.message??'Quote review unavailable');}}
    finally{if(!disposed){status.removeAttribute?.('aria-busy');refresh();}}
  }
  button.addEventListener('click',onFetch);
  refresh();
  function dispose(){if(disposed)return;session.dispose();disposed=true;button.removeEventListener('click',onFetch);for(const input of [market,amount,minimum,recipient])input.removeEventListener(input===market?'change':'input',invalidateFromInput);panel.remove();}
  return {refresh,clear,dispose,session,panel,market,amount,minimum,recipient,get catalogue(){return catalogue;},get currentEntry(){return currentEntry;}};
}
