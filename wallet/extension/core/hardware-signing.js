import {Transaction,Signature,TypedDataEncoder,verifyTypedData,verifyMessage,keccak256,getBytes,recoverAddress} from '../vendor/ethers-6.17.0.min.js';

const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const QTY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
function require420(ok,why){if(!ok)throw new Error(why);}
function qty420(x,name){
  require420(typeof x==='string'&&QTY.test(x),name+' must be canonical hexadecimal quantity');
  return BigInt(x);
}
function hex420(n){return '0x'+BigInt(n).toString(16);}
export function hardwarePath420(path){
  const match=/^m\/44'\/60'\/(0|[1-9]\d{0,2})'\/0\/(0|[1-9]\d{0,2})$/.exec(path||'');
  require420(!!match&&+match[1]<=499&&+match[2]<=499,'Unapproved Ethereum hardware derivation path');
  return {path,account:Number(match[1]),index:Number(match[2])};
}
export function assertHardwareAccount420(meta,account){
  require420(meta?.type==='hardware'&&['ledger','trezor'].includes(meta.provider),'Selected account is not paired hardware');
  require420(typeof account==='string'&&ADDRESS.test(account),'Invalid hardware account address');
  const path=hardwarePath420(meta.path);
  require420(meta.signingQualified===true,'Hardware signing is not enabled for this device account');
  return {provider:meta.provider,account:account.toLowerCase(),...path};
}
export function prepareHardwareTransaction420(transaction,chainId,account){
  require420(transaction&&typeof transaction==='object'&&!Array.isArray(transaction),'Missing reviewed transaction');
  require420(typeof account==='string'&&ADDRESS.test(account),'Invalid transaction account');
  require420(typeof transaction.from==='string'&&transaction.from.toLowerCase()===account.toLowerCase(),'Hardware sender mismatch');
  require420(qty420(chainId,'Network chain ID')>0n,'Invalid chain');
  require420(qty420(transaction.chainId,'Transaction chain ID')===BigInt(chainId),'Reviewed chain changed');
  require420(transaction.executionModel==='hardware','Incorrect hardware execution model');
  require420(typeof transaction.to==='string'&&ADDRESS.test(transaction.to),'Contract creation requires separate qualified review');
  require420(typeof transaction.data==='string'&&/^0x(?:[\da-fA-F]{2})*$/.test(transaction.data)&&transaction.data.length<=131074,'Invalid transaction calldata');
  const nonce=qty420(transaction.nonce,'Nonce');
  const gasLimit=qty420(transaction.gasLimit,'Gas limit');
  const maxFeePerGas=qty420(transaction.maxFeePerGas,'Max fee');
  const maxPriorityFeePerGas=qty420(transaction.maxPriorityFeePerGas,'Priority fee');
  const value=qty420(transaction.value??'0x0','Value');
  require420(gasLimit>0n&&maxFeePerGas>=maxPriorityFeePerGas,'Invalid EIP-1559 gas/fee caps');
  const tx=Transaction.from({
    type:2,chainId:BigInt(chainId),nonce,gasLimit,maxFeePerGas,
    maxPriorityFeePerGas,to:transaction.to,data:transaction.data,value,
    accessList:[],
  });
  return {tx,chainId:hex420(chainId),nonce:hex420(nonce),unsignedSerialized:tx.unsignedSerialized,
    from:account.toLowerCase(),to:transaction.to.toLowerCase(),value:hex420(value),data:transaction.data.toLowerCase(),
    gasLimit:hex420(gasLimit),maxFeePerGas:hex420(maxFeePerGas),
    maxPriorityFeePerGas:hex420(maxPriorityFeePerGas)};
}
export function acceptHardwareTxSignature420(prepared,signature){
  require420(prepared?.tx&&signature,'Missing reviewed hardware transaction or signature');
  const sig=Signature.from(signature);
  const signed=Transaction.from(prepared.unsignedSerialized);
  signed.signature=sig;
  require420(signed.from?.toLowerCase()===prepared.from,'Hardware transaction signature does not match selected account');
  require420(signed.unsignedSerialized===prepared.unsignedSerialized,'Hardware transaction fields changed while signing');
  return {raw:signed.serialized,hash:signed.hash.toLowerCase(),from:prepared.from,
    to:prepared.to,chainId:prepared.chainId,nonce:prepared.nonce,value:prepared.value,data:prepared.data,
    gasLimit:prepared.gasLimit,maxFeePerGas:prepared.maxFeePerGas,maxPriorityFeePerGas:prepared.maxPriorityFeePerGas};
}
export function prepareHardwareTypedData420(params,chainId,account){
  require420(Array.isArray(params)&&params.length===2&&typeof params[0]==='string'&&params[0].toLowerCase()===account.toLowerCase(),'Hardware typed-data signer mismatch');
  require420(typeof params[1]==='string'&&params[1].length<=131072,'Typed-data payload too large');
  let payload;try{payload=JSON.parse(params[1]);}catch{throw new Error('Malformed EIP-712 JSON');}
  require420(payload&&typeof payload==='object'&&!Array.isArray(payload)&&payload.domain&&payload.types&&payload.message&&typeof payload.primaryType==='string','Malformed EIP-712 structure');
  require420(payload.domain.chainId!==undefined,'EIP-712 domain must explicitly bind the chain');
  require420(BigInt(payload.domain.chainId)===qty420(chainId,'Chain'),'EIP-712 domain chain mismatch');
  const types={...payload.types};delete types.EIP712Domain;
  require420(Object.keys(types).length>0&&Array.isArray(types[payload.primaryType]),'Missing typed-data primary type');
  const digest=TypedDataEncoder.hash(payload.domain,types,payload.message);
  const domainHash=TypedDataEncoder.hashDomain(payload.domain);
  const messageHash=TypedDataEncoder.from(types).hash(payload.message);
  return {payload,types,digest,domainHash,messageHash,account:account.toLowerCase()};
}
export function acceptHardwareTypedSignature420(prepared,signature){
  const result=Signature.from(signature).serialized;
  require420(verifyTypedData(prepared.payload.domain,prepared.types,prepared.payload.message,result).toLowerCase()===prepared.account,
    'Hardware EIP-712 signature does not match selected account');
  return result;
}
export function acceptHardwarePersonalSignature420(account,data,signature){
  require420(typeof data==='string'&&/^0x(?:[\da-fA-F]{2})*$/.test(data),'Invalid EIP-191 hex message');
  const result=Signature.from(signature).serialized;
  require420(verifyMessage(getBytes(data),result).toLowerCase()===account.toLowerCase(),'Hardware personal signature signer mismatch');
  return result;
}
export async function preBroadcastHardware420(provider,prepared,assertRecipient){
  require420(BigInt(await provider.request('eth_chainId',[]))===BigInt(prepared.chainId),'Hardware network changed');
  const confirmed=await provider.request('eth_getTransactionCount',[prepared.from,'latest']);
  require420(BigInt(confirmed)<=BigInt(prepared.nonce),'Hardware nonce already confirmed');
  const block=await provider.request('eth_getBlockByNumber',['latest',false]);
  require420(block?.baseFeePerGas!==undefined&&
    BigInt(prepared.maxFeePerGas)>=BigInt(block.baseFeePerGas)+BigInt(prepared.maxPriorityFeePerGas),
    'Hardware transaction fee cap below current base fee');
  if(assertRecipient)await assertRecipient();
  return true;
}
