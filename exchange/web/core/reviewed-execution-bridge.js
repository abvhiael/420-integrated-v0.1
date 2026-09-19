import {transactionFingerprint} from './preflight.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export class ReviewedExecutionError extends Error {
  constructor(code,message){super(message);this.name='ReviewedExecutionError';this.code=code;}
}
const fail=(code,message)=>{throw new ReviewedExecutionError(code,message);};
const KINDS=Object.freeze(['SWAP','BRIDGE','ORDER_CANCEL']);
const exact=(left,right)=>typeof left==='string'&&typeof right==='string'&&left.toLowerCase()===right.toLowerCase();
const HEX_DATA=/^0x(?:[0-9a-f]{2})+$/i;
const ADDRESS=/^0x[0-9a-f]{40}$/i;

// Envelope review binds execution-critical fields. Human-readable amounts and
// routes additionally need independent quote-to-execution binding before UI use.
export function canonicalEnvelopeFields(prepared){
  if(!KINDS.includes(prepared?.kind)||prepared.transaction?.kind!==prepared.kind||!prepared.transaction?.request)fail('INVALID_PREPARATION','canonical prepared transaction required');
  const {transaction}=prepared,{request}=transaction;
  if(!ADDRESS.test(request.from??'')||!ADDRESS.test(request.to??'')||!HEX_DATA.test(request.data??''))fail('INVALID_PREPARATION','valid sender, target and calldata required');
  let value;
  try{value=BigInt(request.value??'0x0');if(value<0n)throw Error('negative');}catch{fail('INVALID_PREPARATION','invalid native value');}
  return Object.freeze({kind:transaction.kind,chainId:normalizeChainId(transaction.chainId),from:normalizeAccount(request.from),to:normalizeAccount(request.to),data:request.data.toLowerCase(),value:'0x'+value.toString(16),transactionFingerprint:transactionFingerprint(transaction)});
}

export function assertExactDisplayedFields(prepared,displayedFields){
  const canonical=canonicalEnvelopeFields(prepared);
  if(!displayedFields||typeof displayedFields!=='object'||Array.isArray(displayedFields))fail('REVIEW_FIELDS_REQUIRED','explicit canonical transaction fields required');
  const keys=Object.keys(canonical);
  if(Object.keys(displayedFields).length!==keys.length||keys.some(key=>!Object.hasOwn(displayedFields,key)))fail('INCOMPLETE_REVIEW','review must show every canonical envelope field');
  try{
    if(displayedFields.kind!==canonical.kind||normalizeChainId(displayedFields.chainId)!==canonical.chainId||!exact(normalizeAccount(displayedFields.from),canonical.from)||!exact(normalizeAccount(displayedFields.to),canonical.to)||!exact(displayedFields.data,canonical.data)||BigInt(displayedFields.value)!==BigInt(canonical.value)||!exact(displayedFields.transactionFingerprint,canonical.transactionFingerprint))fail('REVIEW_CHANGED','displayed review differs from executable transaction');
  }catch(error){if(error instanceof ReviewedExecutionError)throw error;fail('REVIEW_CHANGED','malformed or changed displayed transaction fields');}
  return canonical;
}

export function buildExecutionReview({prepared,session,reviewedFields,sourceAuthenticated=false}={}){
  if(!sourceAuthenticated)fail('SOURCE_UNVERIFIED','A trusted live executable-quote source must be authenticated');
  if(!KINDS.includes(prepared?.kind)||prepared?.transaction?.kind!==prepared.kind||!prepared?.context||!prepared?.reviewedIntent)fail('INVALID_PREPARATION','canonical prepared transaction required');
  if(!session?.account||!session?.chainId||!Number.isSafeInteger(session.generation))fail('SESSION_REQUIRED','connected wallet snapshot required');
  if(!exact(prepared.context.account,normalizeAccount(session.account))||normalizeChainId(prepared.context.chainId)!==normalizeChainId(session.chainId))fail('SESSION_CHANGED','quote account or chain differs from connected wallet');
  if(!exact(prepared.transaction.request.from,session.account)||normalizeChainId(prepared.transaction.chainId)!==normalizeChainId(session.chainId))fail('TRANSACTION_CHANGED','transaction account or chain differs from wallet');
  const fields=assertExactDisplayedFields(prepared,reviewedFields);
  if(prepared.transactionFingerprint!==fields.transactionFingerprint)fail('FINGERPRINT_CHANGED','prepared transaction differs from canonical review');
  return Object.freeze({kind:prepared.kind,account:normalizeAccount(session.account),chainId:normalizeChainId(session.chainId),generation:session.generation,transactionFingerprint:fields.transactionFingerprint,reviewedFields:fields,quoteId:prepared.context.quoteId,expiresAt:prepared.context.expiresAt});
}

export function assertConfirmedExecution({prepared,review,session,confirmedFingerprint,nowSeconds,displayedFields}={}){
  if(!review||!prepared?.transaction||!session)fail('REVIEW_REQUIRED','review and prepared transaction required');
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds>=review.expiresAt||nowSeconds>=prepared.context?.expiresAt)fail('REVIEW_EXPIRED','canonical review expired');
  if(!exact(review.account,session.account)||normalizeChainId(review.chainId)!==normalizeChainId(session.chainId)||review.generation!==session.generation)fail('SESSION_CHANGED','wallet changed after transaction review');
  const current=transactionFingerprint(prepared.transaction);
  if(review.transactionFingerprint!==current||confirmedFingerprint!==current||prepared.transactionFingerprint!==current||review.kind!==prepared.transaction.kind)fail('REVIEW_CHANGED','the confirmed transaction no longer matches the prepared transaction');
  if(!displayedFields)fail('REVIEW_FIELDS_REQUIRED','current displayed fields required at confirmation');
  const fields=assertExactDisplayedFields(prepared,displayedFields);
  if(Object.keys(fields).some(key=>fields[key]!==review.reviewedFields?.[key]))fail('REVIEW_CHANGED','the displayed review changed after confirmation');
  return Object.freeze({transaction:prepared.transaction,reviewedIntent:Object.freeze({kind:prepared.transaction.kind,transactionFingerprint:current}),freshness:Object.freeze({observedAt:prepared.context.observedAt,expiresAt:prepared.context.expiresAt}),review});
}

// No browser/RPC interaction occurs here. Authenticated quotes, human-readable
// amount/route binding, on-chain preflight and explicit submission remain required.
