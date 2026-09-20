import {QuoteReviewSession} from './core/quote-review-session.js';

const address=value=>typeof value==='string'&&/^0x[0-9a-f]{40}$/i.test(value)&&!/^0x0{40}$/i.test(value);
const positiveRaw=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&BigInt(value)<(1n<<256n);

// V14 display quotes, decimal amounts and catalog symbols are deliberately NOT
// accepted as execution inputs. The user must enter canonical token addresses
// and decimal raw-unit amounts independently for this read-only V15 review.
export function explicitSwapReviewRequest({account,tokenIn,tokenOut,recipient,amountInRaw,minimumOutputRaw}={}){
  if(!address(account)||!address(tokenIn)||!address(tokenOut)||!address(recipient)||!positiveRaw(amountInRaw)||!positiveRaw(minimumOutputRaw)){
    throw new Error('Connected account, token addresses, recipient and positive integer raw-unit amounts are required');
  }
  return Object.freeze({account:account.toLowerCase(),tokenIn:tokenIn.toLowerCase(),tokenOut:tokenOut.toLowerCase(),recipient:recipient.toLowerCase(),amountInRaw,minimumOutputRaw});
}

// A readable projection, not an approval, executable quote or signing request.
export function readOnlyReviewLines(candidate){
  if(candidate?.status!=='REVIEW_CANDIDATE_ONLY'||!candidate.projection||!candidate.prepared?.context)throw Error('Canonical review candidate required');
  const {projection:p,prepared:{context}}=candidate;
  return Object.freeze([
    'REVIEW CANDIDATE ONLY — not authenticated or authorized for trading',
    `Input: ${p.amountIn} ${p.input.symbol} (${p.input.address})`,
    `Minimum output: ${p.minimumOutput} ${p.output.symbol} (${p.output.address})`,
    `Recipient: ${p.recipient}`,
    `Quote: ${p.quoteId}`,
    `Route commitment: ${p.expectedPathHash}`,
    ...p.hops.map((hop,index)=>`Hop ${index+1}: market ${hop.marketId}, route ${hop.routeId}, output token ${hop.tokenOut}`),
    `Wallet: ${context.account} · chain: ${context.chainId}`,
    `Router: ${p.envelope.to} · transaction fingerprint: ${p.envelope.transactionFingerprint}`,
    `Quote expires (Unix seconds): ${context.expiresAt}`,
    'Wallet signing and transaction submission remain disabled.',
  ]);
}

export function mountReadOnlySwapReview({documentRef,controller,fetchReview,nowSeconds}={}){
  if(!documentRef?.createElement||!documentRef?.querySelector||!controller)throw Error('Browser document and wallet controller required');
  const panel=documentRef.createElement('section');panel.id='v15-quote-review';panel.setAttribute('aria-label','V15 read-only swap quote review');
  const heading=documentRef.createElement('h3');heading.textContent='V15 testnet swap · review only';panel.append(heading);
  const warning=documentRef.createElement('p');warning.textContent='Not the V14 display quote. No signing or trading is enabled. Enter token addresses and raw-unit amounts only.';panel.append(warning);
  const fields={};
  for(const [key,label] of [['tokenIn','Input token address'],['tokenOut','Output token address'],['recipient','Recipient address'],['amountInRaw','Input amount (integer raw units)'],['minimumOutputRaw','Minimum output (integer raw units)']]){
    const wrapper=documentRef.createElement('label');wrapper.textContent=label;
    const input=documentRef.createElement('input');input.setAttribute('aria-label',label);input.autocomplete='off';input.value='';fields[key]=input;wrapper.append(input);panel.append(wrapper);
  }
  const button=documentRef.createElement('button');button.type='button';button.id='v15-quote-review-fetch';button.textContent='Fetch read-only quote review';panel.append(button);
  const status=documentRef.createElement('p');status.id='v15-quote-review-status';status.setAttribute('role','status');panel.append(status);
  const result=documentRef.createElement('pre');result.id='v15-quote-review-result';result.hidden=true;panel.append(result);
  const view=documentRef.querySelector('#app-view');
  if(!view)throw Error('Exchange view unavailable');
  const session=new QuoteReviewSession({controller,...(fetchReview?{fetchReview}:{}),...(nowSeconds?{nowSeconds}:{})});
  let disposed=false;
  function clear(reason='Review cleared'){
    if(disposed)return;session.invalidate();result.hidden=true;result.textContent='';status.textContent=reason;
  }
  function configured(){return typeof controller.runtime?.api?.executableQuoteUrl==='string'&&controller.runtime.deployment?.status==='RESOLVED'&&controller.runtime.deployment.environment==='testnet';}
  function refresh(){
    if(disposed)return;
    const visible=Boolean(view.querySelector?.('#swap-review'));
    if(!visible){if(panel.parentElement)panel.remove();clear('Navigate to Swap to request a read-only review');return;}
    if(panel.parentElement!==view)view.append(panel);
    button.disabled=!configured()||!controller.wallet?.session?.account;
    if(!configured())status.textContent='Executable quote endpoint and verified testnet deployment not configured; trading disabled.';
    else if(!controller.wallet?.session?.account)status.textContent='Connect a wallet to request a read-only quote.';
  }
  function onChange(){clear('Trade input changed; request a new quote.');}
  for(const input of Object.values(fields))input.addEventListener('input',onChange);
  async function onFetch(){
    clear('Retrieving review candidate…');
    let request;
    try{request=explicitSwapReviewRequest({account:controller.wallet?.session?.account,...Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.value.trim()]))});}
    catch(error){status.textContent=error.message;return;}
    button.disabled=true;
    try{
      const candidate=await session.request({request});
      if(disposed||!view.querySelector?.('#swap-review')||panel.parentElement!==view){clear('Review invalidated by navigation');return;}
      session.current();
      result.textContent=readOnlyReviewLines(candidate).join('\n');result.hidden=false;
      status.textContent='Read-only candidate received. No wallet transaction is available.';
    }catch(error){if(!disposed){result.hidden=true;result.textContent='';status.textContent=String(error?.message??'Quote review unavailable');}}
    finally{if(!disposed)refresh();}
  }
  button.addEventListener('click',onFetch);
  refresh();
  function dispose(){if(disposed)return;session.dispose();disposed=true;button.removeEventListener('click',onFetch);for(const input of Object.values(fields))input.removeEventListener('input',onChange);panel.remove();}
  return {refresh,clear,dispose,session,panel};
}
