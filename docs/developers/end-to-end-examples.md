---
title: End-to-end developer examples
audience:
  - developer
category: developer
status: development
version: current
---

# End-to-end developer examples

This page closes DOC-9 with complete application workflows that preserve the authority boundaries established throughout the developer documentation. The examples are intentionally task-oriented. Generated ABI, event, error and deployment reference remains owned by DOC-10.

## Example 1 — read, prepare, authorize, submit, confirm

Use this sequence for an ordinary dApp action.

1. Select an explicit network manifest and verify chain identity before initializing the application.
2. Resolve the required canonical service/contract version from the approved catalogue/Registry source.
3. Read security-sensitive state from canonical RPC/owning contracts.
4. Use 420Indexer only for rebuildable projections such as recent activity, search, history and denormalized views.
5. Construct a bounded human-readable intent and calldata without acquiring user signing secrets.
6. Hand the request to 420 Wallet/SmartAccount420 for authorization, simulation and signing.
7. Submit through an approved same-environment RPC path.
8. Record the transaction hash and canonical receipt/block provenance.
9. Wait for the finality level required by the action before treating it as irreversible.
10. Update indexed UX only after reconciling it with canonical state.

If submission outcome is uncertain, query canonical transaction/nonce/state first. Do not blindly generate a second state-changing transaction.

## Example 2 — deploy, verify, register and publish an application

A complete release path keeps deployment, verification, Registry legitimacy and AppStore presentation separate.

### Discover and bind the release

Confirm the selected environment, chain identity, expected Registry/Verify services and release service ID. The release artifact should bind its chain ID, implementation identity/version, runtime-code expectation and source/build provenance.

### Plan deployment

Developer Hub may prepare a deployment plan:

```text
420 deploy plan deploy.json
420 deploy view deploy.json
```

The planner is non-custodial. Execution belongs to the declared external signer or Wallet boundary.

### Confirm deployment

After submission, use canonical RPC to verify:

- the transaction succeeded;
- the expected contract address contains code;
- runtime code matches the declared release evidence;
- proxy/implementation relationships, where used, match the release model;
- the confirmation/finality level satisfies the release policy.

A tool saying "deployed" is not sufficient proof.

### Build verification evidence

Prepare 420Verify evidence:

```text
420 verify plan verify.json
420 verify view verify.json
```

A verification classification describes reproducibility evidence. It does not confer Registry legitimacy, security certification or governance approval.

### Prepare canonical Registry publication

Developer Hub may validate the release handoff:

```text
420 app plan app-release.json
420 app view app-release.json
```

Before governance publication, recheck canonical chain ID, implementation code, runtime-code hash, service-ID legitimacy and expected next Registry version. `publishRegisteredService()` remains governance-authorized; Developer Hub cannot sign or bypass it.

### Project into AppStore

After Registry confirmation, AppStore may present the application for discovery. Catalogue metadata, categories, rankings, screenshots and featured placement remain non-canonical presentation state.

## Example 3 — read-heavy application with finality-safe projections

For explorer/search/dashboard-style applications:

1. establish the canonical chain/network identity;
2. establish Indexer readiness and indexed-head/finalized provenance;
3. consume bounded cursor-paginated Indexer responses for UX;
4. persist opaque cursors/checkpoints rather than inventing offset semantics;
5. tolerate rollback/replay for non-finalized projections;
6. perform canonical RPC/contract rechecks before making security-sensitive decisions;
7. suppress or label stale/degraded projection state instead of upgrading it into chain truth.

Indexer failure should degrade convenience, not alter protocol authority.

## Example 4 — provider-backed storage or AI job

Storage and AI/Compute use different domain objects but share a safe sequence:

1. resolve canonical service/provider/offer/model/resource identities;
2. bind user constraints before execution: spend ceilings, provider/resource constraints, privacy policy, deadline and verification profile;
3. keep raw private payloads off-chain and expose only the commitments/references required by protocol;
4. authorize the bounded request through the owning protocol and Wallet boundary;
5. let the selected provider execute off-chain;
6. collect provider evidence/commitments/receipts;
7. apply the protocol-bound verifier or proof policy;
8. settle only through the canonical Vault/settlement path when eligibility is established;
9. preserve evidence and use the defined refund/dispute/retry path when execution or verification fails.

Provider signatures or result hashes prove only the bound claim/evidence semantics. They are not universal proof of correctness, factual truth or permanent availability.

## Example 5 — verified cross-chain transfer

A Bridge integration must bind exact chain and route identity before accepting a proof.

1. resolve the canonical external `routeChainId` and network fingerprint;
2. resolve the exact bridge asset/local representation;
3. resolve an active route for the intended direction;
4. resolve its approved adapter and verifier configuration;
5. require the source network's configured finality/confirmation condition;
6. verify the foreign-chain proof/message through the approved adapter;
7. recheck local route status, direction, asset eligibility, risk limits and replay state;
8. create/follow the canonical Bridge transfer lifecycle;
9. treat value as completed only after the destination-side canonical completion/finality rule is satisfied.

A valid foreign proof cannot bypass local risk, replay, route or asset policy.

## Example 6 — optional-wallet game integration

A Gaming Protocol-aware game should begin wallet-free.

1. start guest/core gameplay off-chain;
2. optionally offer a conventional registered/cloud-save account;
3. pin the client to its exact registered `gameId`;
4. expose Wallet-linked features separately from core admission;
5. when the player opts in, connect through Wallet/SmartAccount420;
6. create/resolve the canonical wallet-linked game profile;
7. migrate guest/registered state only through a target-account-bound, expiry-aware, single-consumption claim;
8. query entitlements and cross-game attestations by known identifiers and exact scope;
9. require canonical/finalized state for ownership, reward, entitlement, migration and cross-game decisions;
10. downgrade safely to non-wallet play when Wallet/session authority disappears.

Wallet linkage itself must never be treated as an automatic competitive stat advantage.

## Example 7 — release candidate evidence handoff

Developer release evidence and production launch evidence are separate gates.

DEVHUB-18 evaluates the developer/security qualification profile and exact-head CI evidence. The qualification report may be `PASS`, `FAIL` or `BLOCKED`; a PASS is not an audit or production approval.

A valid handoff is bound to one exact candidate commit and requires the required CI workflows to succeed for that same SHA. The evidence must remain free of raw private keys, mnemonics, bearer tokens, API secrets, passwords and signing keys.

DEVHUB-19 then consumes, rather than replaces:

- the DEVHUB-18 qualification report;
- the exact-head CI handoff;
- the repository `release/readiness.json` evidence.

A release candidate is production-ready only when all required launch evidence is explicitly ready. A green documentation/application PR does not override blocked operational launch evidence.

## Authority handoff checklist

At every boundary, answer these questions before proceeding:

- Which exact network is selected?
- Which component is canonical for this state?
- Is this value canonical state, a projection, provider evidence or presentation metadata?
- Which authority signs or authorizes the transition?
- What replay/idempotency rule prevents duplicate action?
- What finality level is required before downstream use?
- What happens if the provider, Indexer, Wallet or RPC path is unavailable?
- What sensitive data must remain off-chain or outside tracked evidence?

If an integration cannot answer those questions, it is not ready to rely on the state transition.

## Related documentation

- [Developer integration model](integration-model.md)
- [Source of truth and finality](source-of-truth.md)
- [Deployment workflow](deployment-workflow.md)
- [Verification and evidence](verification-and-evidence.md)
- [Registry and publishing](registry-and-publishing.md)
- [Wallet and Smart Account integration](wallet-and-smart-accounts.md)
- [Provider-backed integration model](provider-backed-integrations.md)
- [420 Gaming Protocol integration](gaming-protocol-integration.md)
- [Production and security checklist](production-security-checklist.md)
- [DOC-9 coverage audit](coverage-audit.md)
