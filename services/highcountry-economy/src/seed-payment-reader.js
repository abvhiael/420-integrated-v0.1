import {SettlementError} from './buds-ledger.js';
import {address,calldata,words,word} from './finalized-rpc.js';
import {seedHash,OPENING_POLICY_HASH,abiHash} from './seed-opening-selection.js';
const fail=m=>{throw new SettlementError(m);};
export class SeedPaymentReader {
 constructor({rpc,gameId,treasury,quoteSigner}){
  const p=rpc?.contracts?.seedPayments;
  if(!p||!/^0x[0-9a-f]{64}$/i.test(p.codeHash)||BigInt(p.codeHash)===0n||!/^0x[0-9a-f]{64}$/i.test(gameId))fail('pinned seed payments required');
  this.rpc=rpc;this.gameId=gameId;this.binding=Object.freeze({chainId:rpc.chainId,contract:address(p.address),codeHash:p.codeHash.toLowerCase(),treasury:address(treasury),quoteSigner:address(quoteSigner),emergency:address(rpc.contracts.emergency.address),emergencyCodeHash:rpc.contracts.emergency.codeHash.toLowerCase()});
  if([this.binding.contract,this.binding.treasury,this.binding.quoteSigner,this.binding.emergency].some(x=>/^0x0{40}$/.test(x))||!/^0x[0-9a-f]{64}$/i.test(this.binding.emergencyCodeHash)||BigInt(this.binding.emergencyCodeHash)===0n)fail('nonzero payment dependencies required');
 }
 quoteDigest(i){return abiHash(seedHash('HC.SEED.PAYMENT.QUOTE.V1'),this.binding.chainId,this.binding.contract,this.gameId,OPENING_POLICY_HASH,i.wallet,i.key,i.commitment,i.pool,i.amount);}
 async authorize(i,signerRpc){
  if(typeof signerRpc?.request!=='function')fail('native quote signer unavailable');
  await this.read(i);
  if(Number(BigInt(await signerRpc.request('eth_chainId',[])))!==this.binding.chainId)fail('quote signer wrong chain');
  const signature=await signerRpc.request('personal_sign',[this.quoteDigest(i),this.binding.quoteSigner]);
  if(typeof signature!=='string'||!/^0x[0-9a-f]{130}$/i.test(signature))fail('invalid payment quote signature');
  let v=parseInt(signature.slice(130),16);if(v<27)v+=27;const r='0x'+signature.slice(2,66),s='0x'+signature.slice(66,130);
  await this.read(i);
  const out=words((await this.rpc.call('seedPayments',calldata('quoteValid(address,bytes32,bytes32,uint8,uint8,bytes32,bytes32)',i.wallet,i.key,i.commitment,i.pool,v,r,s))).result);
  if(out.length!==1||BigInt('0x'+out[0])!==1n)fail('payment quote signer mismatch');
  return calldata('pay(bytes32,bytes32,uint8,uint8,bytes32,bytes32)',i.key,i.commitment,i.pool,v,r,s);
 }
 async read(i){
  if(!i.paymentBinding||Object.entries(this.binding).some(([k,v])=>i.paymentBinding[k]!==v))fail('payment deployment changed');
  const p=this.rpc.contracts.seedPayments;if(address(p.address)!==this.binding.contract||p.codeHash.toLowerCase()!==this.binding.codeHash||this.rpc.chainId!==this.binding.chainId||address(this.rpc.contracts.emergency.address)!==this.binding.emergency||this.rpc.contracts.emergency.codeHash.toLowerCase()!==this.binding.emergencyCodeHash)fail('payment RPC changed');
  const h=await this.rpc.header(),tag={blockHash:h.hash,requireCanonical:true};
  const code=await this.rpc.request('eth_getCode',[this.binding.contract,tag]);if(seedHash(Buffer.from(code.slice(2),'hex'))!==this.binding.codeHash)fail('payment code mismatch');
  const emergencyCode=await this.rpc.request('eth_getCode',[this.binding.emergency,tag]);if(seedHash(Buffer.from(emergencyCode.slice(2),'hex'))!==this.binding.emergencyCodeHash)fail('payment emergency code mismatch');
  const call=async(sig,...args)=>words(await this.rpc.request('eth_call',[{to:this.binding.contract,data:calldata(sig,...args)},tag]));
  for(const [sig,v] of [['gameId()',this.gameId],['policyHash()',OPENING_POLICY_HASH],['treasury()',this.binding.treasury],['quoteSigner()',this.binding.quoteSigner],['emergencyState()',this.binding.emergency],['PRICE()',i.amount]]){const w=await call(sig);if(w.length!==1||w[0]!==word(v))fail('payment configuration mismatch');}
  if(i.nativeId!==abiHash(this.gameId,i.wallet,i.key))fail('payment identity mismatch');
  const r=await call('receipt(bytes32)',i.nativeId);if(r.length!==4)fail('payment receipt ABI mismatch');
  const status=Number(BigInt('0x'+r[3]));if(![0,1,2].includes(status))fail('payment receipt status mismatch');
  if(status===0&&r.some(w=>BigInt('0x'+w)!==0n))fail('malformed missing payment');
  if(status&&'0x'+r[0].slice(24)!==i.wallet)fail('payment payer mismatch');
  if(status===1&&('0x'+r[1]!==i.commitment||Number(BigInt('0x'+r[2]))!==i.pool))fail('payment commitment mismatch');
  // A finalized contract receipt cannot be asserted with caller-supplied transaction facts.
  let event=null;
  if(status){const topic=seedHash(status===1?'PackPaid(bytes32,address,bytes32,uint8,uint256)':'PackCancelled(bytes32,address)');
   const logs=await this.rpc.request('eth_getLogs',[{address:this.binding.contract,fromBlock:'0x0',toBlock:h.number,topics:[topic,i.nativeId,'0x'+word(i.wallet)]}]);
   if(logs.length!==1||logs[0].removed||address(logs[0].address)!==this.binding.contract||JSON.stringify(logs[0].topics)!==JSON.stringify([topic,i.nativeId,'0x'+word(i.wallet)]))fail('payment event required');
   const l=logs[0];if(!/^0x[0-9a-f]{64}$/i.test(l.transactionHash??''))fail('payment transaction identity required');event={transactionHash:l.transactionHash,blockHash:l.blockHash,blockNumber:l.blockNumber};const b=await this.rpc.request('eth_getBlockByNumber',[l.blockNumber,false]);if(b?.hash?.toLowerCase()!==l.blockHash?.toLowerCase()||BigInt(l.blockNumber)>BigInt(h.number))fail('payment event anchor mismatch');
   if(status===1&&l.data!==('0x'+[i.commitment,i.pool,i.amount].map(word).join('')))fail('payment event mismatch');
  }
  const last=await this.rpc.request('eth_getBlockByNumber',[h.number,false]);if(last?.hash?.toLowerCase()!==h.hash.toLowerCase())fail('payment finalized anchor changed');
  return {status:status===1?'paid':status===2?'cancelled':'pending',nativeId:i.nativeId,event,anchor:{chainId:this.binding.chainId,blockNumber:h.number,blockHash:h.hash}};
 }
}
