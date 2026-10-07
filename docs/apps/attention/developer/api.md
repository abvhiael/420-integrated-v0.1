# 420 Attention API and privacy boundary

Derived APIs may expose public campaign metadata, consent status appropriate to the authenticated user, proof/reward status and campaign liability summaries.

Public APIs must not expose raw behavioral telemetry, private targeting data, delivery endpoints or unrelated personal information. Security-sensitive clients should re-read canonical proof/reward state.

## Browser projection contract

The ATTENTION-AUDIT-6 browser client defines the consumer boundary that ATTENTION-AUDIT-7 must implement.

Read projections use the versioned schema `420-attention-projection-v1` and must carry:

- `canonical: true` only when the response is derived from canonical Attention state;
- source chain ID;
- source block hash;
- bounded application fields required by the requested view.

The client expects campaign, account, proof and reward projections and rejects missing schema/provenance.

Mutation preparation uses `420-attention-transaction-review-v1`. A prepared review must include canonical source provenance plus an exact transaction target, calldata and optional native-420 value. The browser independently restricts the target to configured canonical Attention contracts, requires the Wallet chain to match, simulates the transaction with `eth_estimateGas`, and only then permits explicit Wallet submission.

The service does not sign, hold Wallet authority or make projections canonical. ATTENTION-AUDIT-7 owns concrete HTTP implementation, reorg/rebuild semantics, bounded retry/idempotency policy and projection authorization.
