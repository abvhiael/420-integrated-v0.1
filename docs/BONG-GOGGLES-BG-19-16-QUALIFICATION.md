# BG-19.16 — public DISCOVER canonicality and eligibility boundary

**Status:** repository boundary implemented on open PR #350; **deployment and independent canonical visibility/moderation qualification remain blocked**. This record does not approve enabling the public HTTP server.

## Implemented

- `services/bong-goggles-indexer-v1/src/publicFeedQualification.js` supplies explicit `getView` and `canShowPublicObject` dependencies for the already existing restricted `routePublicFeedHttp` adapter. It does not start a server or inject itself into production.
- The reader requires an expected chain ID, a projected snapshot with structured schema/state/block hashes, and an independently sourced healthy canonical chain state for its exact indexed block. The projected block must be finalized, canonical (same block hash), and no more than a configured number of blocks behind current head.
- A plain `PUBLIC`, `ACTIVE` POST with an active canonical author may be considered only if a separately injected, CURRENT canonical policy reader returns a structured decision tied to that object, author, chain, indexed block/hash and nonempty policy version, including explicit author/object activity, public-audience, moderation and anonymous-eligibility predicates. Missing/false/throwing/contradictory decisions deny. Reposts, comments, parented records and audience/source references are unsupported and denied pending source-dependency qualification.
- `test/publicFeedQualification.test.js` exercises the allowed sample and wrong-chain, stale, unfinalized, reorg, missing policy, identity/version mismatch, moderation/anonymous denial, private/withdrawn/source-dependent content and reader errors; indexer `npm test` automatically includes it.

## Required before closing BG-19.16

1. Identify actual deployed, independently authoritative sources for `readMaterializedView`, `readCanonicalState` and `readEligibility`; document real source addresses/ABIs or services, trust boundaries, finality assumptions, checkpoint acquisition and exact eligibility semantics. An injected mock, projector flag or boolean is not an independently qualified policy.
2. Implement and test the canonical policy reader against actual content and author status, public audience, relationship/block restrictions relevant to anonymous presentation, every currently effective safety/moderation action and emergency hide, precedence of appeals/revocations, and any external content/media exposure restrictions. Deny if any required source is absent, lagging, inconsistent or fails; prove rollback/replay and simultaneous policy-change handling.
3. Bind the canonical snapshot and policy reader consistently so that a reorg, visibility withdrawal or moderation change cannot leave a formerly approved cached public item on a subsequent request. Prove behavior with real RPC/indexer integration tests and privacy-oriented end-to-end scenarios.
4. Confirm the deployment's finalized-head and maximum-lag policy, state-root/schema trust, request-time bounds and failure handling. Do not treat a caller-provided `healthy` flag or hash as authoritative without qualifying the source.
5. Independently review the complete policy and canonical-state adapters; record current-head CI, source/version evidence and explicit approval before wiring the HTTP server as enabled. HTTP origin/CORS/rate/size limits and browser route integration remain BG-19.17/19.18.

**Operational invariant:** `createPublicFeedHttpServer` defaults to `enabled:false`. Neither the new qualification module nor a passing unit test constitutes a deployment authorization.
