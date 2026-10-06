# PuffBuddies PB-0.18 documentation/invariant tests

## Purpose

PB-0.18 turns the accumulated PB-0.1 through PB-0.17 documentation authority into a stronger machine-verifiable contract. Earlier checks remain authoritative; PB-0.18 adds inventory, global uniqueness, continuity, cross-step, and adversarial mutation coverage. It introduces no runtime implementation, deployment, address, service ID, or live integration.

## Canonical test inventory

Every completed PB-0.1 through PB-0.17 canonical source document and qualification-evidence record is required input. A completed step cannot disappear from the verifier merely because another document repeats its concepts.

## Canonical documentation/invariant-test invariants

### PB-DOCINV-001 — Complete accumulated inventory
Every canonical PB-0.1 through PB-0.17 source document and evidence record is required input.

### PB-DOCINV-002 — No silent step omission
Every completed step through PB-0.17 has source authority and durable evidence represented by machine checks.

### PB-DOCINV-003 — Global identifier uniqueness
Invariant identifiers are globally unique across canonical PB-0 source documents.

### PB-DOCINV-004 — Exact family sequences
Each invariant family retains its canonical exact identifier sequence and count.

### PB-DOCINV-005 — Roadmap continuity
PB-0.1 through PB-0.17 must appear COMPLETE in uninterrupted order.

### PB-DOCINV-006 — Evidence continuity
Each PB-0.1 through PB-0.17 evidence record identifies its canonical step and COMPLETE status.

### PB-DOCINV-007 — Product identity cross-check
Checks preserve adult dating/social discovery, Dating/Buddy/Both, optional cannabis compatibility, and wallet/profile unlinkability.

### PB-DOCINV-008 — Consent cross-check
Checks preserve mutual match before ordinary private messaging, revocability, block supremacy, and no purchased/admin/algorithmic consent.

### PB-DOCINV-009 — Privacy cross-check
Checks preserve private/off-chain sensitive dating state, minimum disclosure, relationship confidentiality, and purpose limitation.

### PB-DOCINV-010 — Visibility cross-check
Checks preserve discoverable-not-public semantics, field audiences, stale-visibility revocation, and client-hiding-not-authorization.

### PB-DOCINV-011 — Authority cross-check
Checks preserve PuffBuddies relationship/lifecycle/safety ownership and bounded ecosystem dependencies.

### PB-DOCINV-012 — Derived-service cross-check
Search, Indexer, Explorer, Analytics, Notifications, caches, projections, and similar consumers remain non-canonical.

### PB-DOCINV-013 — Lifecycle/deletion cross-check
Checks preserve fail-closed stale authorization, deactivation/deletion distinction, participation revocation, and derived-state invalidation.

### PB-DOCINV-014 — Matching cross-check
Hard exclusions precede ranking, ranking is non-canonical, one-sided likes are not messaging consent, and reciprocal authorized intent is required.

### PB-DOCINV-015 — Cannabis cross-check
Cannabis non-use remains first-class and cannabis state cannot become public/tokenized identity, medical/legal proof, impairment evidence, or marketplace entitlement.

### PB-DOCINV-016 — Non-goal cross-check
Checks preserve prohibitions on public relationship/cannabis registries, paid consent/block bypasses, public desirability/reputation systems, stale resurrection, and client-only privacy.

### PB-DOCINV-017 — Repository-structure cross-check
Reserved PB-0.17 paths remain architecture locations rather than evidence of implementation/deployment.

### PB-DOCINV-018 — No invented public authority
Canonical PB-0 documents must not assign a PuffBuddies fixed on-chain address or invent a PuffBuddies service identifier.

### PB-DOCINV-019 — Adversarial mutation proof
Representative mutations of canonical facts must make the verifier fail.

### PB-DOCINV-020 — Exact-head app-scoped qualification
The cumulative verifier and adversarial mutation tests run against the exact implementation SHA in the PuffBuddies PB-0 workflow.

## Cross-step invariant matrix

Identity/scope, public/private boundary, consent, eligibility/lifecycle, trust/dependencies, safety, matching, cannabis, non-goals, visibility, and repository structure are cross-checked against their canonical PB-0 owners. Repeated summaries do not replace those source authorities.

## Adversarial mutation contract

The invariant-test harness copies PB-0 documentation into a temporary tree, proves a clean copy passes, then independently mutates representative facts and requires each mutated copy to fail. Required mutations cover invariant IDs, adult floor, mutual messaging, block supremacy, fixed address, service ID, structure IDs, and roadmap completion continuity. The working tree is never mutated.

## PB-0.18 completion boundary

PB-0.18 is complete only when accumulated documentation is verified coherently, representative negative mutations demonstrably fail, the exact-head app workflow passes, and durable evidence identifies the qualified implementation SHA.
