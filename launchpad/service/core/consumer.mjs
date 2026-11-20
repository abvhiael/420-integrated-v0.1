import {encodeStatic,wordHex,wordAddress,wordUint,decodeAddress,decodeUint,decodeBool,strip0x} from './abi.mjs';

const HASH=/^0x[0-9a-fA-F]{64}$/;
const ADDRESS=/^0x[0-9a-fA-F]{40}$/;
const ZERO='0x'+'0'.repeat(64);
const STATES=['NONE','SCHEDULED','ACTIVE','SUCCEEDED','FAILED','CANCELLED'];
const PAY_STATES=['NONE','SUBMITTED','INCLUDED','CERTIFIED','FINALIZED','SETTLED','REFUNDED','PARTIALLY_REFUNDED','FAILED'];
export function hash(v){if(!HASH.test(v||''))throw new Error('canonical bytes32 required');return v.toLowerCase();}
export function address(v){if(!ADDRESS.test(v||''))throw new Error('canonical address required');return v.toLowerCase();}
function word(data,index=0){const s=strip0x(data);if(!/^[0-9a-fA-F]*$/.test(s)||s.length<64*(index+1))throw new Error('short or invalid canonical ABI response');return '0x'+s.slice(index*64,(index+1)*64).toLowerCase();}
const zero=(v)=>!v||v.toLowerCase()===ZERO||v.toLowerCase()==='0x'+'0'.repeat(40);
const numeric=(v)=>BigInt(v).toString();
export async function call(rpc,to,signature,args=[]){const sel=await rpc.selector(signature);return rpc.ethCall(address(to),encodeStatic(sel,args));}
export async function readSale(rpc,rt,saleId){
  const d=await call(rpc,rt.saleRegistryAddress,'sale(bytes32)',[wordHex(hash(saleId))]);
  if(!decodeBool(d,14))throw new Error('sale does not exist');
  const state=STATES[Number(decodeUint(d,13))];
  if(!state)throw new Error('invalid canonical sale state');
  return {saleId:hash(saleId),projectId:word(d,0),paymentAsset:decodeAddress(d,1),proceedsReceiver:decodeAddress(d,2),
    softCap:numeric(decodeUint(d,3)),hardCap:numeric(decodeUint(d,4)),perWalletCap:numeric(decodeUint(d,5)),
    tokenAllocation:numeric(decodeUint(d,6)),startsAt:Number(decodeUint(d,7)),endsAt:Number(decodeUint(d,8)),
    claimStartsAt:Number(decodeUint(d,9)),eligibilityPolicyHash:word(d,10),raised:numeric(decodeUint(d,12)),state};
}
async function readProject(rpc,rt,projectId){const d=await call(rpc,rt.projectRegistryAddress,'project(bytes32)',[wordHex(hash(projectId))]);if(!decodeBool(d,5))throw new Error('project does not exist');return {controller:decodeAddress(d),active:decodeBool(d,4)};}
async function readSingle(rpc,to,sig,args=[]){return word(await call(rpc,to,sig,args));}
async function readNum(rpc,to,sig,args=[]){return decodeUint(await call(rpc,to,sig,args));}
async function readAddress(rpc,to,sig,args=[]){return decodeAddress(await call(rpc,to,sig,args));}
async function readBool(rpc,to,sig,args=[]){return decodeBool(await call(rpc,to,sig,args));}
function amount(v){if(typeof v!=='string'||!/^[1-9][0-9]{0,38}$/.test(v)||BigInt(v)>2n**128n-1n)throw new Error('positive uint128 contribution amount required');return BigInt(v);}
function decodeRefs(d){
  const offset=decodeUint(d,0);if(offset!==32n)throw new Error('invalid payment reference offset');
  const length=Number(decodeUint(d,1));if(!Number.isSafeInteger(length)||length>32)throw new Error('invalid payment reference count');
  if(strip0x(d).length!==128+64*length)throw new Error('invalid payment reference length');
  const refs=Array.from({length},(_,i)=>word(d,i+2));if(refs.some(zero)||new Set(refs).size!==refs.length)throw new Error('duplicate canonical payment reference');return refs;
}
export async function paymentRegistry(rpc,rt){return readAddress(rpc,rt.crowdfundingIntegrationAddress,'paymentRegistry()');}
export async function payment(rpc,registry,paymentId){
  const d=await call(rpc,registry,'payments(bytes32)',[wordHex(hash(paymentId))]);
  const state=PAY_STATES[Number(decodeUint(d,12))];if(!state)throw new Error('unknown payment status');
  return {paymentId:hash(paymentId),invoiceId:word(d,0),payer:decodeAddress(d,1),merchant:decodeAddress(d,2),
    inputAsset:decodeAddress(d,3),inputAmount:numeric(decodeUint(d,4)),
    settlementAsset:decodeAddress(d,5),settlementAmount:numeric(decodeUint(d,6)),
    payerNonce:numeric(decodeUint(d,8)),receiptHash:word(d,9),tipAmount:numeric(decodeUint(d,10)),
    refundedAmount:numeric(decodeUint(d,11)),status:state};
}
export async function identityStatus(rpc,rt,sale,account){
  const who=wordAddress(address(account)),crowd=rt.crowdfundingIntegrationAddress;
  const id=await readSingle(rpc,crowd,'identity()');
  const identity=decodeAddress(id),bound=await readSingle(rpc,crowd,'profileByParticipant(address)',[who]);
  if(zero(bound))return {identity,profileId:null,profileAtSale:null,owner:false,active:false,credentialValid:false,bound:false};
  const d=await call(rpc,identity,'profiles(bytes32)',[wordHex(bound)]);
  const owner=decodeAddress(d,0).toLowerCase()===account.toLowerCase(),active=decodeBool(d,6);
  const credentialValid=owner&&active&&await readBool(rpc,identity,'hasValidCredential(bytes32,bytes32)',[wordHex(bound),wordHex(sale.eligibilityPolicyHash)]);
  const frozen=await readSingle(rpc,crowd,'profileAtSale(bytes32,address)',[wordHex(sale.saleId),who]);
  return {identity,profileId:bound,profileAtSale:zero(frozen)?null:frozen,owner,active,credentialValid,bound:owner&&active&&credentialValid&& (zero(frozen)||frozen===bound)};
}
async function snapshot(rpc){
  const [chainId,block]=await Promise.all([rpc.call('eth_chainId',[]),rpc.call('eth_getBlockByNumber',['latest',false])]);
  if(!block||!HASH.test(block.hash||''))throw new Error('unverifiable canonical block');
  return {chainId,blockHash:block.hash,blockNumber:block.number,at:Number(BigInt(block.timestamp))};
}
export async function position(rpc,rt,saleId,account){
  const who=address(account),sale=await readSale(rpc,rt,saleId),args=[wordHex(sale.saleId),wordAddress(who)],crowd=rt.crowdfundingIntegrationAddress;
  const [source,identity,project,contributed,claimed,refunded,refsData,prepared,attested,caseId,payRegistry]=await Promise.all([
    snapshot(rpc),identityStatus(rpc,rt,sale,who),readProject(rpc,rt,sale.projectId),
    readNum(rpc,rt.allocationRegistryAddress,'contributed(bytes32,address)',args),
    readNum(rpc,rt.allocationRegistryAddress,'claimed(bytes32,address)',args),
    readBool(rpc,rt.allocationRegistryAddress,'refunded(bytes32,address)',args),
    call(rpc,crowd,'paymentIds(bytes32,address)',args),
    readSingle(rpc,crowd,'preparedRefundCommitment(bytes32,address)',args),
    readSingle(rpc,crowd,'deliveryAttestation(bytes32,address)',args),
    readSingle(rpc,crowd,'disputeCase(bytes32,address)',args),paymentRegistry(rpc,rt)]);
  const refs=decodeRefs(refsData),history=[];
  for(const paymentId of refs){
    const p=await payment(rpc,payRegistry,paymentId);
    if(p.payer.toLowerCase()!==who||p.merchant.toLowerCase()!==sale.proceedsReceiver.toLowerCase()
       ||p.settlementAsset.toLowerCase()!==sale.paymentAsset.toLowerCase()||zero(p.receiptHash)
       ||p.status==='NONE')throw new Error('canonical contribution history mismatch');
    const refundData=await call(rpc,crowd,'refundProgress(bytes32,address,uint128)',[wordHex(paymentId),wordAddress(who),wordUint(p.settlementAmount)]);
    history.push({...p,refundAuthorized:numeric(decodeUint(refundData,0)),refundDelivered:numeric(decodeUint(refundData,1)),
      refundPrincipalDelivered:numeric(decodeUint(refundData,2))});
  }
  const linked=zero(caseId)?null:caseId;
  let dispute=null;
  if(linked){
    const cases=await readAddress(rpc,crowd,'arbitrationCases()');
    const origin=await call(rpc,cases,'caseOrigin(bytes32)',[wordHex(linked)]);
    if(decodeAddress(origin,0).toLowerCase()!==who||decodeAddress(origin,1).toLowerCase()!==project.controller.toLowerCase()
       ||word(origin,4)!==sale.saleId)throw new Error('arbitration origin mismatch');
    const dstate=['NONE','OPEN','RULED','FINALIZED'][Number(decodeUint(origin,5))];
    if(!dstate)throw new Error('invalid arbitration state');
    const published=await readBool(rpc,crowd,'publishedDisputeOutcome(bytes32)',[wordHex(linked)]);
    dispute={caseId:linked,state:dstate,published};
  }
  const remaining=BigInt(sale.hardCap)-BigInt(sale.raised),walletRemaining=BigInt(sale.perWalletCap)-contributed;
  if(remaining<0n||walletRemaining<0n)throw new Error('invalid sale capacity');
  const expectedClaim=BigInt(sale.raised)>0n?BigInt(sale.tokenAllocation)*contributed/BigInt(sale.raised):0n;
  return {schema:'420-launchpad-position-v1',canonical:true,source,sale,project,identity,
    contributed:contributed.toString(),claimed:claimed.toString(),refunded,
    remaining:remaining.toString(),walletRemaining:walletRemaining.toString(),history,
    preparedRefundCommitment:zero(prepared)?null:prepared,deliveryAttestation:zero(attested)?null:attested,
    claimable:sale.state==='SUCCEEDED'&&source.at>=sale.claimStartsAt&&contributed>0n&&claimed===0n
      &&expectedClaim>0n&&!refunded&&!!attested&&history.every(p=>p.status==='SETTLED'),
    expectedClaim:expectedClaim.toString(),dispute,
    eligibility:identity.bound?'ELIGIBLE':!identity.profileId?'IDENTITY_PROFILE_NOT_BOUND':!identity.owner?'PROFILE_NOT_OWNED':!identity.active?'PROFILE_INACTIVE':!identity.credentialValid?'CREDENTIAL_INVALID':'SALE_PROFILE_MISMATCH',
    fees:{known:false,reason:'Final 420Pay checkout quote and wallet gas fees must be reviewed in 420Pay and Wallet'}};
}
export async function checkoutContext(rpc,rt,saleId,account,rawAmount,rawNonce){
  const who=address(account),principal=amount(rawAmount),nonce=BigInt(rawNonce);
  if(!/^[1-9][0-9]{0,77}$/.test(String(rawNonce))||nonce>=2n**256n)throw new Error('invalid contribution nonce');
  const p=await position(rpc,rt,saleId,who),sale=p.sale;
  if(sale.state!=='ACTIVE'||p.source.at<sale.startsAt||p.source.at>sale.endsAt)throw new Error('contribution window closed');
  if(principal>BigInt(p.remaining)||principal>BigInt(p.walletRemaining))throw new Error('contribution exceeds canonical capacity');
  if(!p.identity.bound)throw new Error('identity eligibility not satisfied');
  if(!/^0x0{40}$/i.test(sale.paymentAsset))throw new Error('420Pay native invoice checkout only supports native 420; token checkout needs a qualified Pay quote');
  const crowd=rt.crowdfundingIntegrationAddress,args=[wordHex(sale.saleId),wordAddress(who),wordUint(principal),wordUint(nonce)];
  const invoiceId=await readSingle(rpc,crowd,'invoiceIdFor(bytes32,address,uint128,uint256)',args);
  const registered=await readBool(rpc,crowd,'registeredContributionIntent(bytes32)',[wordHex(invoiceId)]);
  const registry=await paymentRegistry(rpc,rt);
  const paymentId=await readSingle(rpc,registry,'checkoutPaymentForInvoice(bytes32)',[wordHex(invoiceId)]);
  let confirmedPayment=null;
  if(!zero(paymentId)){
    confirmedPayment=await payment(rpc,registry,paymentId);
    if(confirmedPayment.invoiceId!==invoiceId||confirmedPayment.payer.toLowerCase()!==who||
       confirmedPayment.merchant.toLowerCase()!==sale.proceedsReceiver.toLowerCase()||
       confirmedPayment.settlementAmount!==principal.toString()||
       confirmedPayment.settlementAsset.toLowerCase()!==sale.paymentAsset.toLowerCase())throw new Error('payment does not match the campaign intent');
  }
  const payRegistry=await readAddress(rpc,registry,'registry()');
  const key=await rpc.call('web3_sha3',['0x'+Buffer.from('420/APP/420PAY/INVOICE_REGISTRY').toString('hex')]);
  const invoices=await readAddress(rpc,payRegistry,'resolve(bytes32)',[wordHex(key)]);
  const merchant=await readAddress(rpc,invoices,'merchantOf(bytes32)',[wordHex(invoiceId)]);
  const invoiceExists=!/^0x0{40}$/i.test(merchant);
  if(invoiceExists){
    if(merchant.toLowerCase()!==sale.proceedsReceiver.toLowerCase())throw new Error('invoice merchant mismatches campaign');
    const invoice=await call(rpc,invoices,'getInvoice(bytes32)',[wordHex(invoiceId)]);
    if(decodeUint(invoice,4)!==principal||Number(decodeUint(invoice,7))!==0||
      decodeBool(invoice,9)||decodeUint(invoice,5)<BigInt(sale.startsAt)||
      decodeUint(invoice,5)>BigInt(sale.endsAt))throw new Error('canonical invoice terms mismatch');
  }
  if(!registered&&(invoiceExists||confirmedPayment))throw new Error('unregistered payment intent');
  return {schema:'420-launchpad-checkout-v1',canonical:true,source:p.source,saleId:sale.saleId,amount:principal.toString(),nonce:nonce.toString(),
    invoiceId,registered,invoiceExists,paymentId:zero(paymentId)?null:paymentId,
    paymentStatus:confirmedPayment?.status||null,recorded:confirmedPayment?await readBool(rpc,crowd,'usedPaymentId(bytes32)',[wordHex(paymentId)]):false,
    checkoutUrl:registered&&invoiceExists?'https://420pay.420integrated.org/#pay?v=1&kind=invoice&chain='+BigInt(p.source.chainId).toString()+'&id='+invoiceId:null,
    next:!registered?'REGISTER_INTENT':!invoiceExists?'WAIT_FOR_MERCHANT_INVOICE':!confirmedPayment?'CHECKOUT_420PAY':
      confirmedPayment.status!=='SETTLED'?'AWAIT_CANONICAL_SETTLEMENT':'RECORD_CONTRIBUTION',fees:p.fees};
}
export async function transactionStatus(rpc,rt,txHash,account){
  const id=hash(txHash),who=address(account);
  const [source,tx,receipt]=await Promise.all([snapshot(rpc),rpc.call('eth_getTransactionByHash',[id]),rpc.call('eth_getTransactionReceipt',[id])]);
  if(!tx)return {schema:'420-launchpad-transaction-status-v1',canonical:true,source,txHash:id,state:'UNKNOWN',message:'No canonical transaction found; verify Wallet history before resubmitting'};
  if(address(tx.from)!==who)throw new Error('transaction sender mismatch');
  if(!receipt)return {schema:'420-launchpad-transaction-status-v1',canonical:true,source,txHash:id,state:'PENDING',to:tx.to,caseId:null};
  const block=await rpc.call('eth_getBlockByNumber',[receipt.blockNumber,false]);
  if(!block||!HASH.test(block.hash||'')||block.hash.toLowerCase()!==receipt.blockHash.toLowerCase())
    return {schema:'420-launchpad-transaction-status-v1',canonical:true,source,txHash:id,state:'REORGED',to:tx.to,caseId:null};
  const confirmed=BigInt(receipt.status)===1n,finalized=await rpc.call('eth_getBlockByNumber',['finalized',false]).catch(()=>null);
  const isFinal=confirmed&&finalized?.number&&BigInt(finalized.number)>=BigInt(receipt.blockNumber);
  let caseId=null;
  if(confirmed&&address(tx.to||'')===address(await readAddress(rpc,rt.crowdfundingIntegrationAddress,'arbitrationCases()'))){
    const topic=(await rpc.call('web3_sha3',['0x'+Buffer.from('CaseOpened(bytes32,bytes32,address,address,bytes32,bytes32)').toString('hex')])).toLowerCase();
    const match=(receipt.logs||[]).find(log=>address(log.address)===address(tx.to)&&log.topics?.[0]?.toLowerCase()===topic&&HASH.test(log.topics?.[1]||''));
    if(match)caseId=match.topics[1].toLowerCase();
  }
  return {schema:'420-launchpad-transaction-status-v1',canonical:true,source,txHash:id,
    state:!confirmed?'REVERTED':isFinal?'FINALIZED':'CONFIRMED',to:tx.to,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,caseId};
}
