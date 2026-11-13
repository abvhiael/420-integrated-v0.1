import {HDNodeWallet,Wallet,Transaction} from '../vendor/ethers-6.17.0.min.js';
import {decryptVault420,DERIVATION_PATH_420} from './vault.js';
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const Q=/^0x[0-9a-fA-F]+$/;
const norm=x=>{if(typeof x!=='string'||!ADDRESS.test(x))throw new Error('invalid local signing address');return x.toLowerCase();};
const amount=(v,label)=>{if(typeof v!=='string'||!Q.test(v))throw new Error('invalid '+label);return BigInt(v);};
function signerFor(payload,from){
 for(const account of payload.wallets||[]){
  if(!account.accounts?.some(a=>a.address?.toLowerCase()===from))continue;
  if(account.type==='watch-only')throw new Error('watch-only address cannot sign');
  if(account.type==='private-key'){
    const signer=new Wallet(account.privateKey);
    if(signer.address.toLowerCase()!==from)throw new Error('imported EOA key mismatch');
    return signer;
  }
  if(account.type==='mnemonic'){
    const position=account.accounts.find(a=>a.address.toLowerCase()===from);
    if(!Number.isInteger(position.index)||position.index<0||position.index>=500)
      throw new Error('unrecognized BIP-44 derivation index');
    const signer=HDNodeWallet.fromPhrase(account.mnemonic,account.passphrase||'',
      DERIVATION_PATH_420+'/'+position.index);
    if(signer.address.toLowerCase()!==from)throw new Error('derived EOA key mismatch');
    return signer;
  }
 }
 throw new Error('selected EOA key not present in unlocked local vault');
}
/** Secret material stays in this short-lived extension authority page. Never log or
 * forward password, mnemonic, private key, vault payload, or signer object. */
export async function signExtensionEoa420({vaultRecord,password,account,transaction,chainId}={}){
 const from=norm(account),to=norm(transaction?.to);
 const chain=amount(chainId,'EIP-155 chain ID');
 if(chain<=0n)throw new Error('invalid signed chain ID');
 const nonce=amount(transaction?.nonce,'EOA nonce');
 const maxFee=amount(transaction?.maxFeePerGas,'maximum fee');
 const tip=amount(transaction?.maxPriorityFeePerGas,'priority fee');
 const gasLimit=amount(transaction?.gasLimit,'gas limit');
 const value=amount(transaction?.value??'0x0','native amount');
 const data=transaction?.data??'0x';
 if(!Number.isSafeInteger(Number(nonce))||tip>max||!gasLimit||
    typeof data!=='string'||!/^0x(?:[0-9a-fA-F]{2})*$/.test(data))
  throw new Error('invalid reviewed EOA signing parameters');
 let payload=null,signer=null;
 try{
  payload=await decryptVault420(vaultRecord,password);
  signer=signerFor(payload,from);
  const raw=await signer.signTransaction({
    type:2,chainId:chain,nonce:Number(nonce),to,value,data,gasLimit,
    maxFeePerGas:maxFee,maxPriorityFeePerGas:tip,
  });
  const signed=Transaction.from(raw);
  if(signed.type!==2||norm(signed.from)!==from||norm(signed.to)!==to||
    signed.chainId!==chain||BigInt(signed.nonce)!==nonce||signed.value!==value||
    signed.gasLimit!==gasLimit||signed.maxFeePerGas!==maxFee||
    signed.maxPriorityFeePerGas!==tip||signed.data.toLowerCase()!==data.toLowerCase()||
    !signed.hash||!/^0x[0-9a-fA-F]{64}$/.test(signed.hash))
    throw new Error('locally signed EOA transaction differs from approved preview');
  return {raw,hash:signed.hash.toLowerCase(),executionModel:'eoa',
    chainId:'0x'+chain.toString(16),from,to,nonce:'0x'+nonce.toString(16),
    gasLimit:'0x'+gasLimit.toString(16),maxFeePerGas:'0x'+maxFee.toString(16),
    maxPriorityFeePerGas:'0x'+tip.toString(16),
    value:'0x'+value.toString(16),data:data.toLowerCase()};
 }finally{
  // JS strings cannot be reliably zeroized; do not persist or share decrypted data.
  payload=null;signer=null;
 }
}
