---
title: DOC-10 generated reference coverage audit
audience:
  - developer
  - operator
  - architect
category: reference
status: current
version: current
---

# DOC-10 generated reference coverage audit

DOC-10.10 audits the generated-reference system built in DOC-10.1 through DOC-10.9 before the monolithic phase merge.

## Audit result

**PASS, pending final exact-head qualification and monolithic PR merge.**

The generated reference now has one source registry, deterministic renderers, a unified stale-output gate, explicit provenance/environment boundaries, and navigation handoffs from the task-oriented DOC-8/DOC-9 documentation.

## Coverage matrix

| Phase | Generated/reference outcome | Result |
| --- | --- | --- |
| DOC-10.1 | source registry, generation model, source inventory, deterministic entry point, generated source manifest | PASS |
| DOC-10.2 | contract/NatSpec/public-external surface plus verified-ABI fail-closed status | PASS |
| DOC-10.3 | event/custom-error indexes, canonical signatures, indexed positions, Keccak topics/selectors | PASS |
| DOC-10.4 | public 420RPC compatibility/request-policy surface with private/admin/signer exclusions | PASS |
| DOC-10.5 | stable 420Indexer routes, envelopes, paging, readiness/status and non-authoritative boundary | PASS |
| DOC-10.6 | `@420/sdk` exports, Wallet/Smart Account boundaries and primary `420` CLI command contract | PASS |
| DOC-10.7 | environment-scoped network/chain discovery; local-only publication; absent environments fail closed | PASS |
| DOC-10.8 | canonical deployment publication contract; example/planned/unconfirmed evidence withheld | PASS |
| DOC-10.9 | unified byte-for-byte stale/missing-output qualification with deterministic SHA-256 output identities | PASS |
| DOC-10.10 | family/provenance/environment/navigation audit and closeout | PASS |

## Generated output inventory

The unified freshness gate covers these eight committed outputs:

1. `docs/reference/generated/source-manifest.md`
2. `docs/reference/generated/contracts.md`
3. `docs/reference/generated/events-errors.md`
4. `docs/reference/generated/rpc.md`
5. `docs/reference/generated/indexer-api.md`
6. `docs/reference/generated/sdk-cli.md`
7. `docs/reference/generated/networks.md`
8. `docs/reference/generated/deployments.md`

CI recomputes the expected content from implementation/reference sources and fails if any output is missing or differs byte-for-byte. The check also emits deterministic SHA-256 identities for every expected output.

## Provenance and authority audit

### Generated content is descriptive

Generated pages never supersede chain state, owning protocol contracts, approved Registry/governance state, qualified deployment evidence, Wallet authorization, consensus/finality or provider-specific evidence. When generated output disagrees with the owning authority, the owning authority wins and the reference must be regenerated/fixed at source.

### Contracts and ABI

The only checked-in catalogue is `developer-hub/catalogue/local.example.json`. Its example address and `verified: true` flag are insufficient to publish a distributable ABI because the declared artifact/interface are absent and the ABI SHA-256 is placeholder-grade. Contract/ABI publication therefore fails closed.

### Events and errors

Topics/selectors are derived only from source signatures that can be normalized unambiguously. User-defined or ambiguous types are unresolved instead of guessed. Ethereum Keccak-256 is self-tested before publication.

### RPC

Only the explicit public compatibility surface is generated. Engine/admin/personal/debug/miner/txpool and node-managed account/signing methods remain excluded from public reference.

### Indexer

420Indexer remains a derived, rebuildable read model with `authoritative: false`. Security-sensitive state and finality decisions must be rechecked against canonical chain/owning protocol state.

### SDK and CLI

SDK/CLI reference preserves chain/catalogue binding, Wallet/provider delegation and signer-secret isolation. Convenience tooling does not acquire consensus, Registry, Wallet, governance, settlement or finality authority.

### Network identity

Only the checked-in local example manifest is published. Devnet, testnet and mainnet are reported unavailable rather than inferred from chain ID `420`, localhost endpoints or another environment.

### Deployments

No canonical deployment rows are currently publishable. Plans set `canonicalDeploymentProof: false`; recorded receipts still require canonical RPC confirmation; 420Verify is reproducibility evidence rather than audit/registration/protocol authority; checked-in release/catalogue/deployment records are example-scoped.

## DOC-8 and DOC-9 handoff audit

DOC-8 remains application/task oriented and does not hand-maintain ABI/RPC/API/generated deployment material. Its coverage audit now links to the DOC-10 generated-reference landing page.

DOC-9 remains cross-ecosystem task-oriented developer guidance. Its developer landing page links directly to the generated contract/ABI, event/error, RPC, Indexer API, SDK/CLI, network and deployment references rather than duplicating them.

This keeps the intended split intact:

- DOC-8/DOC-9 explain **what to do, in what order, and which authority owns the action**;
- DOC-10 supplies **machine-derived exact reference** for the implementation surface.

## Deliberate exclusions

DOC-10 does not attempt to solve later roadmap phases:

- DOC-11 owns the searchable ecosystem-wide troubleshooting/error registry;
- DOC-12 owns broader documentation CI such as broken links, front matter, duplicate IDs, orphan pages and required-doc checks;
- DOC-13 owns documentation versioning policy;
- DOC-14 owns contextual in-app deep links;
- DOC-15 owns Ask 420 documentation-assistant behavior;
- DOC-16 owns the final Genesis documentation matrix audit;
- DOC-17 owns production publication/integration closeout.

## Phase exit condition

DOC-10 satisfies its functional exit condition when this audit is merged: developers can navigate from DOC-8/DOC-9 task guidance into deterministic machine-derived reference for contracts/NatSpec/ABI status, events/errors, public RPC, 420Indexer APIs, SDK/CLI, network identity and canonical deployment status; generated output is reproducible, environment/provenance scoped, and fails closed on missing/ambiguous/unverified inputs.

The phase may merge only after the branch is reconciled with current `main`, `420Docs Qualification` succeeds on the exact final head, `420 Integrated Qualification` succeeds on that same head, and PR #229 still points to that qualified head at merge time.
