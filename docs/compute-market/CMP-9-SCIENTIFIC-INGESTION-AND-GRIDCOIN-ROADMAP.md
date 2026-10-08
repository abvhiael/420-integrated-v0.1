# CMP-9 scientific participation and external-asset interoperability — testnet roadmap

Status: **PLANNED / NOT LIVE-QUALIFIED**. Owner: CMP-9 testnet, with independent 420Bridge and 420Exchange asset approval gates. Recorded from main baseline `af37cb6ece74e9efe4b9205f32ba51b7458aed0e`. This is a scoped execution annex to [the canonical Compute roadmap](COMPUTE-MARKET-POST-CMP1-ROADMAP.md) and [shared Step 15 testnet worklist](../ROADMAP.md). It **does not renumber CMP-9.1–CMP-9.15**, supersede CMP-5/6 qualification, approve Gridcoin deployment or authorize real asset transfers.

## Repository basis and boundaries

- Implemented and repo-qualified: Folding@home normalization (CMP-5.1); BOINC normalization (CMP-5.2); external proof/credit records (CMP-5.5); one-time canonical-work consumption (CMP-5.6); trusted external-result attestation and immutable canonical-work mapping (CMP-5.7); useful-reward accounting (CMP-6); user-facing Compute (CMP-8).
- A normalization contract **does not fetch, authenticate, or prove provider records**. External data must be validated by trusted off-chain evidence services and a governed attester, with explicit source consent/terms review.
- Folding@home points and BOINC granted credit are **contribution metrics, not automatically transferable cryptocurrencies**. GRC and CURE are distinct assets/economies and must not be confused with BOINC or Folding@home accounting.
- Curecoin bridge source: `contracts/src/bridge/adapters/CurecoinBridgeAdapter420.sol`. Its `contracts/config/bridge/curecoin-mainnet-v12.5.11.json` profile is `APPROVED_INACTIVE_PENDING_PRODUCTION_VERIFIER_AND_GATEWAY_SCRIPT`; a contract adapter alone is not live custody, verifiable finality or settlement.
- 420Exchange's V15.8 live bridge qualification requires independently verified finalized source/destination events and destination settlement evidence. No asset listing is approved by this roadmap.

## Execution slices — science participation

All implementation steps are Level 1 focused checks; a single retained science-ingestion Level 2 milestone applies at S-06, and a separate payout Level 2 at S-09. CMP-9 overall live operational closeout and CMP-10 security remain separate. Use exact release/deployment SHA and real chain/provider data; no synthetic fixture qualifies an operational gate.

### S-01 — External-provider policy, capabilities and source inventory — COMPLETE (Level 1)

**S-01 status:** repository policy/inventory qualified on `879beafc2268f7fe7d7c2f5023c4c128a8bfc639`; [S-01 source assessment](CMP-S01-PROVIDER-ACCESS.md) and [Level 1 evidence](CMP-S01-QUALIFICATION-EVIDENCE.md). All provider production access, account monetization and reward pathways remain explicitly disabled pending real provider/operator approval and trusted work-unit evidence. This status does not qualify S-02 or live use.

Inventory each supported Folding@home statistics/result channel and each specific BOINC project (BOINC has no single universal project-wide truth endpoint). Capture documented provider terms, permitted automated access, API stability/rate limits, identifier formats, user-consent/privacy requirements, reporting delays, revocation/correction behavior, project-scoped trust and whether credible work-unit-level evidence is available. Record **unsupported** wherever only aggregate points/credits are exposed. Neither donations nor third-party credits are accepted as scientific validity proofs.

Exit: versioned allowlist, evidence-quality tiers, permissions, threat model, provider outage/terms-change procedure and an explicit per-provider enable/disable decision.

### S-02 — Production-grade read-only ingestion clients — PARTIAL (Level 1 implementation PASS; live provider gate BLOCKED)

**Implementation evidence:** [S-02 Level 1](CMP-S02-QUALIFICATION-EVIDENCE.md), qualified implementation `ec0eb70b5a44f5195b530b2e31166bf18bdefb76`. Fixture-based client security and source format tests passed, but S-02 cannot be marked COMPLETE without authorized real provider response/schema evidence and transport DNS pinning. No production source access or funded rewards enabled.

Build separately versioned, provider-scoped off-chain ingestion clients with HTTPS/TLS validation, no embedded credentials, strict hostname/redirect/SSRF policy, bounded pagination/rate limits, safe timeouts/backoff, stale-source states, schema/version drift alerts, normalization of timestamp/timezone and credit units, and observation cursors. Preserve minimally necessary immutable raw-source digests and redacted provenance; avoid publishing usernames/host IDs, data sets or result files.

Exit: deterministic contract tests using approved fixtures plus actual read-only provider endpoint responses; reject malformed, forged, late, missing and inconsistent records. No writes or rewards.

### S-03 — Source-of-truth and trusted evidence verification

Require provider-server corroboration, or a project-authorized independent proof source, sufficient to establish contributor, project, assignment, work unit, result acceptance and credited event under its actual provider semantics. Reconcile updates/rollbacks and rescoring; prohibit deriving work-unit uniqueness from points-only snapshots. Attest only supported evidence strength. If only account-level aggregates are available, display them as observations **not reward-eligible work** until an audited uniqueness policy exists.

Exit: independent evidence-verifier service, signed scheme/version, source receipt hashes, freshness/expiry, dispute/correction channel, source-unavailable fail-closed tests, attester governance onboarding and revocation drills.

### S-04 — Participant identity and consent

Use explicit opted-in account linking between a 420Wallet address and an external Folding@home donor/team or specific BOINC project participant/host. Verify control via provider-supported cryptographic challenge or equivalent independently verified proof; forbid self-asserted usernames or public-stat lookups as ownership proof. Where no reliable ownership proof exists, **disable monetized identity linkage** rather than pretending one is available. Support opt-out, rekey/relink, historical ownership transitions, collision/Sybil resistance, consent records, pseudonymous on-chain commitments, privacy minimization and right-to-disconnect without falsifying historical reward settlement.

Exit: canonical chain/account/source/participant binding; negative tests for impersonation, reused proof, wrong chain/account, disclosure and stale ownership.

### S-05 — Canonical record binding and cross-provider deduplication

Feed verified records through existing CMP-5.1/5.2 and CMP-5.5 normalized commitment interfaces. CMP-5.7 trusted attester resolves source/result/proof to one canonical external-work identity; CMP-5.6 authorized consumer consumes that identity exactly once. Prove that changed credit, donor/team alias, API wrapper, resubmitted record or source adapter cannot create second eligible work where equality is established. When cross-provider equality cannot be established, explicitly bound the uncertainty and do not claim global duplicate protection.

Exit: source-to-canonical trace, idempotent processing, reorg/replay tests, correction handling, authorized-consumer controls and immutable auditable mapping.

### S-06 — Read model, app, and Level 2 evidence-ingestion milestone

Expose chain-scoped bounded Indexed contribution/attestation/claim state and clearly separated external-source observations through 420Compute. Show project, provider, verified/unverified/pending/revoked eligibility, credit unit, credited event and age/finality without pretending external points equal $420 or computing a nonexistent balance. Never publish source credentials, private workloads or result payloads. Run integrated ingestion → attestation → indexed view testing on one SHA plus genuine read-only endpoint observation.

Exit: Level 2 exact-SHA pass with privacy, unavailable-source, stale-data and UI authority-label assertions. Live payout remains off.

### S-07 — Economic eligibility and policy approval

Publish explicit governed eligibility rules for accepted projects, source schemes, unit conversion/scoring, effective epochs, budget caps, per-user/project/period quotas, maturity/finality delays, anti-farming, identity-change windows and corrections/clawback policy. Assess whether external participation is allowed to earn both third-party rewards and $420; **CMP-5.6 only prevents double claims inside 420**, not another network's payout. Never derive $420 amounts by assuming one BOINC credit or Folding@home point is a coin. Treasury/funding authority and accounting must remain canonical CMP-6/Vault paths; avoid unapproved inflation.

Exit: reviewed payout policy, cap/solvency simulations, adversarial gaming analysis, economic-governance decision and approved testnet funding.

### S-08 — Funded entitlement and Wallet settlement integration

Deploy/publish exact canonical contracts, configure trusted attesters, allowlisted reward consumer, projects/policies and verified Source → CanonicalWork mapping. Use one-time claim consumption plus CMP-6 authorized reward entitlement, Vault funding and beneficiary transfer as implemented in the actual deployed release; where a direct integration path is missing, implement and qualify the narrow canonical adapter before activation. Record each transition, source ID, chain, policy, proof digest, transaction, finality and reconciliation. Never pay from a browser, indexer, source poller or unverifiable external data.

Exit: actual funded testnet $420 payout with conservation/accounting evidence and negative replay/expiry/revocation/funding-exhaustion tests.

### S-09 — Live end-to-end two-provider milestone

With real provider-approved participant identities and real non-private contribution events, qualify Folding@home and at least one independently supported BOINC project end-to-end: observed → independently verified → attested → canonical work → one-time consumed → authorized reward → funded paid $420 → Wallet/Indexer/420Compute reconciled. Check wrong-user, duplicate-work, stale rescoring, outage, failed settlement, refund/rollback and malicious-attester conditions. Do not claim this milestone complete if either provider lacks legitimate adequate work-unit or identity evidence.

Exit: one retained Level 2 exact-release testnet evidence bundle including live transaction/receipt hashes, deployment and source identities, operator sign-off and independent review.

### S-10 — Operational soak, CMP-9 and CMP-10 handoff

Prove sustained ingestion, rate-limit resilience, restart/backfill correctness, source correction, indexing reorg handling, key/attester rotation, recovery, capped-budget exhaustion, emergency pause and rollback. Feed evidence into canonical CMP-9.13 scientific demonstration, CMP-9.14 soak, CMP-9.15 CMP-0 operational closeout, and CMP-10 security campaigns. These are prerequisites, not silently completed by this annex.

Exit: auditable go/no-go and known blocker list; no production credit or reward claims from fixture-only observations.

## Gridcoin (GRC) bridge and 420Exchange candidate — independent workstream

**Disposition: CANDIDATE FOR FEASIBILITY STUDY; NOT APPROVED/IMPLEMENTED.** Gridcoin is relevant because of BOINC reward participation, but it is an independent UTXO-style blockchain and GRC is **not** a native BOINC credit. There is no requirement to bridge GRC to fund $420 compute rewards.

### G-01 — Chain/source and asset feasibility (GO/NO-GO)

Independently confirm current Gridcoin network genesis/network ID, address encoding, chain/transaction model, current consensus/finality and reorganization/security characteristics, node RPC/indexing availability, signing/custody capabilities, required confirmations, maintenance status, denomination/precision and bridge-policy constraints. Verify any permission/license, supported custodial gateway model, contract/verifier feasibility, liquidity and risk appetite using primary network documentation and live nodes. Do not copy Curecoin's PoS assumptions, genesis constants or verifier. Document whether trust-minimized proof verification is feasible or whether a federated/custodial gateway would be necessary. If no credible two-way verified settlement path exists, stop bridge approval.

### G-02 — Bridge threat model and route architecture

Specify GRC asset/route identities, strictly governed gateway scripts, native-coin locking/release or wrapped-asset backing, supply accounting, independent proof/finality verification, source-output/message replay guards, reorg/fork handling, rate caps, pausing, emergency withdrawals, operational-key rotation, reserves/proof-of-reserves, insolvency and failure recovery. Reuse `GatewayRouter420` interfaces where compatible; implement a Gridcoin-specific verifier/adapter only after G-01 passes. No raw keys or browser signing authority.

### G-03 — Exact-head isolated implementation/qualification

Implement an isolated Gridcoin bridge adapter, verifier and chain-specific test fixtures only if approved. Require chain-identical-header/finality checks, invalid-proof, forged gateway, deep reorg, double-spend, replay, stale/foreign network, duplicate settlement, economic caps and governance adversarial tests. Retain canonical bridge owner CI, affected Indexer/SDK/Wallet interfaces and exact-head Level 1 checks, with integration Level 2 only at the actual route lifecycle boundary. No duplicate repo-wide test matrix.

### G-04 — 420Exchange optional GRC market admission

After verified asset registration, route risk approval and custody/settlement evidence, evaluate a separately approved **GRC representation** for 420Exchange. Define token decimals/metadata, verified canonical wrapped-asset contract if needed, oracle/liquidity source, GRC/$420 market viability, price/fee/slippage guards, listing governance, API/Indexer/Wallet integration and clear bridge-vs-spot distinction. A bridge does **not** automatically create a market or liquidity. Default trade/bridge gates remain OFF pending actual testnet proof and market-maker/liquidity readiness.

### G-05 — Independent live bridge/Exchange testnet closeout

With independently maintained source node, valid source-chain finality proofs and deployed 420 gateway/representation, qualify inbound and outbound GRC using disposable test amounts where a suitable authorized source test environment exists. Record finalized source and destination transaction/proof, exact custody/reserve change, replay guard, beneficiary receipt and redeemability. Follow 420Exchange V15.8 route/drill rules. Then separately qualify small controlled GRC/$420 quotes/swaps only if a market was approved and funded. Never confuse gateway inbound acceptance with beneficiary payout.

### G-06 — External rewards separation and decision

Track GRC/CURE balances only from appropriately authenticated independent chain/account sources. Display their rewards and $420 rewards separately; never assume BOINC credits are GRC or that a credited Folding@home work unit is paid CURE. A user receiving GRC/CURE independently may choose later to bridge/exchange assets, but that is **not** a prerequisite for 420Compute scientific rewards. Retain a GO/NO-GO record based on finality, safe custody, validator costs, liquidity, terms and benefit.

## Qualification and evidence rules

Every implementation slice records step/level, actual base/main, exact implementation SHA, changed paths, owning workflow/run/job, tests including negatives, external provider/environment identity, secret redaction and current blockers. Evidence-only bookkeeping may inherit the qualified implementation SHA. Do not declare a public network, approved Gridcoin route, exchange listing, production-ready bridge, external attestation or funded payout without actual independent deployment/source evidence. All future contract/bridge implementation changes use dedicated PR and user-approved merge policy.
