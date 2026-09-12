---
title: Rights & Verify
component: 420 Rights / 420Verify
audience:
  - developer
  - architect
  - reviewer
category: architecture
status: development
version: current
---

# Rights & Verify

420 Integrated separates **rights state** from **verification evidence**.

**420 Rights** is canonical protocol state for subject provenance, declared rights, holder succession, scoped licensing, revocation and effective-use checks. **420Verify** is a reproducible contract-source verification service that compares published build inputs with bytecode actually deployed on the 420 chain. A successful 420Verify result can strengthen technical provenance for software subjects, but it does not create a legal right, validate a rights claim, grant a license, prove authorship, certify safety or authorize a wallet action.

The central rule is: **rights records describe governed claims and licenses; verification evidence describes reproducibility of deployed code. Neither authority silently becomes the other.**

## 420 Rights boundary

The Genesis Rights suite consists of:

- `RightsIds420.sol` — component/service/action identifiers and canonical right classes;
- `RightsAuthorization420.sol` — CapabilityRegistry-backed subject/right authorization;
- `RightsPolicyRegistry420.sol` — governed right-class policy;
- `RightsAssetRegistry420.sol` — subject identity, metadata and provenance commitments;
- `RightsClaimRegistry420.sol` — claims, supersession and holder succession;
- `RightsLicenseRegistry420.sol` — deterministic scoped licenses, revocation and renunciation;
- `RightsRouter420.sol` — bounded consumer reads for right/license effectiveness.

No Rights contract adjudicates external law. 420 Rights provides canonical protocol records and authorization semantics; legal ownership disputes remain external or may be routed into 420 Arbitration where a protocol/application explicitly opts in.

## Canonical right classes

Genesis recognizes eight right classes:

- copyright;
- trademark;
- patent;
- personality;
- genetic;
- data;
- model;
- contractual.

A class must be configured and active in `RightsPolicyRegistry420` before a new claim can use it. Governance can revise class metadata or deactivate future claim use, but cannot rewrite historical claim identity.

## Subject identity and provenance

`RightsAssetRegistry420` registers a subject with:

- `subjectId`;
- subject type;
- controller;
- metadata commitment;
- provenance commitment;
- revision.

Subject registration is controller- or capability-authorized. Metadata may evolve under the same authority and advances the subject revision. The original subject identity and provenance commitment remain the anchor for later rights claims.

A provenance hash is evidence commitment, not an automatic legal finding. Consumers must not interpret subject registration by itself as proof that the controller legally owns every possible right in the subject.

## Scoped authorization

Rights administration uses `CapabilityRegistry420` through `RightsAuthorization420`.

Capabilities are scoped separately to:

- a specific subject for subject registration/metadata actions; or
- a specific right for claim, succession and licensing actions.

Rights capabilities remain default-deny and action-scoped. Authority to update one subject or license one right does not grant ambient authority over unrelated rights records.

Expired or revoked capabilities fail closed because authorization is evaluated against the live CapabilityRegistry state.

## Claims are canonical records, not court judgments

A rights claim binds:

- an existing subject;
- an active right class;
- holder;
- jurisdiction commitment;
- evidence commitment;
- validity interval;
- active/superseded state.

Exact semantic claim replay is rejected through the claim fingerprint. Non-identical competing claims may coexist because the protocol intentionally does **not** decide which party wins an external legal dispute merely because one transaction arrived first.

A claim becomes effective only when it exists, remains active and the current time lies within its validity interval.

## Supersession

Claims are not silently edited when their substantive meaning changes.

A new claim can explicitly supersede an active claim only when both records concern the same subject and right class and the action is authorized by the current holder or an exact-right capability. The old claim becomes inactive and records `supersededBy`.

This preserves an auditable history instead of mutating an earlier rights assertion into a different one.

## Holder succession and transfer

An active right can move to a successor holder when:

1. the actor is the current holder or has a live exact-right transfer capability;
2. the new holder is nonzero and different from the current holder;
3. a nonzero succession-evidence commitment is supplied.

The holder changes in the canonical claim and the prior evidence chain is extended with the succession evidence and old/new holder identities.

Holder succession does not erase historical provenance or recreate the right under an unrelated identifier.

## Licenses

A license binds:

- right ID;
- licensee;
- scope commitment;
- terms commitment;
- validity interval;
- revocability.

The license ID is a domain-separated deterministic hash of those semantics. Callers cannot choose arbitrary license IDs or replay an identical license under a second identifier.

A new license requires the underlying right to be effective. It cannot begin before the right begins and cannot outlive a finite underlying right.

The canonical licensor recorded at creation is the current right holder.

## Succession and existing licenses

Holder succession does not automatically destroy licenses that were validly issued before the transfer.

An existing license remains effective while:

- the underlying right remains effective;
- its own validity interval remains active;
- it has not been revoked or renounced.

A successor holder may administer inherited **revocable** licenses. The former holder loses direct authority to issue new licenses once the right has transferred.

This separates continuity of granted permissions from authority to create future permissions.

## Revocation and renunciation

Only licenses created as revocable can be revoked administratively. Revocation may be performed by the recorded licensor, the current right holder or a live exact-right revocation capability.

The licensee may independently renounce its license.

Both transitions terminalize license effectiveness without rewriting the original license terms.

## Consumer checks

`RightsRouter420` exposes narrow consumer reads:

- whether a right is currently effective;
- whether a specific license currently authorizes a specific actor for the exact `scopeHash`.

Applications should consume these bounded checks rather than inferring rights from marketplace listings, indexer projections, metadata text or a historical event alone.

420 Market may list/reference canonical license IDs, but it cannot create or mutate Rights state.

## 420Verify boundary

420Verify is different from the Rights contracts. It is a Genesis user application and discoverable service (`420/service/verify/v1`) with **no Verify-specific canonical state contract**.

Its narrow question is:

> do these published source/build inputs reproduce the bytecode deployed at this address on this chain?

The canonical deployed-code source is chain state. Verification databases, hosted source bundles and result caches are derived/reproducible service data.

## Verification result classes

420Verify preserves four explicit result classes:

- `FULL_MATCH`;
- `PARTIAL_MATCH`;
- `MISMATCH`;
- `UNVERIFIABLE`.

A service must preserve the mismatch/unverifiable reason rather than collapse all outcomes into a misleading binary badge.

## Verification evidence

A verification result is bound to at least:

- chain ID;
- contract address;
- deployed runtime code hash;
- source-bundle commitment;
- compiler version;
- optimizer configuration/runs;
- EVM version;
- via-IR setting;
- metadata-hash mode;
- linked libraries;
- constructor arguments or an explicit unknown marker;
- immutable handling;
- creation bytecode when recoverable.

The preferred source submission is Solidity Standard JSON Input with the complete multi-file bundle. Flattened source is compatibility input only because it can discard build context.

## What FULL_MATCH does and does not mean

`FULL_MATCH` means the recorded build inputs reproduce the deployed runtime bytecode under the verification rules.

It does **not** mean the contract is:

- audited;
- safe;
- bug-free;
- official;
- immutable;
- non-malicious;
- legally compliant;
- authorized by a rights holder;
- licensed for a particular use;
- authorized to receive wallet capabilities.

Registry legitimacy remains with 420Registry. Wallet authorization remains with 420Wallet/Smart Accounts. Rights authority remains with 420 Rights.

## Proxies and upgrades

Proxy shell and implementation are separate verification subjects.

Verifying the proxy does not verify its implementation. Verifying an implementation does not prove that the proxy's admin or upgrade path is safe. When the implementation changes, the replacement code requires independent verification; a prior implementation result cannot be inherited by different bytecode.

## Rights ↔ Verify integration

The two systems can compose safely when verification evidence is treated as **supporting technical provenance**, not rights authority.

For example, a software/model subject may commit a provenance record that references:

- a contract address/code hash;
- a source-bundle hash;
- a 420Verify result/evidence hash;
- an independent reproducible-build result.

That can help demonstrate what software artifact a subject refers to. It still does not answer who legally owns copyright, whether a trademark is valid, whether a patent applies, whether a license exists, or whether a particular use is lawful.

Similarly, 420Verify must never infer that a contract is authorized merely because a Rights record references it. Verification checks reproducibility; Rights state controls claims/licenses.

## External attestations and evidence

Rights claims deliberately use evidence commitments rather than embedding arbitrary legal evidence on-chain. A jurisdiction/evidence hash can commit to documents, signatures, certificates, external attestations or case records stored elsewhere.

Those external artifacts remain evidence inputs. Their existence does not bypass claim authorization, claim supersession, holder succession or license rules.

When an application needs an external dispute outcome, it should consume the designated arbitration/oracle/legal process specified by that application rather than asking 420Verify to act as a general attestation authority.

## Reorg and finality behavior

Before finality, a newly registered subject, claim, succession or license may be removed by a chain reorganization. Consumers that expose irreversible legal/economic effects should use the finality level required by their own policy.

420Verify results also depend on the canonical deployed code at the referenced chain/address. If a pre-finality deployment disappears or a proxy implementation changes, derived verification presentation must reconcile with canonical chain state rather than preserving stale status as current truth.

## Failure behavior

### Conflicting rights claims

Preserve both non-identical claims and their evidence. Do not let an indexer/UI choose a legal winner. Use the applicable external/adjudication process.

### Expired/superseded right

`isEffective` fails. Dependent licenses therefore cease to be effective even if their own nominal end time is later.

### Holder succession

Use the new holder for future administration while preserving valid existing licenses and historical evidence.

### Verification service outage

Contract interaction and Rights state remain available. Verification is intentionally replaceable; another service or local reproducible build may independently derive the result.

### Verification mismatch

Preserve `MISMATCH`/`PARTIAL_MATCH`/`UNVERIFIABLE` with diagnostic provenance. Do not relabel a failure to satisfy UI expectations.

### Proxy upgrade

Invalidate inherited implementation-verification presentation and verify the new implementation independently.

## Rights and Verify invariants

- **RIGHTS-001** — subject registration/provenance is canonical protocol state, but registration alone is not a legal judgment of ownership.
- **RIGHTS-002** — only active governed right classes may receive new claims.
- **RIGHTS-003** — exact semantic claim replay is rejected; distinct competing claims may coexist.
- **RIGHTS-004** — substantive claim replacement occurs through explicit supersession rather than mutation of historical claim identity.
- **RIGHTS-005** — holder succession requires current-holder or exact-right capability authority plus committed succession evidence.
- **RIGHTS-006** — delegated rights administration remains subject/right/action scoped and fails closed after capability expiry/revocation.
- **RIGHTS-007** — license identity is deterministic and domain-separated over the right, licensee, scope, terms, validity and revocability.
- **RIGHTS-008** — a license cannot begin before or outlive its underlying finite right and cannot remain effective when the right is ineffective.
- **RIGHTS-009** — existing licenses survive holder succession unless independently expired, renounced, revoked or invalidated by the underlying right.
- **RIGHTS-010** — market/indexer/UI surfaces may reference Rights state but cannot manufacture or mutate it.
- **VER-001** — 420Verify owns no canonical protocol state; canonical deployed bytecode comes from the chain.
- **VER-002** — verification results are bound to chain ID, address and deployed code hash and cannot be reused silently for different code/network context.
- **VER-003** — `FULL_MATCH` means reproducible source/build correspondence only; it never implies audit, safety, official status, rights ownership or wallet authorization.
- **VER-004** — compiler/build inputs and mismatch reasons remain explicit enough for independent reproduction.
- **VER-005** — proxy shells and implementations are verified separately, and upgrades require independent verification of new code.
- **VER-006** — hosted verification databases are non-canonical and replaceable; independent verifiers may reproduce the same result.
- **VER-007** — Rights evidence may reference verification output, but verification can never create/supersede/transfer a right or grant/revoke a license.
- **VER-008** — Rights state can identify an authorized claim/license but cannot transform a source mismatch into verified deployed code.

## Related documentation

- [Protocol integration model](protocol-integration-model.md)
- [Registry, Names, Identity and 420-IS](registry-names-identity-420is.md)
- [Pay, Token, Swap/Exchange and Bridge](pay-token-exchange-bridge.md)
- [Trust-boundary model](../trust-boundary-model.md)
- `contracts/config/420rights-genesis.json`
- `contracts/config/420verify-genesis.json`
- `docs/420VERIFY.md`
