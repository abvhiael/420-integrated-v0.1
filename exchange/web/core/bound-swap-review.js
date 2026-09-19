import { buildSwapTransaction } from './execution.js';
import { transactionFingerprint } from './preflight.js';
import { canonicalSwapReview, assertDisplayedSwapReview } from './human-readable-review.js';
import { canonicalEnvelopeFields, buildExecutionReview, assertConfirmedExecution } from './reviewed-execution-bridge.js';

export class BoundSwapReviewError extends Error {
  constructor(code, message) { super(message); this.name = 'BoundSwapReviewError'; this.code = code; }
}
const fail = (code, message) => { throw new BoundSwapReviewError(code, message); };

// Prove that the amounts, recipient, route and calldata displayed to the user
// were derived from the SAME execution input. Neither an API source flag nor
// a transaction fingerprint by itself authenticates a quote or contract code.
function reconstruct({runtime, prepared, execution}) {
  if (prepared?.kind !== 'SWAP' || prepared.transaction?.kind !== 'SWAP' ||
      prepared.reviewedIntent?.kind !== 'EXACT_INPUT_PATH' || !prepared.context) {
    fail('INVALID_PREPARATION', 'A canonical prepared swap is required');
  }
  let rebuilt;
  try {
    rebuilt = buildSwapTransaction({
      runtime, account:prepared.context.account,
      reviewedIntent:prepared.reviewedIntent, execution,
    });
  } catch (error) {
    fail('REBUILD_FAILED', `Cannot reconstruct canonical swap: ${error.message}`);
  }
  const fingerprint = transactionFingerprint(rebuilt);
  if (fingerprint !== transactionFingerprint(prepared.transaction) ||
      fingerprint !== prepared.transactionFingerprint ||
      JSON.stringify(canonicalEnvelopeFields(prepared)) !==
        JSON.stringify(canonicalEnvelopeFields({kind:'SWAP', transaction:rebuilt}))) {
    fail('EXECUTION_CHANGED', 'Displayed swap inputs do not encode the prepared transaction');
  }
  return fingerprint;
}

// A trust flag here is an integration prerequisite, not an authentication
// mechanism. The future quote client must establish its provenance separately.
export function beginBoundSwapReview({runtime,prepared,execution,tokens,quoteId,session,sourceAuthenticated=false}={}) {
  if (!sourceAuthenticated) fail('SOURCE_UNVERIFIED', 'Trusted executable quote source not established');
  reconstruct({runtime,prepared,execution});
  const projection = canonicalSwapReview({prepared,execution,tokens,quoteId});
  const envelope = canonicalEnvelopeFields(prepared);
  const review = buildExecutionReview({prepared,session,reviewedFields:envelope,sourceAuthenticated});
  return Object.freeze({projection,review});
}

// Called only after a user has seen the canonical review. Reconstruct at
// confirmation time: a modified amount, route, recipient, calldata, quote,
// displayed text or wallet generation invalidates the entire review.
export function confirmBoundSwapReview({runtime,prepared,execution,tokens,quoteId,session,bound,displayed,confirmedFingerprint,nowSeconds}={}) {
  if (!bound?.projection || !bound?.review) fail('REVIEW_REQUIRED','Start a canonical review before confirmation');
  reconstruct({runtime,prepared,execution});
  const current = canonicalSwapReview({prepared,execution,tokens,quoteId});
  if (JSON.stringify(current) !== JSON.stringify(bound.projection)) fail('REVIEW_CHANGED','Canonical swap inputs changed since review');
  assertDisplayedSwapReview(current,displayed);
  return assertConfirmedExecution({prepared,review:bound.review,session,confirmedFingerprint,nowSeconds,displayedFields:current.envelope});
}

// This module intentionally has no provider, RPC or eth_sendTransaction path.
// Live quote authentication, on-chain preflight and explicit wallet consent
// are separate gates before a request can ever be submitted.
