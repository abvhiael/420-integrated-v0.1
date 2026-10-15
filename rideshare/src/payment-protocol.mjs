import {createHash} from 'node:crypto';
import {AuthError} from './auth.mjs';
import {canonical} from './canonical.mjs';
import {keccak256Hex} from '../../wallet/web/core/keccak.js';
const fail=()=>{throw new AuthError('INVALID_PAY_BINDING',403);};
export function address(v){if(typeof v!=='string'||!/^0x[0-9a-f]{40}$/.test(v)||/^0x0+$/.test(v))fail();return v;}
export function bytes32(v){if(typeof v!=='string'||!/^0x[0-9a-f]{64}$/.test(v)||/^0x0+$/.test(v))fail();return v;}
export function uint(v){if(typeof v!=='string'||!/^(0|[1-9][0-9]{0,77})$/.test(v)||BigInt(v)>((1n<<256n)-1n))fail();return BigInt(v);}
export const digest=v=>createHash('sha256').update(canonical(v)).digest('hex');
const word=v=>uint(String(v)).toString(16).padStart(64,'0');
const addr=v=>address(v).slice(2).padStart(64,'0');
const hash=bytes=>keccak256Hex(bytes);
const utf8=s=>new TextEncoder().encode(s);
export const PAYMENT_STATUSES=Object.freeze({NONE:0,SUBMITTED:1,INCLUDED:2,CERTIFIED:3,FINALIZED:4,SETTLED:5,REFUNDED:6,PARTIALLY_REFUNDED:7,FAILED:8});
// Exact PaymentRegistry420.derivePaymentId ABI tuple; no new payment-ID authority.
export function derivePaymentId(p) {
  const domain=hash(utf8('420/APP/420PAY_PAYMENT_ID')).slice(2);
  const encoded=domain+bytes32(p.invoiceId).slice(2)+addr(p.payer)+addr(p.merchant)+addr(p.asset)+word(p.amountUnits)+addr(p.asset)+word(p.amountUnits)+bytes32(p.payQuoteId).slice(2)+word(p.payerNonce);
  return hash(Buffer.from(encoded,'hex'));
}
// First repository consumer supports direct ERC20 settlement only; no arbitrary approvals/swaps.
export function directSettlementCall(p) {
  const signature='executeDirectTokenSplitSettlement(bytes32,address,address,uint256,address[],uint16[],uint8)';
  const selector=hash(utf8(signature)).slice(2,10);
  const head=bytes32(p.paymentId).slice(2)+addr(p.payer)+addr(p.asset)+word(p.amountUnits)+word(224)+word(288)+word(0);
  return '0x'+selector+head+word(1)+addr(p.merchant)+word(1)+word(10000);
}
export function validateIntent(p,config) {
  for(const field of ['payer','controller','merchant','asset','target'])address(p[field]);
  for(const field of ['invoiceId','paymentId','payQuoteId'])bytes32(p[field]);
  if(p.chainId!==config.chainId||p.merchant!==config.merchant||p.asset!==config.asset||p.target!==config.payRouter||p.value!=='0'||uint(p.amountUnits)<=0n||uint(p.tipUnits)>uint(p.amountUnits)||derivePaymentId(p)!==p.paymentId||directSettlementCall(p)!==p.calldata)fail();
  return p;
}
export async function prepareWalletPayment({wallet,intent,sessionKey,consent,expectedIntentHash,clock=()=>Math.floor(Date.now()/1000)}) {
  if(digest(intent)!==expectedIntentHash||!Number.isSafeInteger(intent.expiresAt)||intent.expiresAt<=clock())fail();
  if(derivePaymentId(intent)!==intent.paymentId)fail();
  if(consent!==true)throw new AuthError('WALLET_CONSENT_REQUIRED',403);
  const connected=await wallet.connect();
  const pay=wallet.sdk.contract('PaymentRouter420');
  if(!pay||pay.verified!==true||connected.chainId!==BigInt(intent.chainId)||connected.controller!==intent.controller||pay.address.toLowerCase()!==intent.target||directSettlementCall(intent)!==intent.calldata)fail();
  const account=await wallet.discoverSmartAccount();
  if(account.controller.toLowerCase()!==intent.controller||account.smartAccount.toLowerCase()!==intent.payer)fail();
  // Preparing is not sending or granting an unlimited token/session authorization.
  return wallet.prepareSession(account,sessionKey,{target:intent.target,value:'0',data:intent.calldata});
}
