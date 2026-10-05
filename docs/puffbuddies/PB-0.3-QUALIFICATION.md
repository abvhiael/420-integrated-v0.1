# PB-0.3 qualification evidence

## Step

**PB-0.3 — Blockchain/off-chain boundary**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.3 defines which PuffBuddies state may use public-chain authority and which state must remain private/off-chain, encrypted, or represented only through minimum-disclosure attestations/commitments.

## Implementation summary

PB-0.3 adds:

- four canonical trust zones: public-chain authority, private application state, encrypted communication state, and minimum-disclosure attestations/commitments;
- PB-BOUNDARY-001 through PB-BOUNDARY-018;
- a canonical state classification matrix;
- explicit prohibitions on public likes, passes, match graphs, blocks, reports, precise location, preferences, profile/media state, and private messages;
- wallet/profile separation requirements;
- leakage prohibitions covering events, calldata, hashes, payment metadata, Indexer, Explorer, Search, and analytics;
- explicit recognition that off-chain state still requires strong authentication, authorization, encryption, and integrity controls.

No contract, service ID, fixed address, deployment, storage implementation, messenger integration, Indexer/Search integration, or live infrastructure is introduced by this step.

## Files changed

- `docs/puffbuddies/PB-0.3-BLOCKCHAIN-OFFCHAIN-BOUNDARY.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `scripts/verify-puffbuddies-pb0.py`
- `docs/puffbuddies/PB-0.3-QUALIFICATION.md`

## Requirements satisfied

Pending exact-head qualification.

## Implementation SHA

**PENDING EXACT-HEAD QUALIFICATION**

## Base/main SHA

`b338b9c9c140957b0ea8619b0b20bfed415f2c6d`

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Pending exact-head run.

## Security/adversarial/invariant scope

The cumulative verifier must reject:

- missing or duplicate PB-BOUNDARY identifiers;
- public-chain classification of likes, passes, matches, blocks, reports, precise location, preferences, profile/media content, or messages;
- invented fixed addresses or PuffBuddies service IDs;
- claims that hashing alone makes sensitive state public-chain safe;
- public wallet-to-profile enumeration;
- public side-channel leakage through events, calldata, payment metadata, Search/Explorer/Indexer/analytics;
- claims of runtime implementation or live integration.

## Milestone status

PB-0.3 is not a Level 2 integration milestone. It defines authority/data placement rules but introduces no shared runtime dependency or executable component.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.3.

Level 3 repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global reconciliation, clients/services, Indexer/Search/RPC, deployment/config, and final security qualification remain deferred to app-phase closeout.

## Limitations

PB-0.3 classifies data visibility/persistence and permissible public authority. It does not yet define:

- the exact privacy architecture;
- exact storage/database topology;
- exact eligibility attestation format;
- exact account unlinkability mechanism;
- exact Messenger authorization;
- exact payment/entitlement schema;
- exact Indexer/Search/Explorer integration;
- exact deletion/retention behavior;
- exact threat mitigations.

Those remain owned by PB-0.4 and later canonical steps.

## Blockers

Exact-head Level 1 qualification must pass before PB-0.3 is formally COMPLETE.

## Completion state

**PB-0.3 — PENDING QUALIFICATION**

## Next canonical roadmap step

**PB-0.4 — Privacy invariants**
