// W15.6-M5: read-only transaction lifecycle, fee and recipient policies.
// Never signs or sends via a public RPC; only a verified wallet authority may submit.
import {normalizeAddress} from './abi.js';
import {parseUnits} from './send.js';
import {keccak256Hex} from './keccak.js';
const HASH=/^0x[0-9a-fA-F]{64}$/;
const QUANTITY=/^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const ZERO='0x'+'0'.repeat(40);
const fail=(message)=>{throw new Error(message)};
export const ADDRESS_BOOK_KEY_420='420-wallet-address-book-v1';
export const TX_HISTORY_KEY_420='420-wallet-transaction-history-v1';
export const TX_STATES_420=Object.freeze(['pending','submitted','included','confirmed','reverted','dropped','replaced','cancelled','reorganized']);
const transitions={
 pending:['submitted','included','dropped','cancelled'],
 submitted:['included','reverted','dropped','replaced','cancelled'],
 included:['confirmed','reverted','reorganized'],
 confirmed:['reorganized'],
 reorganized:['submitted','included','reverted','confirmed','dropped','replaced'],
 replaced:['included','confirmed','reorganized'],
 reverted:['reorganized'],
 dropped:['submitted'],
 cancelled:['reorganized'],
};
export function transitionTransaction420(tx,status,details={}){
  if(!tx||!TX_STATES_420.includes(tx.status)||!TX_STATES_420.includes(status))fail('Invalid transaction lifecycle status');
  if(tx.status!==status&&!transitions[tx.status]?.includes(status))fail('Illegal transaction lifecycle transition');
  if(details.chainId&&details.chainId!==tx.chainId)fail('Transaction chain context mismatch');
  if(details.controller&&details.controller!==tx.controller)fail('Transaction account context mismatch');
  if(status==='confirmed'&&(!HASH.test(tx.hash||'')||!HASH.test(details.blockHash||tx.blockHash||'')))fail('Confirmed transaction requires canonical transaction and block hashes');
  return {...tx,...details,status,updatedAt:Date.now()};
}
export function canonicalRecipient420(address){
  const value=normalizeAddress(address);
  if(value===ZERO)fail('Zero address cannot receive funds');
  return value;
}
export function validateAddressBook420(input={}){
  if(typeof input!=='object'||input==null||Array.isArray(input))fail('Invalid address book');
  const items=Array.isArray(input.entries)?input.entries:[];
  if(items.length>100)fail('Address book exceeds limit');
  const result=[];
  for(const item of items){
    const address=canonicalRecipient420(item.address);
    const label=String(item.label||'').trim();
    if(label.length<1||label.length>80)fail('Address book label must have 1–80 characters');
    if(result.some(x=>x.address===address))fail('Duplicate address book entry');
    result.push({address,label});
  }
  return {entries:result};
}
export function hexQuantity420(value,label='RPC quantity'){
  if(typeof value!=='string'||!QUANTITY.test(value))fail('Invalid '+label);
  return BigInt(value);
}
export function gasQuote420({gasLimit,baseFee,maxPriorityFeePerGas,maxFeePerGas,chainId,epoch}){
  const gas=hexQuantity420(gasLimit,'gas limit');
  const base=hexQuantity420(baseFee,'base fee');
  const tip=hexQuantity420(maxPriorityFeePerGas,'priority fee');
  const cap=hexQuantity420(maxFeePerGas,'fee cap');
  if(gas<=0n||gas>30000000n||cap<base+tip||tip<=0n)fail('Unsafe or insufficient EIP-1559 fee settings');
  if(!/^0x[0-9a-fA-F]+$/.test(chainId)||!Number.isSafeInteger(epoch)||epoch<0)fail('Missing chain fee context');
  return {chainId,epoch,gasLimit:'0x'+gas.toString(16),maxPriorityFeePerGas:'0x'+tip.toString(16),maxFeePerGas:'0x'+cap.toString(16),worstCaseFee:(gas*cap).toString(),
    baseFee:'0x'+base.toString(16)};
}
export function exactMax420({rawBalance,gasReserve='0',decimals=18,kind='native'}){
  if(!/^\d+$/.test(rawBalance)||!/^\d+$/.test(gasReserve))fail('Verified balances and fee reserve required');
  if(!Number.isInteger(decimals)||decimals<0||decimals>36)fail('Invalid token decimals');
  const amount=kind==='native'?BigInt(rawBalance)-BigInt(gasReserve):BigInt(rawBalance);
  if(amount<=0n)fail('Insufficient spendable amount after fee reserve');
  const base=10n**BigInt(decimals);
  const fraction=(amount%base).toString().padStart(decimals,'0').replace(/0+$/,'');
  return (amount/base).toString()+(fraction?'.'+fraction:'');
}
export function checkAvailable420({balance,units,gasReserve='0',kind='native',nativeBalance}){
  if(balance?.status!=='spendable'&&balance?.status!=='pending')fail('Balance unavailable or stale');
  if(typeof balance.spendable!=='string'||!/^\d+$/.test(balance.spendable))fail('Unverified balance');
  const amount=BigInt(units);
  if(amount<=0n||amount>BigInt(balance.spendable))fail('Amount exceeds on-chain balance');
  if(kind==='native'){
    if(amount+BigInt(gasReserve)>BigInt(balance.spendable))fail('Insufficient native funds for gas');
  }else if(!nativeBalance||!['spendable','pending'].includes(nativeBalance.status)||BigInt(nativeBalance.spendable||'0')<BigInt(gasReserve))
    fail('Insufficient verified native gas reserve');
  return true;
}
export function validatePreview420(preview,{chainId,epoch,controller,recipient,now=Date.now()}){
  if(!preview||preview.chainId!==chainId||preview.epoch!==epoch||preview.controller!==controller)fail('Stale chain or account transaction preview');
  if(preview.recipient!==canonicalRecipient420(recipient))fail('Recipient changed after review');
  if(!Number.isSafeInteger(preview.preparedAt)||now-preview.preparedAt>45000||now<preview.preparedAt)fail('Transaction preview expired');
  if(!preview.simulation?.success||!preview.gas?.worstCaseFee)fail('Simulation and fee estimate are mandatory');
  return true;
}
export function classifyReceipt420(tx,{receipt=null,transaction=null,head=null,confirmationDepth=3}={}){
  if(!tx||!HASH.test(tx.hash||''))fail('Transaction hash missing');
  const chainId=tx.chainId,controller=tx.controller;
  if(!receipt){
    // A temporarily unavailable receipt is not evidence of reorganization or dropping.
    if(tx.blockHash)return tx;
    if(transaction&&tx.status!=='submitted')return transitionTransaction420(tx,'submitted',{chainId,controller});
    return tx;
  }
  if(receipt.transactionHash?.toLowerCase()!==tx.hash.toLowerCase()||!HASH.test(receipt.blockHash||''))fail('Malformed or mismatched transaction receipt');
  const status=hexQuantity420(receipt.status,'receipt status');
  if(status>1n)fail('Invalid receipt status');
  const number=hexQuantity420(receipt.blockNumber,'block number');
  const tip=head==null?number:hexQuantity420(head,'chain head');
  if(tip<number)fail('Receipt block is ahead of chain');
  const confirmations=Number(tip-number+1n);
  const fields={chainId,controller,blockHash:receipt.blockHash.toLowerCase(),blockNumber:receipt.blockNumber,confirmations};
  if(tx.blockHash&&tx.blockHash!==fields.blockHash)return transitionTransaction420(tx,'reorganized',{...fields,confirmations:0});
  const next=status===0n?'reverted':confirmations>=confirmationDepth?'confirmed':'included';
  if(tx.status===next)return {...tx,...fields,updatedAt:Date.now()};
  if(tx.status==='confirmed'&&next==='included')return transitionTransaction420(tx,'reorganized',{...fields,confirmations:0});
  return transitionTransaction420(tx,next,fields);
}
export function replacementPolicy420(previous,{model,nonce,fee,operationHash}={}){
  if(!previous||previous.model!==model)fail('Replacement authority model mismatch');
  if(model==='eoa'){
    if(!/^(0|[1-9]\d*)$/.test(String(nonce))||String(previous.nonce)!==String(nonce))fail('EOA replacement must reuse exact sender nonce');
    const old=BigInt(previous.maxFeePerGas||'0'),next=BigInt(fee?.maxFeePerGas||'0');
    const oldTip=BigInt(previous.maxPriorityFeePerGas||'0'),tip=BigInt(fee?.maxPriorityFeePerGas||'0');
    if(next*100n<old*110n||tip*100n<oldTip*110n)fail('EOA replacement gas fees insufficient');
  }else if(model==='erc4337'){
    if(!previous.entryPoint||!previous.userOpHash||!HASH.test(previous.userOpHash))fail('Original canonical UserOperation required');
    if(String(previous.nonce)!==String(nonce)||previous.nonceKey!=='0')fail('ERC-4337 replacement requires exact EntryPoint nonce key and sequence');
    if(!HASH.test(operationHash||'')||operationHash===previous.userOpHash)fail('ERC-4337 replacement requires a distinct signed canonical UserOperation');
    if(!fee||BigInt(fee.maxFeePerGas||'0')<=BigInt(previous.maxFeePerGas||'0')||
      BigInt(fee.maxPriorityFeePerGas||'0')<=BigInt(previous.maxPriorityFeePerGas||'0'))fail('ERC-4337 replacement must increase both fee fields');
  }else fail('Unsupported replacement authority');
  return true;
}
export function validateSendRecipient420(value){
  if(typeof value!=='string')fail('Recipient required');
  const recipient=value.trim();
  if(/^0x[0-9a-fA-F]{40}$/.test(recipient))return {kind:'address',recipient:canonicalRecipient420(recipient)};
  if(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.420$/.test(recipient))return {kind:'420names',name:recipient};
  if(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.eth$/.test(recipient))return {kind:'ens',name:recipient};
  fail('Invalid EVM address or supported name');
}

const ENS_REGISTRY_420='0x00000000000c2e074ec69a0dfb2997ba6c7d2e1e';
export function namehashENS420(value){
  if(typeof value!=='string'||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.eth$/.test(value)||value.length>253)
    fail('Unsupported ENS name; use lowercase ASCII ENS name');
  let node='0x'+'0'.repeat(64);
  for(const label of value.split('.').reverse()){
    const labelHash=keccak256Hex(new TextEncoder().encode(label));
    node=keccak256Hex(new Uint8Array([...Uint8Array.from(node.slice(2).match(/.{2}/g),b=>parseInt(b,16)),
      ...Uint8Array.from(labelHash.slice(2).match(/.{2}/g),b=>parseInt(b,16))]));
  }
  return node;
}
export async function resolveENS420(provider,name,expectedChain){
  if(expectedChain!=='0x1')fail('ENS mainnet resolver not approved on this chain');
  if(await provider.request('eth_chainId')!==expectedChain)fail('ENS chain changed');
  const node=namehashENS420(name),registryCode=await provider.request('eth_getCode',[ENS_REGISTRY_420,'latest']);
  if(typeof registryCode!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(registryCode)||/^0x0+$/i.test(registryCode))fail('ENS registry code unavailable');
  const resolver=await provider.request('eth_call',[{to:ENS_REGISTRY_420,data:'0x0178b8bf'+node.slice(2)},'latest']);
  if(typeof resolver!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(resolver))fail('ENS resolver record malformed');
  const address=canonicalRecipient420('0x'+resolver.slice(-40));
  const code=await provider.request('eth_getCode',[address,'latest']);
  if(typeof code!=='string'||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code)||/^0x0+$/i.test(code))fail('ENS resolver contract unavailable');
  const answer=await provider.request('eth_call',[{to:address,data:'0x3b3b57de'+node.slice(2)},'latest']);
  if(typeof answer!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(answer))fail('ENS address record malformed');
  const recipient=canonicalRecipient420('0x'+answer.slice(-40));
  if(await provider.request('eth_chainId')!==expectedChain)fail('ENS chain changed during resolution');
  return {name,recipient,kind:'ens',chainId:expectedChain};
}
