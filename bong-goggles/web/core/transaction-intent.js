const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const ALLOWED_METHODS=new Set(['eth_sendTransaction','personal_sign','eth_signTypedData_v4']);

function address(value,label){
  if(typeof value!=='string'||!ADDRESS.test(value)) throw new Error(`${label} must be an address`);
  return value.toLowerCase();
}

function normalizeValue(value='0x0'){
  if(typeof value!=='string'||!/^0x[0-9a-fA-F]+$/.test(value)) throw new Error('transaction value must be hex');
  return `0x${BigInt(value).toString(16)}`;
}

export function prepareWalletIntent({method,account,chainId,target=null,value='0x0',data='0x',summary,canonicalAction}={}){
  if(!ALLOWED_METHODS.has(method)) throw new Error('unsupported Wallet authority method');
  const normalizedAccount=address(account,'account');
  if(typeof chainId!=='string'||!/^0x[0-9a-fA-F]+$/.test(chainId)) throw new Error('hex chainId required');
  if(typeof summary!=='string'||summary.trim()==='') throw new Error('intent summary required');
  if(typeof canonicalAction!=='string'||canonicalAction.trim()==='') throw new Error('canonical action required');

  const intent={
    schema:'bg-wallet-intent-v1',
    method,
    account:normalizedAccount,
    chainId:`0x${BigInt(chainId).toString(16)}`,
    target:target==null?null:address(target,'target'),
    value:method==='eth_sendTransaction'?normalizeValue(value):'0x0',
    data:typeof data==='string'?data:null,
    summary:summary.trim(),
    canonicalAction:canonicalAction.trim(),
    requiresWalletApproval:true,
    locallyFinal:false,
    authoritative:false,
  };
  if(method==='eth_sendTransaction' && (typeof data!=='string'||!/^0x[0-9a-fA-F]*$/.test(data))) throw new Error('transaction data must be hex');
  return Object.freeze(intent);
}

export async function submitWalletIntent(provider,intent){
  if(!provider||typeof provider.request!=='function') throw new Error('420 Wallet provider required');
  if(!intent||intent.schema!=='bg-wallet-intent-v1'||intent.authoritative!==false) throw new Error('prepared Bong Goggles Wallet intent required');

  try{
    let result;
    if(intent.method==='eth_sendTransaction'){
      result=await provider.request({method:'eth_sendTransaction',params:[{
        from:intent.account,
        to:intent.target,
        value:intent.value,
        data:intent.data,
      }]});
    }else{
      throw Object.assign(new Error('signature intents require feature-specific payload construction'),{code:4200});
    }
    return Object.freeze({status:'pending',result,intent,canonicalConfirmationRequired:true,authoritative:false});
  }catch(error){
    if(error?.code===4001) return Object.freeze({status:'rejected',errorCode:4001,intent,authoritative:false});
    throw error;
  }
}

export function classifyTransactionReceipt(receipt){
  if(!receipt) return Object.freeze({status:'pending',canonical:false});
  const ok=receipt.status==='0x1'||receipt.status===1||receipt.status===true;
  return Object.freeze({
    status:ok?'confirmed':'reverted',
    canonical:true,
    transactionHash:receipt.transactionHash??null,
    blockNumber:receipt.blockNumber??null,
  });
}
