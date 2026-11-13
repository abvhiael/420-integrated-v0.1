import {normalizeAddress} from './abi.js';
import {normalizeExtensionFeeChoice420} from './extension-fee-preflight.js';
import {assertWalletChain420} from './transaction-lifecycle.js';
const Q=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const U128=(1n<<128n)-1n;
const asHex=n=>'0x'+n.toString(16);
function quantity(v,label,{allowZero=false}={}){
 if(typeof v!=='string'||!Q.test(v))throw new Error('invalid '+label+' quantity');
 const n=BigInt(v);
 if(n>U128||(!allowZero&&n===0n))throw new Error('invalid '+label+' range');
 return n;
}
export async function quoteExtensionEoa420(provider,{
 chainId,from,transaction,choice,nonceOverride=null,allowPendingReplacement=false
}={}){
 await assertWalletChain420(provider,chainId);
 const signer=normalizeAddress(from),target=normalizeAddress(transaction?.to);
 const value=quantity(transaction.value??'0x0','value',{allowZero:true});
 const data=transaction.data??'0x';
 if(typeof data!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(data))throw new Error('invalid transaction calldata');
 const mode=normalizeExtensionFeeChoice420(choice);
 const tx={from:signer,to:target,value:asHex(value),data};
 try{await provider.request('eth_call',[tx,'pending']);}
 catch(error){throw new Error('EOA transaction simulation reverted: '+(error?.message||'call failed'));}
 const estimate=quantity(await provider.request('eth_estimateGas',[tx]),'gas estimate');
 const gasLimit=estimate+(estimate+4n)/5n;
 if(gasLimit>U128)throw new Error('gas estimate outside safe cap');
 const [pendingNonce,latestNonce,block,rawBalance]=await Promise.all([
  provider.request('eth_getTransactionCount',[signer,'pending']),
  provider.request('eth_getTransactionCount',[signer,'latest']),
  provider.request('eth_getBlockByNumber',['latest',false]),
  provider.request('eth_getBalance',[signer,'pending'])
 ]);
 const latest=quantity(latestNonce,'confirmed nonce',{allowZero:true});
 const pending=quantity(pendingNonce,'pending nonce',{allowZero:true});
 const nonce=nonceOverride==null?pending:quantity(nonceOverride,'replacement nonce',{allowZero:true});
 if(allowPendingReplacement){
  if(nonce<latest)throw new Error('EOA nonce already confirmed; replacement is unsafe');
 }else if(nonce!==pending)throw new Error('EOA pending nonce changed; review again');
 if(!block?.hash||typeof block?.baseFeePerGas!=='string')
  throw new Error('EIP-1559 block fee data unavailable');
 const base=quantity(block.baseFeePerGas,'base fee',{allowZero:true});
 const recommended=quantity(await provider.request('eth_maxPriorityFeePerGas',[]),'priority fee',{allowZero:true});
 const tip=recommended||1n;
 const multiple={economy:1n,standard:2n,priority:3n};
 const priority=mode.level==='custom'?BigInt(mode.maxPriorityFeePerGas):tip*multiple[mode.level];
 const max=mode.level==='custom'?BigInt(mode.maxFeePerGas):base*2n+priority;
 if(max>U128||priority>U128||priority>max||max<base+priority)
  throw new Error('EOA fee caps cannot cover the selected block base fee');
 const totalFeeWei=gasLimit*max;
 const balance=quantity(rawBalance,'pending EOA balance',{allowZero:true});
 if(balance<value+totalFeeWei)throw new Error('EOA balance is insufficient for amount plus maximum fee');
 await assertWalletChain420(provider,chainId);
 return Object.freeze({
  executionModel:'eoa',chainId,from:signer,to:target,nonce:asHex(nonce),
  maxFeePerGas:asHex(max),maxPriorityFeePerGas:asHex(priority),
  gasLimit:asHex(gasLimit),totalFeeWei:totalFeeWei.toString(),
  blockHash:block.hash,simulation:'eth_call',gasEstimate:'eth_estimateGas',
  replacement:allowPendingReplacement,
 });
}
