import { normalizeAccount, normalizeChainId } from './wallet-session.js';
import { canonicalEnvelopeFields } from './reviewed-execution-bridge.js';

export class HumanReviewError extends Error {
  constructor(code, message) { super(message); this.name = 'HumanReviewError'; this.code = code; }
}
const fail = (code, message) => { throw new HumanReviewError(code, message); };
const address = value => typeof value === 'string' && /^0x[0-9a-f]{40}$/i.test(value) && !/^0x0{40}$/i.test(value);
const id = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);
const raw = value => typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/.test(value);
const exact = (a,b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

// Never derive execution input from a display amount. Instead derive the display
// from canonical raw units and a separately qualified token-decimals record.
export function formatRawUnits(value, decimals) {
  if (!raw(value) || !Number.isInteger(decimals) || decimals < 0 || decimals > 36) fail('INVALID_UNITS', 'canonical raw units and token decimals required');
  const scale = 10n ** BigInt(decimals), amount = BigInt(value);
  const whole = amount / scale, fractional = (amount % scale).toString().padStart(decimals, '0').replace(/0+$/, '');
  return fractional ? `${whole}.${fractional}` : whole.toString();
}
function token(token, expectedAddress) {
  if (!token || !address(token.address) || !exact(token.address, expectedAddress) || !Number.isInteger(token.decimals) || token.decimals < 0 || token.decimals > 36 || typeof token.symbol !== 'string' || !/^[A-Za-z0-9._-]{1,16}$/.test(token.symbol) || token.verified !== true) fail('TOKEN_METADATA_UNVERIFIED', 'qualified token address, decimals and symbol required');
  return Object.freeze({address: normalizeAccount(token.address), decimals: token.decimals, symbol: token.symbol});
}

// This is a deterministic review projection, not a quote-authentication service.
// It intentionally supports swap only; bridge/order review require separate
// beneficiary and order-lifecycle qualification before wallet execution.
export function canonicalSwapReview({prepared, execution, tokens, quoteId} = {}) {
  if (prepared?.kind !== 'SWAP' || prepared?.transaction?.kind !== 'SWAP' || prepared?.reviewedIntent?.kind !== 'EXACT_INPUT_PATH' || !prepared.context || !execution || !Array.isArray(execution.hops) || !execution.hops.length || !tokens) fail('INVALID_SWAP', 'canonical prepared swap required');
  if (!id(quoteId) || !exact(quoteId, prepared.context.quoteId)) fail('QUOTE_CHANGED', 'review must identify the prepared quote');
  const input = token(tokens.input, execution.tokenIn);
  const output = token(tokens.output, execution.hops.at(-1)?.tokenOut);
  const intermediate = execution.hops.map((hop,index) => {
    if (!id(hop.marketId) || !id(hop.routeId) || !address(hop.tokenOut) || !raw(hop.minAmountOutRaw) || BigInt(hop.minAmountOutRaw) <= 0n) fail('INVALID_ROUTE','canonical hop IDs, token and minimum required');
    const reviewed = prepared.reviewedIntent.hops?.[index];
    if (!reviewed || !exact(reviewed.marketId, hop.marketId) || !exact(reviewed.outputToken, hop.tokenOut)) fail('ROUTE_CHANGED','hop differs from reviewed canonical route');
    return Object.freeze({marketId:hop.marketId.toLowerCase(),routeId:hop.routeId.toLowerCase(),tokenOut:normalizeAccount(hop.tokenOut),minAmountOutRaw:hop.minAmountOutRaw});
  });
  if (!exact(execution.expectedPathHash,prepared.reviewedIntent.routeCommitment) || !exact(execution.recipient,prepared.reviewedIntent.recipient) || !raw(execution.amountInRaw) || !raw(execution.minFinalAmountOutRaw) || BigInt(execution.amountInRaw)<=0n || BigInt(execution.minFinalAmountOutRaw)<=0n || intermediate.length !== prepared.reviewedIntent.hops.length) fail('REVIEW_CHANGED','swap amount, recipient or route incomplete or changed');
  if (!exact(prepared.transaction.request.from,prepared.context.account) || normalizeChainId(prepared.transaction.chainId)!==normalizeChainId(prepared.context.chainId)) fail('SESSION_CHANGED','swap transaction changed wallet or network');
  return Object.freeze({
    envelope: canonicalEnvelopeFields(prepared), quoteId:quoteId.toLowerCase(),
    recipient:normalizeAccount(execution.recipient), input, output,
    amountInRaw:execution.amountInRaw, amountIn:formatRawUnits(execution.amountInRaw,input.decimals),
    minimumOutputRaw:execution.minFinalAmountOutRaw, minimumOutput:formatRawUnits(execution.minFinalAmountOutRaw,output.decimals),
    expectedPathHash:execution.expectedPathHash.toLowerCase(), hops:Object.freeze(intermediate),
  });
}

export function assertDisplayedSwapReview(projected, displayed) {
  if (!projected || !displayed || typeof displayed !== 'object' || Array.isArray(displayed)) fail('REVIEW_REQUIRED','displayed canonical swap review required');
  // Require a fresh exact projection, not a user-supplied alternate rendering.
  if (JSON.stringify(projected) !== JSON.stringify(displayed)) fail('REVIEW_CHANGED','displayed swap details differ from canonical raw-unit review');
  return projected;
}
