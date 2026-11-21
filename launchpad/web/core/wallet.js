const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const HASH=/^0x[0-9a-fA-F]{64}$/;
const QUANTITY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const WORD=/^[0-9a-fA-F]{64}$/;
const SPECS={
  contribute:['91d216e2',3,'allocationRegistryAddress'],
  claim:['84cc9dfb',2,'allocationRegistryAddress'],
  'refund-prepare':['e6080b26',1,'crowdfundingIntegrationAddress'],
  'refund-record':['b24201a5',2,'allocationRegistryAddress'],
  'bind-identity':['b3b9e906',1,'crowdfundingIntegrationAddress'],
  'register-intent':['558218c7',3,'crowdfundingIntegrationAddress'],
  'link-dispute':['b528b306',2,'crowdfundingIntegrationAddress'],
  'open-dispute':['9a1a3815',6,'arbitrationCasesAddress'],
  'publish-outcome':['a7fdd8cd',2,'crowdfundingIntegrationAddress'],
  'recover-unallocated':['158e5e19',2,'crowdfundingIntegrationAddress'],
  'reconcile-refund':['5367eab9',1,'crowdfundingIntegrationAddress'],
  'approve-conversion':['095ea7b3',2,'approvedInputAsset'],
  'pay-conversion':['a6db208d',10,'payRouterAddress']
};
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.toLowerCase()===b.toLowerCase();
function word(v){if(typeof v!=='string')throw Error('INVALID_REVIEW_ARGUMENT');const s=v.startsWith('0x')?v.slice(2):v;if(!WORD.test(s))throw Error('INVALID_REVIEW_ARGUMENT');return s.toLowerCase();}
function numericWord(v){if(typeof v!=='string'||!/^(?:0|[1-9][0-9]*)$/.test(v)||BigInt(v)>=2n**256n)throw Error('INVALID_REVIEW_ARGUMENT');return BigInt(v).toString(16).padStart(64,'0');}
function addressWord(v){if(!ADDRESS.test(v||''))throw Error('INVALID_REVIEW_ARGUMENT');return v.slice(2).toLowerCase().padStart(64,'0');}
function validateTransaction(config,review){
  const b=review?.binding,tx=review?.transaction;
  if(!b||!ADDRESS.test(b.account||'')||!HASH.test(b.saleId||'')||
    !Number.isSafeInteger(b.preparedAt)||b.preparedAt>Date.now()+5000||
    Date.now()-b.preparedAt>120000)throw Error('STALE_TRANSACTION_REVIEW');
  if(b.kind!==review.kind||!b.request||!same(b.request.account,b.account)||
    !same(b.request.saleId,b.saleId))throw Error('REVIEW_CONTEXT_MISMATCH');
  const mode=review.kind==='refund'?(b.request.refundCommitment?'refund-record':'refund-prepare'):review.kind;
  const spec=SPECS[mode];if(!spec)throw Error('UNSUPPORTED_TRANSACTION_SELECTOR');
  const [selector,length,target]=spec;
  if(!ADDRESS.test(tx?.to||'')||!same(tx.to,config?.registry?.[target])||
     !QUANTITY.test(tx?.value)||BigInt(tx.value)!==0n)throw Error('UNEXPECTED_TRANSACTION_TARGET_OR_VALUE');
  const data=tx.data;
  if(typeof data!=='string'||data.length!==10+length*64||data.slice(0,10).toLowerCase()!=='0x'+selector||
    !/^[0-9a-fA-F]+$/.test(data.slice(2)))throw Error('INVALID_CANONICAL_CALLDATA');
  const args=Array.from({length},(_,i)=>data.slice(10+i*64,74+i*64).toLowerCase());
  const req=b.request;
  const requireArg=(index,expected)=>{if(args[index]!==expected)throw Error('REVIEW_ARGUMENT_MISMATCH');};
  const sale=word(req.saleId);
  if(['contribute','claim','refund-prepare','refund-record','register-intent','link-dispute',
    'recover-unallocated'].includes(mode))requireArg(0,sale);
  if(mode==='contribute'){requireArg(1,numericWord(req.amount));requireArg(2,word(req.paymentId));}
  if(mode==='claim')requireArg(1,word(req.deliveryCommitment));
  if(mode==='refund-record')requireArg(1,word(req.refundCommitment));
  if(mode==='bind-identity')requireArg(0,word(req.profileId));
  if(mode==='register-intent'){requireArg(1,numericWord(req.amount));requireArg(2,numericWord(req.nonce));}
  if(mode==='link-dispute')requireArg(1,word(req.caseId));
  if(mode==='open-dispute'){requireArg(3,sale);requireArg(4,word(req.claimHash));requireArg(5,word(req.requestedRemedyHash));for(const i of [1])if(args[i].slice(0,24)!=='0'.repeat(24))throw Error('INVALID_REVIEW_ARGUMENT');}
  if(mode==='publish-outcome'){requireArg(0,sale);requireArg(1,addressWord(req.account));}
  if(mode==='recover-unallocated')requireArg(1,word(req.paymentId));
  if(mode==='reconcile-refund')requireArg(0,word(req.paymentId));
  if(mode==='approve-conversion'||mode==='pay-conversion'){
    const q=b.quote;
    if(!q||!same(q.saleId,b.saleId)||!same(q.inputAsset,req.inputAsset)||
      q.amount!==req.amount||q.nonce!==req.nonce||q.marketId!==req.marketId||
      q.maxInput!==req.maxInput||q.minOutput!==req.minOutput||
      !Number.isSafeInteger(q.expiresAt)||!Number.isSafeInteger(q.source?.at)||
      q.expiresAt<=q.source.at)throw Error('STALE_CONVERSION_QUOTE');
    if(mode==='approve-conversion'){
      requireArg(0,addressWord(q.approval.spender));requireArg(1,numericWord(q.approval.amount));
      if(!q.approveRequired)throw Error('STALE_CONVERSION_QUOTE');
    }else if(!same(tx.data,q.transaction?.data)||!same(tx.to,q.transaction?.to)||!q.canPay)
      throw Error('CONVERSION_QUOTE_CHANGED');
  }
  return true;
}
export async function connectWallet(ethereum){
  if(!ethereum?.request)throw new Error('injected wallet unavailable');
  const accounts=await ethereum.request({method:'eth_requestAccounts'});
  const account=accounts?.[0];if(!ADDRESS.test(account||''))throw new Error('wallet account unavailable');
  const chainId=await ethereum.request({method:'eth_chainId'});
  if(!QUANTITY.test(chainId))throw new Error('invalid wallet network');
  return {account,chainId};
}
export function executionGate({config,wallet,review}={}){
  if(!ADDRESS.test(wallet?.account||''))return {ok:false,reason:'WALLET_NOT_CONNECTED'};
  if(!QUANTITY.test(wallet?.chainId)||!same(wallet.chainId,config?.network?.chainId))return {ok:false,reason:'WRONG_NETWORK'};
  if(!ADDRESS.test(config?.registry?.launchpadRouterAddress||'')||
    !ADDRESS.test(config?.registry?.allocationRegistryAddress||'')||
    !ADDRESS.test(config?.registry?.crowdfundingIntegrationAddress||''))return {ok:false,reason:'CANONICAL_ADDRESSES_UNRESOLVED'};
  if(!review?.canonical||review.schema!=='420-launchpad-transaction-review-v1')return {ok:false,reason:'CANONICAL_REVIEW_REQUIRED'};
  if(!same(review?.binding?.account,wallet.account)||!same(review?.binding?.chainId,wallet.chainId))return {ok:false,reason:'WALLET_SESSION_CHANGED'};
  try{validateTransaction(config,review);}catch(e){return {ok:false,reason:e.message};}
  return {ok:true,reason:null};
}
export async function submitReviewedTransaction({ethereum,config,wallet,review,revalidate,sessionValid}={}){
  const gate=executionGate({config,wallet,review});if(!gate.ok)throw new Error(gate.reason);
  if(typeof revalidate==='function')await revalidate();
  const freshGate=executionGate({config,wallet,review});if(!freshGate.ok)throw new Error(freshGate.reason);
  const [currentChain,accounts]=await Promise.all([
    ethereum.request({method:'eth_chainId'}),ethereum.request({method:'eth_accounts'})
  ]);
  if(!same(currentChain,wallet.chainId)||!Array.isArray(accounts)||accounts.length!==1||
    !same(accounts[0],wallet.account)|| (sessionValid&&!sessionValid()))throw new Error('WALLET_SESSION_CHANGED');
  const tx={from:wallet.account,to:review.transaction.to,data:review.transaction.data,value:review.transaction.value};
  return ethereum.request({method:'eth_sendTransaction',params:[tx]});
}
