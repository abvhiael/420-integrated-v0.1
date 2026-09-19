import {transactionFingerprint} from './preflight.js';
import {normalizeAccount,normalizeChainId} from './wallet-session.js';

export class ReviewedExecutionError extends Error {
  constructor(code,message){super(message);this.name='ReviewedExecutionError';this.code=code;}
}
const fail=(code,message)=>{throw new ReviewedExecutionError(code,message);};
const KINDS=Object.freeze(['SWAP','BRIDGE','ORDER_CANCEL']);
const exact=(left,right)=>String(left).toLowerCase()===String(right).toLowerCase();

// Adapt the V15.2 reviewed-intent names to the transaction's actual kind. A
// generated fingerprint is a review binding, NOT evidence of quote provenance.
export function buildExecutionReview({prepared,session,reviewedFields,sourceAuthenticated=false}={}){
  if(!sourceAuthenticated)fail('SOURCE_UNVERIFIED','A trusted live executable-quote source must be authenticated');
  if(!KINDS.includes(prepared?.kind)||prepared?.transaction?.kind!==prepared.kind||!prepared?.context||!prepared?.reviewedIntent)fail('INVALID_PREPARATION','canonical prepared transaction required');
  if(!session?.account||!session?.chainId||!Number.isSafeInteger(session.generation))fail('SESSION_REQUIRED','connected wallet snapshot required');
  if(!exact(prepared.context.account,normalizeAccount(session.account))||normalizeChainId(prepared.context.chainId)!==normalizeChainId(session.chainId))fail('SESSION_CHANGED','quote account or chain differs from connected wallet');
  if(!exact(prepared.transaction.request.from,session.account)||normalizeChainId(prepared.transaction.chainId)!==normalizeChainId(session.chainId))fail('TRANSACTION_CHANGED','transaction account or chain differs from wallet');
  const fingerprint=transactionFingerprint(prepared.transaction);
  if(prepared.transactionFingerprint!==fingerprint)fail('FINGERPRINT_CHANGED','prepared transaction differs from canonical review');
  if(!reviewedFields||typeof reviewedFields!=='object'||Array.isArray(reviewedFields)||!Object.keys(reviewedFields).length)fail('REVIEW_FIELDS_REQUIRED','explicit transaction review fields required');
  if(Object.values(reviewedFields).some(value=>value===null||value===undefined||value===''))fail('INCOMPLETE_REVIEW','review contains empty transaction fields');
  return Object.freeze({kind:prepared.kind,account:normalizeAccount(session.account),chainId:normalizeChainId(session.chainId),generation:session.generation,transactionFingerprint:fingerprint,reviewedFields:Object.freeze({...reviewedFields}),quoteId:prepared.context.quoteId,expiresAt:prepared.context.expiresAt});
}

export function assertConfirmedExecution({prepared,review,session,confirmedFingerprint,nowSeconds}={}){
  if(!review||!prepared?.transaction||!session)fail('REVIEW_REQUIRED','review and prepared transaction required');
  if(!Number.isSafeInteger(nowSeconds)||nowSeconds>=review.expiresAt||nowSeconds>=prepared.context?.expiresAt)fail('REVIEW_EXPIRED','canonical review expired');
  if(!exact(review.account,session.account)||normalizeChainId(review.chainId)!==normalizeChainId(session.chainId)||review.generation!==session.generation)fail('SESSION_CHANGED','wallet changed after transaction review');
  const current=transactionFingerprint(prepared.transaction);
  if(review.transactionFingerprint!==current||confirmedFingerprint!==current||prepared.transactionFingerprint!==current||review.kind!==prepared.transaction.kind)fail('REVIEW_CHANGED','the confirmed transaction no longer matches the prepared transaction');
  return Object.freeze({transaction:prepared.transaction,reviewedIntent:Object.freeze({kind:prepared.transaction.kind,transactionFingerprint:current}),freshness:Object.freeze({observedAt:prepared.context.observedAt,expiresAt:prepared.context.expiresAt}),review});
}

// No browser or RPC interaction occurs in this module. Callers must still perform
// authenticated quote retrieval, on-chain preflight, and explicit wallet submission.
