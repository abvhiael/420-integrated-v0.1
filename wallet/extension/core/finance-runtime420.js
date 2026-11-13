// W15.6-M10: deterministic approval/execution review; never trust user-provided calldata.
import {parseUnits} from '../vendor/ethers-6.17.0.min.js';
import {normalizeFinanceProvider420,verifyFinanceDeployment420,quoteFinanceRoutes420,
 assertFinanceQuoteFresh420,financeQuoteIdentity420,readFinanceAllowance420,
 financeApprovalCall420,financeBridgeCall420,buildFinanceSwapCall420,readFinanceValidator420} from './finance420.js';
const DECIMAL=/^(?:0|[1-9]\d*)(?:\.\d+)?$/;
const FAIL=x=>{throw new Error(x);};
const SAME=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export function financeRaw420(input,decimals){
 if(typeof input!=='string'||input.length>90||!DECIMAL.test(input)||
    !Number.isInteger(decimals)||decimals<0||decimals>36)FAIL('Enter a positive decimal amount in verified token units');
 const n=parseUnits(input,decimals);
 if(n<=0n||n>=2n**256n)FAIL('Unsupported positive token amount');
 return n.toString();
}
export function financeProviderCatalog420(config,chainId){
 const records=Array.isArray(config?.financeProviders)?config.financeProviders:[];
 return records.flatMap(p=>{try{return [normalizeFinanceProvider420(p,chainId)];}catch{return [];}});
}
export function financeToken420(state,token){
 const found=state?.portfolio?.tokens?.find(t=>t.address?.toLowerCase()===token.toLowerCase());
 if(!found||found.verified!==true||found.hidden||found.spam||
    found.balance?.status!=='spendable'||!Number.isInteger(found.decimals))
   FAIL('Source token is not verified and spendable on selected chain');
 return found;
}
export async function financeOptions420({provider,config,state,kind,amountInput,slippageBps=50}){
 const chainId=state?.network?.expectedChainId,account=state?.account?.kind==='eoa'||state?.account?.kind==='hardware'?state?.selectedAccount:state?.account?.smartAccount;
 if(!chainId||state.network.status!=='matched'||!account)FAIL('Verified on-chain payer and wallet chain required');
 const approved=financeProviderCatalog420(config,chainId).filter(p=>
   kind==='swap'?['420exchange','third-party'].includes(p.kind):
   kind==='bridge'?['420bridge','third-party-bridge'].includes(p.kind):false);
 const result=[];
 for(const p of approved){
   try{
     const token=financeToken420(state,p.tokenIn||p.asset);
     const inputRaw=financeRaw420(amountInput,token.decimals);
     if(BigInt(token.balance.spendable)<BigInt(inputRaw))continue;
     if(kind==='swap')result.push(...await quoteFinanceRoutes420(provider,p,{
       account,amountRaw:inputRaw,slippageBps
     }));
     else{
       await verifyFinanceDeployment420(provider,p);
       const recipient=account;
       const tx=financeBridgeCall420(p,{account,recipient,amountRaw:inputRaw});
       result.push({kind:'bridge',providerId:p.id,routeId:p.routeId,
         chainId:p.chainId,destinationChainId:p.destinationChainId,
         account,recipient,amountRaw:inputRaw,
         asset:p.asset,router:p.router,spender:p.spender,
         networkFeeWei:p.networkFeeWei,transaction:tx,quotedAt:Date.now(),
         outputUnknown:true,estimatedDestinationFeeUnknown:true});
     }
   }catch{/* Missing liquidity, verified contracts or balances cannot produce options. */}
 }
 return kind==='swap'?result.sort((a,b)=>BigInt(a.outputRaw)===BigInt(b.outputRaw)?
    a.providerId.localeCompare(b.providerId):BigInt(a.outputRaw)>BigInt(b.outputRaw)?-1:1):result;
}
export function financePlan420(p,option){
 assertFinanceQuoteFresh420(option);
 if(option.kind==='bridge'){
   if(!['420bridge','third-party-bridge'].includes(p.kind)||option.providerId!==p.id||
      option.router!==p.router||option.chainId!==p.chainId||option.destinationChainId!==p.destinationChainId||
      option.spender!==p.spender||option.asset!==p.asset||option.routeId!==p.routeId||
      option.networkFeeWei!==p.networkFeeWei)FAIL('Bridge route or fee changed');
   const tx=financeBridgeCall420(p,{account:option.account,recipient:option.recipient,amountRaw:option.amountRaw});
   if(!SAME(tx,option.transaction))FAIL('Bridge transaction altered after review');
   return {transaction:tx,token:p.asset,spender:p.spender,amountRaw:option.amountRaw,
     kind:'bridge',destinationChainId:p.destinationChainId};
 }
 const tx=buildFinanceSwapCall420(p,option);
 return {transaction:tx,token:p.tokenIn,spender:p.spender,amountRaw:option.inputRaw,
   kind:'swap',expectedOutputRaw:option.outputRaw,minimumOutputRaw:option.minimumRaw,
   slippageBps:option.slippageBps,priceImpactBps:option.impactBps};
}
export async function financePrepare420({provider,config,state,option,feeQuote}){
 const payer=state?.account?.kind==='eoa'||state?.account?.kind==='hardware'?state?.selectedAccount:state?.account?.smartAccount;
 if(!state||state.network.status!=='matched'||option.chainId!==state.network.expectedChainId||
    option.account!==payer)FAIL('Finance payer or network changed');
 const p=financeProviderCatalog420(config,option.chainId).find(x=>x.id===option.providerId);
 if(!p)FAIL('Provider is not release approved');
 await verifyFinanceDeployment420(provider,p);
 const plan=financePlan420(p,option);
 if(plan.kind==='swap'){
   const routes=await quoteFinanceRoutes420(provider,p,{
     account:option.account,amountRaw:option.inputRaw,slippageBps:option.slippageBps});
   const fresh=routes.find(x=>x.routeId===option.routeId);
   if(!fresh||financeQuoteIdentity420(fresh)!==financeQuoteIdentity420(option))
     FAIL('Executable quote changed. Recompare routes before authorization');
 }
 const allowance=await readFinanceAllowance420(provider,plan.token,option.account,plan.spender);
 if(allowance<BigInt(plan.amountRaw)){
   const approval=financeApprovalCall420(plan.token,option.account,plan.spender,plan.amountRaw);
   return {phase:'allowance',call:approval,allowance:allowance.toString(),required:plan.amountRaw,
     maxApproval:plan.amountRaw,spender:plan.spender,token:plan.token,plan,fee:await feeQuote(approval)};
 }
 const simulation=await provider.request('eth_call',[plan.transaction,'latest']);
 if(typeof simulation!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(simulation))
   FAIL('Finance router simulation did not return valid call data');
 const fee=await feeQuote(plan.transaction);
 return {phase:'execute',call:plan.transaction,allowance:allowance.toString(),
   spender:plan.spender,token:plan.token,plan,fee};
}
export function assertFinanceReview420(before,after){
 if(!before||!after||before.phase!==after.phase||!SAME(before.call,after.call)||
   before.spender!==after.spender||before.token!==after.token||
   !SAME(before.plan,after.plan)||!SAME(before.fee??null,after.fee??null))
    FAIL('Finance transaction, approval, quote or fee changed; review again');
 return true;
}
export async function financeStakeStatus420({provider,config,state,validatorId}){
 const chainId=state?.network?.expectedChainId;
 if(!chainId||state.network.status!=='matched')FAIL('Verified chain required');
 const p=financeProviderCatalog420(config,chainId).find(x=>x.kind==='420stake');
 if(!p)FAIL('Deployed verified 420Stake facade unavailable');
 return readFinanceValidator420(provider,p,validatorId);
}
