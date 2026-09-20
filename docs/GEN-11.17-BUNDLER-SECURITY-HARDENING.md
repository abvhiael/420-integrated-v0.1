# GEN-11.17 — Bundler security hardening and hostile dependency isolation

Status: IN QUALIFICATION. This is a focused implementation increment, not a claim of a complete independent security audit.

## Execution RPC uncertainty

The execution RPC can accept `eth_sendTransaction` and lose its response. A timeout, redirect, HTTP non-200 response, truncated/oversized/malformed JSON, wrong JSON-RPC version or ID, contradictory error/result payload, or invalid transaction hash is **ambiguous**, not proof that submission was rejected. The Bundler now reports `bundle.ErrAmbiguousSubmission`, retains the durable submission intent, removes the operation from the active mempool, and does not blindly retry it. The operator must reconcile the pending intent against execution-chain and transaction-sender evidence before deciding what to do. A well-formed, matching JSON-RPC error is treated as an explicit rejection; retry is permitted only after later simulation. Redirect following is disabled on the transaction-submitting client.

The persisted pending-intent record has no signed transaction hash or nonce and is **not** by itself sufficient to prove acceptance, rejection, inclusion, or finality. Operators must not clear unresolved intents merely because a polling interval elapsed. Transaction submission remains noncustodial with respect to Wallet signing; EntryPoint420 and the SmartAccount enforce account authorization.

## Bounded inbound work

The production HTTP server now has configurable `BUNDLER_MAX_CONCURRENT_REQUESTS` (default 64, accepted range 1–4096). Requests beyond that limit receive HTTP 503 immediately with `Retry-After: 1`, rather than accumulating unbounded waiting request handlers. Read-header timeout is 5 s, whole-request read timeout 10 s, idle timeout 30 s, maximum parsed request headers 16 KiB, and response write timeout is the configured execution-RPC request timeout plus 15 s. Existing public and peer request bodies remain capped at 1 MiB each.

These bounds are local operator availability controls, not consensus or admission authority. A rejected HTTP request cannot invalidate a signed UserOperation, and Wallets remain free to select another compatible Bundler.

## Qualification

Adversarial tests cover an ambiguous execution transaction send, untrustworthy RPC acknowledgments, and overload isolation. The repository-wide qualification workflows must pass on one exact commit before marking the phase complete. Remaining work includes a dedicated cross-client security review, end-to-end transport tests against production-compatible reverse proxy/hosts, dependency resolution rebinding assessment, and a documented operator procedure for reconciling orphan pending intents.
