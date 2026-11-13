// W15.6-M10. Wallet finance policy is not a quote authority: deployed router,
// active on-chain markets/routes, exact chain, and pinned runtime code hashes are.
import {Interface,AbiCoder,keccak256,ZeroAddress} from '../vendor/ethers-6.17.0.min.js';
export const FINANCE_ROUTER_ABI_420=[
  'function quoteExactInput(bytes32 marketId,bytes32 routeId,address tokenIn,uint256 amountIn,bytes routeData) view returns (address tokenOut,uint256 amountOut,uint256 priceImpactBps)',
  'function swapExactInput(bytes32 marketId,bytes32 routeId,address tokenIn,uint256 amountIn,uint256 minAmountOut,address recipient,bytes routeData) returns (uint256 amountOut)'
];
export const FINANCE_BRIDGE_ABI_420=[
  'function initiateOutbound(bytes32 adapterId,bytes32 routeId,bytes32 assetId,bytes recipient,uint256 amount,bytes extra) payable returns (bytes32)',
  'event OutboundInitiated(bytes32 indexed routeId,bytes32 indexed adapterId,bytes32 sourceMessageId)',
  'event InboundAccepted(bytes32 indexed transferId,bytes32 indexed adapterId)'
];
export const FINANCE_STAKE_ABI_420=[
  'function delegationEnabled() view returns (bool)',
  'function stakeWeightedVotingEnabled() view returns (bool)',
  'function effectiveBond() view returns (uint256)',
  'function validatorStatus(bytes32) view returns (uint8)',
  'function validatorBondComposition(bytes32) view returns (uint256,uint256,uint256,uint256)',
  'function validatorRewardAccrued(bytes32) view returns (uint256)'
];
const exchange=new Interface(FINANCE_ROUTER_ABI_420),bridge=new Interface(FINANCE_BRIDGE_ABI_420);
const stake=new Interface(FINANCE_STAKE_ABI_420);
const ADDRESS=/^0x[0-9a-fA-F]{40}$/,BYTES32=/^0x[0-9a-fA-F]{64}$/,HEX=/^0x(?:[0-9a-fA-F]{2})*$/;
const MAX=2n**256n-1n;
function check(ok,msg){if(!ok)throw new Error(msg);}
const addr=x=>{check(typeof x==='string'&&ADDRESS.test(x)&&x.toLowerCase()!==ZeroAddress.toLowerCase(),'Invalid contract or token address');return x.toLowerCase();};
const b32=x=>{check(typeof x==='string'&&BYTES32.test(x)&&BigInt(x)!==0n,'Invalid route/market/asset identity');return x.toLowerCase();};
const amount=x=>{check(typeof x==='string'&&/^(0|[1-9][0-9]*)$/.test(x),'Raw token amount must be decimal integer');const n=BigInt(x);check(n>0n&&n<=MAX,'Amount exceeds supported uint256 range');return n;};
const hex=x=>{check(typeof x==='string'&&HEX.test(x)&&x.length<=8194,'Invalid bounded contract calldata');return x.toLowerCase();};
const chain=x=>{check(typeof x==='string'&&/^0x[0-9a-fA-F]+$/.test(x)&&BigInt(x)>0n,'Invalid EIP-155 chain');return '0x'+BigInt(x).toString(16);};
const quantity=x=>'0x'+BigInt(x).toString(16);
const compact=x=>JSON.stringify(x);
export function normalizeFinanceProvider420(raw,expectedChain){
  check(raw&&typeof raw==='object'&&raw.releaseApproved===true,'No release-approved finance provider');
  check(['420exchange','third-party','420bridge','third-party-bridge','420stake'].includes(raw.kind),'Unsupported finance provider');
  const out={id:String(raw.id||''),label:String(raw.label||''),kind:raw.kind,chainId:chain(raw.chainId),
    router:addr(raw.router),codeHash:b32(raw.codeHash),releaseApproved:true};
  check(/^[a-z0-9._:-]{1,48}$/.test(out.id)&&out.label.length>0&&out.label.length<=80,'Unqualified provider identity');
  check(out.chainId===chain(expectedChain),'Provider is on a different network');
  if(['420exchange','third-party'].includes(out.kind)){
    out.spender=addr(raw.spender);out.spenderCodeHash=b32(raw.spenderCodeHash);
    out.tokenIn=addr(raw.tokenIn);out.tokenOut=addr(raw.tokenOut);
    check(out.tokenIn!==out.tokenOut,'Same-token quote is invalid');
    out.marketId=b32(raw.marketId);
    out.routes=Array.isArray(raw.routes)?raw.routes.map(r=>({
      id:b32(r.id),data:hex(r.data),name:String(r.name||'Route').slice(0,60),
    })):[];
    check(out.routes.length>=1&&out.routes.length<=8&&new Set(out.routes.map(r=>r.id)).size===out.routes.length,'Must provide distinct approved routes');
  }
  if(['420bridge','third-party-bridge'].includes(out.kind)){
    out.adapterId=b32(raw.adapterId);out.routeId=b32(raw.routeId);out.assetId=b32(raw.assetId);
    out.destinationChainId=chain(raw.destinationChainId);
    check(out.destinationChainId!==out.chainId,'Bridge destination must differ from source');
    out.asset=addr(raw.asset);
    out.recipientEncoding=raw.recipientEncoding==='evm20'?'evm20':null;
    check(out.recipientEncoding==='evm20','Unsupported destination recipient encoding');
    out.extra=hex(raw.extra??'0x');out.networkFeeWei=String(raw.networkFeeWei??'');
    check(/^(0|[1-9][0-9]*)$/.test(out.networkFeeWei),'Verified bridge network fee is not configured');
  }
  return Object.freeze(out);
}
export async function verifyFinanceDeployment420(provider,p){
  const code=await provider.request('eth_getCode',[p.router,'latest']);
  check(typeof code==='string'&&HEX.test(code)&&code.length>4&&keccak256(code).toLowerCase()===p.codeHash,'Finance router deployment is missing or code hash differs');
  if(p.spender){
    const spender=await provider.request('eth_getCode',[p.spender,'latest']);
    check(typeof spender==='string'&&HEX.test(spender)&&spender.length>4&&keccak256(spender).toLowerCase()===p.spenderCodeHash,'Finance spender code hash differs');
  }
  return true;
}
export async function quoteFinanceRoutes420(provider,p,{account,amountRaw,slippageBps=50}){
  check(['420exchange','third-party'].includes(p.kind),'Not a swap provider');
  check(Number.isInteger(slippageBps)&&slippageBps>=1&&slippageBps<=500,'Slippage must be 1–500 bps');
  addr(account);const input=amount(amountRaw);
  await verifyFinanceDeployment420(provider,p);
  const results=[];
  for(const route of p.routes){
    try{
      const data=exchange.encodeFunctionData('quoteExactInput',[p.marketId,route.id,p.tokenIn,input,route.data]);
      const result=await provider.request('eth_call',[{from:account,to:p.router,data},'latest']);
      const [tokenOut,out,impact]=exchange.decodeFunctionResult('quoteExactInput',result);
      check(addr(tokenOut)===p.tokenOut&&out>0n&&impact<=10000n,'On-chain quote output/impact mismatched route');
      const minimum=out*(10000n-BigInt(slippageBps))/10000n;
      check(minimum>0n,'Slippage reduces minimum output to zero');
      results.push({providerId:p.id,routeId:route.id,routeName:route.name,
        inputRaw:input.toString(),outputRaw:out.toString(),minimumRaw:minimum.toString(),
        impactBps:Number(impact),slippageBps,router:p.router,spender:p.spender,
        tokenIn:p.tokenIn,tokenOut:p.tokenOut,marketId:p.marketId,routeData:route.data,
        account:account.toLowerCase(),chainId:p.chainId,quotedAt:Date.now()});
    }catch{/* A failing route cannot be displayed as liquid or executable. */}
  }
  return results.sort((a,b)=>BigInt(a.outputRaw)===BigInt(b.outputRaw)?a.routeId.localeCompare(b.routeId):
    BigInt(a.outputRaw)>BigInt(b.outputRaw)?-1:1);
}
export function assertFinanceQuoteFresh420(quote,now=Date.now()){
  check(quote&&Number.isSafeInteger(quote.quotedAt)&&now>=quote.quotedAt&&now-quote.quotedAt<=30000,'Finance quote expired; refresh');
  check(BigInt(quote.minimumRaw)>0n&&BigInt(quote.minimumRaw)<=BigInt(quote.outputRaw),'Invalid slippage boundary');
  return true;
}
export function financeQuoteIdentity420(q){
  return compact([q.providerId,q.routeId,q.account,q.chainId,q.router,q.spender,q.marketId,q.tokenIn,q.tokenOut,
    q.routeData,q.inputRaw,q.outputRaw,q.minimumRaw,q.impactBps,q.slippageBps]);
}
export function buildFinanceSwapCall420(p,q){
  check(p.id===q.providerId&&p.router===q.router&&p.spender===q.spender&&p.chainId===q.chainId&&
    p.marketId===q.marketId&&p.tokenIn===q.tokenIn&&p.tokenOut===q.tokenOut,'Quote/provider binding changed');
  check(p.routes.some(r=>r.id===q.routeId&&r.data===q.routeData),'Unapproved finance route');
  return {from:q.account,to:p.router,value:'0x0',
    data:exchange.encodeFunctionData('swapExactInput',[p.marketId,q.routeId,p.tokenIn,amount(q.inputRaw),
      amount(q.minimumRaw),q.account,q.routeData])};
}
export const FINANCE_ALLOWANCE_ABI_420=['function allowance(address,address) view returns (uint256)','function approve(address,uint256) returns (bool)'];
const erc20=new Interface(FINANCE_ALLOWANCE_ABI_420);
export async function readFinanceAllowance420(provider,token,owner,spender){
  const data=erc20.encodeFunctionData('allowance',[addr(owner),addr(spender)]);
  const reply=await provider.request('eth_call',[{to:addr(token),data},'latest']);
  const [n]=erc20.decodeFunctionResult('allowance',reply);
  return n;
}
export function financeApprovalCall420(token,owner,spender,raw){
  return {from:addr(owner),to:addr(token),value:'0x0',data:erc20.encodeFunctionData('approve',[addr(spender),amount(raw)])};
}
export function financeBridgeCall420(p,{account,recipient,amountRaw}){
  check(['420bridge','third-party-bridge'].includes(p.kind),'Not a bridge provider');
  check(p.recipientEncoding==='evm20','Unsupported recipient bytes');
  const r=addr(recipient),n=amount(amountRaw);
  return {from:addr(account),to:p.router,value:quantity(p.networkFeeWei),
    data:bridge.encodeFunctionData('initiateOutbound',[p.adapterId,p.routeId,p.assetId,r,n,p.extra])};
}
export async function readFinanceValidator420(provider,p,validatorId){
  check(p.kind==='420stake','Only canonical 420Stake validator information supported');
  b32(validatorId);await verifyFinanceDeployment420(provider,p);
  async function call(fn,args=[]){const data=stake.encodeFunctionData(fn,args);
    return stake.decodeFunctionResult(fn,await provider.request('eth_call',[{to:p.router,data},'latest']));}
  const delegation=(await call('delegationEnabled'))[0];
  check(delegation===false,'Unexpected validator delegation policy; independently review deployed contract');
  const [status]=await call('validatorStatus',[validatorId]);
  const [owned,credit,effective,slashed]=await call('validatorBondComposition',[validatorId]);
  const [accrued]=await call('validatorRewardAccrued',[validatorId]);
  return {validatorId,status:Number(status),ownedBond:owned.toString(),protocolCredit:credit.toString(),
    effectiveBond:effective.toString(),slashed:slashed.toString(),rewardAccrued:accrued.toString(),
    delegationEnabled:false,stakeWeightedVoting:false,executionAvailable:false};
}
export function bridgeReceiptEvidence420({receipt,router,routeId,adapterId}){
  check(receipt&&receipt.status==='0x1'&&BYTES32.test(receipt.blockHash)&&BYTES32.test(receipt.transactionHash),
    'No successful canonical source receipt');
  const matches=[];
  for(const log of receipt.logs??[]){
    if(log.address?.toLowerCase()!==router.toLowerCase())continue;
    let parsed;try{parsed=bridge.parseLog(log);}catch{continue;}
    if(parsed?.name!=='OutboundInitiated')continue;
    if(parsed.args.routeId.toLowerCase()===routeId.toLowerCase()&&parsed.args.adapterId.toLowerCase()===adapterId.toLowerCase()&&
      BYTES32.test(parsed.args.sourceMessageId)&&BigInt(parsed.args.sourceMessageId)>0n)
      matches.push(parsed.args.sourceMessageId.toLowerCase());
  }
  check(matches.length===1,'Exactly one matching source gateway outbound event required');
  return {sourceTxHash:receipt.transactionHash.toLowerCase(),sourceBlockHash:receipt.blockHash.toLowerCase(),
    blockNumber:receipt.blockNumber,sourceMessageId:matches[0],state:'source-included'};
}
export function bridgeStage420(previous,observation){
  const allowed={ 'source-submitted':['source-included','source-reverted','source-reorganized'],
    'source-included':['source-finalized','source-reorganized'],
    'source-finalized':['proof-pending','destination-included','source-reorganized'],
    'proof-pending':['destination-included','source-reorganized'],
    'destination-included':['destination-finalized','destination-reorganized'],
    'destination-finalized':['beneficiary-settlement-unverified'],
    'destination-reorganized':['destination-included','proof-pending'] };
  check(allowed[previous]?.includes(observation),'Invalid cross-chain state transition');
  return observation;
}
