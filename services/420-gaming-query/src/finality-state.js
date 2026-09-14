export const FinalityDecision420 = Object.freeze({
  PENDING: "pending",
  FINALIZED: "finalized",
  REVERTED: "reverted",
  REORGED: "reorged",
  RPC_UNAVAILABLE: "rpc-unavailable",
  CHAIN_MISMATCH: "chain-mismatch",
  INDEXER_BEHIND: "indexer-behind",
  INDEXER_AHEAD: "indexer-ahead",
  DUPLICATE_EVENT: "duplicate-event",
  INVALID: "invalid"
});

function integer(value) {
  return Number.isInteger(value) && value >= 0;
}

export function evaluateFinalityState420({
  expectedChainId,
  rpcChainId,
  txStatus,
  receiptBlockNumber,
  receiptBlockHash,
  canonicalBlockHash,
  canonicalHeadNumber,
  finalizedHeadNumber,
  indexerHeadNumber,
  confirmationsRequired = 1,
  eventId,
  seenEventIds
} = {}) {
  if (rpcChainId == null) return { canonical: false, state: FinalityDecision420.RPC_UNAVAILABLE };
  if (expectedChainId != null && rpcChainId !== expectedChainId) {
    return { canonical: false, state: FinalityDecision420.CHAIN_MISMATCH };
  }
  if (txStatus === "reverted") return { canonical: false, state: FinalityDecision420.REVERTED };

  if (eventId && seenEventIds?.has?.(eventId)) {
    return { canonical: false, state: FinalityDecision420.DUPLICATE_EVENT };
  }

  if (integer(indexerHeadNumber) && integer(canonicalHeadNumber)) {
    if (indexerHeadNumber < canonicalHeadNumber) return { canonical: false, state: FinalityDecision420.INDEXER_BEHIND };
    if (indexerHeadNumber > canonicalHeadNumber) return { canonical: false, state: FinalityDecision420.INDEXER_AHEAD };
  }

  if (!integer(receiptBlockNumber) || typeof receiptBlockHash !== "string" || receiptBlockHash.length === 0) {
    return { canonical: false, state: FinalityDecision420.PENDING };
  }
  if (typeof canonicalBlockHash !== "string" || canonicalBlockHash.length === 0) {
    return { canonical: false, state: FinalityDecision420.RPC_UNAVAILABLE };
  }
  if (receiptBlockHash !== canonicalBlockHash) {
    return { canonical: false, state: FinalityDecision420.REORGED };
  }

  if (!integer(finalizedHeadNumber) || !integer(confirmationsRequired) || confirmationsRequired < 1) {
    return { canonical: false, state: FinalityDecision420.INVALID };
  }

  const confirmations = finalizedHeadNumber >= receiptBlockNumber
    ? finalizedHeadNumber - receiptBlockNumber + 1
    : 0;
  if (confirmations < confirmationsRequired) {
    return { canonical: false, state: FinalityDecision420.PENDING, confirmations };
  }

  return {
    canonical: true,
    finalized: true,
    state: FinalityDecision420.FINALIZED,
    confirmations
  };
}
