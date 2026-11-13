# 420Explorer — Testnet work and deferred live qualification roadmap

**Status:** OPEN — testnet/live qualification pending (2026-11-13)  
**Authority:** [EXP-2R.5 authoritative post-EXP-2 roadmap](EXP-2R.5-authoritative-next-phase-roadmap.json), specifically **EXP-NEXT.4** and **EXP-NEXT.5**. This document is the execution handoff, **not** a replacement roadmap or a new approval gate.

## Merged repository baseline

- [420Explorer hardening PR #1150](https://github.com/abvhiael/420-integrated-v0.1/pull/1150) merged to `main` as `05b8abf94e448abd29b404f109e8e3805df7f6de`.
- Exact PR head `4fabbe7d16edad530b80479b8414b1f8723535c8` passed Explorer EXP-2.2, EXP-2.3, EXP-2.4, EXP-2.5, EXP-2.6, EXP-NEXT.1, EXP-NEXT.2, EXP-NEXT.3, EXP-1.7 and EXP-1.8 workflow checks. The EXP-2.6 job confirms `go test ./explorer/...` and `go vet ./explorer/...` passed on the PR head. 420Indexer and EXP-2.1 workflows were skipped in the inspected PR runs; this is not evidence of a failure or of a fresh Indexer qualification.
- Merged implementation fixes: reject invalid/unsupported Indexer URL forms; fail readiness for ingest timestamps more than 30 seconds ahead of the Explorer clock. Regression tests included.
- The branded frontend is publicly identified at **https://explorer.420integrated.org/** and its Cloudflare Worker source exists. Public website existence alone does **not** establish a live API or production-equivalent backend qualification. The current readiness fixture still has `REPLACE` backend/frontend URLs and must not be silently promoted to verified.
- 420Explorer remains **contract-free**, read-only and dependent on the shared **420Indexer /v1** projection; contracts are audited as **discovered external runtime dependencies**, not Explorer-owned deployments.

## EXP-NEXT.4 — Deferred testnet execution checklist

- [ ] **Deployed release identity:** pin an exact release-candidate commit and immutable deployment artifacts/manifest, and capture the actual Cloudflare Worker/frontend build identity, HTTPS backend origin and Indexer deployment identity. Confirm the deployed website is the matching code, not merely a static shell. Do not change production DNS or origin configuration without qualified deployment inputs.
- [ ] **Frontend → API:** probe the public site and `/v1/health`, `/v1/ready`, `/v1/status`, `/v1/capabilities`; check same-origin Worker proxy, CORS/security headers, 503 failure modes, branding, search and required browser routes. Verify that pages do not invent data on API failures.
- [ ] **API → Indexer:** verify the configured `EXPLORER_ORIGIN` and `EXPLORER_INDEXER_URL` resolve to the approved services and `chainId=420`. Test indexed blocks, block trace, transactions, receipts, logs, addresses, contract details, services and historical versions, asset activity, stake activity, consensus, snapshot pagination, and head/safe/finalized status against representative data.
- [ ] **Indexer → canonical witnesses:** compare selected block hashes, transactions, receipts, log positions and provenance with approved canonical RPC. Check exact chain identity, freshness, finality ordering and historical reorg behavior. Verify consensus slot, validator and producer attribution against an independent approved consensus witness.
- [ ] **Contract discovery:** verify ProtocolRegistry target-network deployed runtime code hash (not merely its frozen configured address); compare registered service/version activations, implementations, commitments and ABI/descriptor provenance with direct canonical Registry reads. Test unknown or deprecated versions, mismatched addresses/code hashes and false verification metadata; keep verified source informational only. Do not create an Explorer-specific smart contract.
- [ ] **Recovery/security:** exercise Indexer outage, missing origin, stale data, wrong chain, invalid/future timestamps, malformed upstream responses, registry inconsistency, RPC/provider outage, restart/resume, bounded non-finalized reorg, finalized-history conflict and index rebuild. The Explorer must fail closed without an independent crawler or canonical-data authority.
- [ ] **Live validation:** run the existing `.github/workflows/explorer-live-testnet.yml` against non-placeholder public/approved endpoints with the exact deployed SHA, canonical RPC, consensus witness, ProtocolRegistry address/code hash, immutable deployment manifest and recovery evidence. Execute EXP-7.1 smoke and EXP-7.2 representative-data validation; archive reports with run ID, SHA and artifact hashes.
- [ ] **Readiness reconciliation:** only after verified deployed evidence, update `testnet/public-services/explorer/readiness.json` and any authoritative dependency/acceptance records. Record the already-deployed public frontend URL accurately without asserting that its API or live chain is qualified prematurely.

## EXP-NEXT.5 — Final acceptance

- [ ] Reconcile all applicable Explorer Genesis acceptance criteria AC-1 through AC-10 and remaining blocker records against **the exact qualified deployed release**.
- [ ] Run the retained repository, browser, deployment, security and recovery test inventory on the final required SHA; preserve results and explicit non-applicable evidence.
- [ ] Close only evidence-backed findings; do **not** declare testnet/Genesis readiness if any mandatory live witness, provider deployment or acceptance criterion remains unresolved.

## Current blockers / handoff boundary

The current audit did **not** obtain live responses from the public Explorer API, its backend, the 420Indexer deployment, approved canonical RPC or consensus witness. No immutable live deployment manifest, live contract code-hash witness, representative transaction/Registry data, or production-equivalent recovery report was verified in this handoff. Consequently **EXP-NEXT.4 and EXP-NEXT.5 remain OPEN**. The deployed website is not being mistaken for an undeployed frontend; qualification of the complete service chain remains the outstanding work.

Related existing mechanisms: `explorer/deploy/README.md`, `explorer/cloudflare/README.md`, `explorer/cmd/explorersmoke`, `explorer/cmd/explorerlivevalidate`, `scripts/verify-exp-next-4-live-preflight.py`.
