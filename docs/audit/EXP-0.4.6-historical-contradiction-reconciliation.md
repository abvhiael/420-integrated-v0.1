# EXP-0.4.6 — historical contradiction and stale-evidence reconciliation

**Status:** qualified at repository scope; final evidence-recording head requalification required.

## Purpose

EXP-0.4.6 prevents old but retained Explorer records from silently overriding the current EXP-0.3/0.4 authority model. Historical files remain in the repository for auditability; each potentially misleading claim receives an explicit current disposition.

## Disposition model

- **superseded_by** — a later explicit authority changed the current meaning.
- **historical_only** — valid only as historical/presentation/future guidance, not current qualification evidence.
- **still_applicable** — still correct when read within its recorded narrow scope.
- **requires_requalification** — a mechanism or environment-bound claim must be executed again on the applicable exact head/environment before it can support current qualification.

## Key reconciliations

The retained EXP-0.3.5 sentence saying governance remains `scope_decision_required/genesis-blocking` is preserved but superseded by EXP-0.3.8 Resolution B. Governance is no longer an active Explorer Genesis blocker.

The broad UI sentence “Qualified, read-only visibility…” remains presentation copy only. It cannot override the status freeze, blocker register, or AC evidence ledger.

`QUALIFIED_INDEXER_API_CONSUMER` remains valid only for the Explorer→Indexer source/consumer boundary. It does not prove either service is deployed or live-qualified.

The Indexer and Explorer readiness files still contain `REPLACE` URLs/pending deployment state. Those placeholders are current negative evidence, not stale data to be ignored.

The smoke/live validators remain useful test mechanisms, but their ability to emit `QUALIFIED` does not establish a current approved live run.

The frozen system-address maps remain authoritative: ProtocolRegistry is `0x...0434`, ConsensusSystemCall420 is `0x...043c`, and historical candidate aliases may not override them.

## Current state preserved

This reconciliation intentionally keeps:

- 10 current Genesis blockers;
- 10 unverified acceptance criteria;
- 0 runtime-qualified events;
- 0 deployment-qualified events;
- 0 live-network-qualified events;
- 0 Genesis-qualified events.

EXP-0.4.6 qualifies evidence interpretation only; it does not remediate those later-stage gaps.


## Exact-head implementation qualification

Qualified implementation head: `e82501616062ff08c2789ec24518f5433bbd99c4`

- 420Indexer #631 — run `36285249197` — success.
- 420Docs Qualification #2961 — run `36285249160` — success.
- 420 Integrated Qualification #5578 — run `36285249040` — success.
- EXP-0.4.6 artifact `10919822778`.
- Digest `sha256:cb01481456cb587ddfce280c2cd8ef2ff231cbb5e693851f1158e1cad699592c`.

All retained repository gates passed on the implementation head. Because this evidence record changes the branch SHA, the new cumulative head must pass the retained suite once more before EXP-0.4.6 is marked COMPLETE.


## Exact-head implementation qualification

Qualified implementation head: `e82501616062ff08c2789ec24518f5433bbd99c4`

- 420Indexer #631 — run `36285249197`, job `108524668014` — success.
- 420Docs Qualification #2961 — run `36285249160`, job `108524701360` — success.
- 420 Integrated Qualification #5578 — run `36285249040` — success.
  - geth-engine `108524821587` — success.
  - offline-core `108524821663` — success.
  - fault-matrix `108524821684` — success.
  - production-dependencies `108524821688` — success.
- EXP-0.4.6 artifact `10919822778`.
- Digest `sha256:cb01481456cb587ddfce280c2cd8ef2ff231cbb5e693851f1158e1cad699592c`.

This proves the stale-evidence reconciliation at repository scope only. The evidence recording changes the branch SHA, so the resulting head must be requalified before EXP-0.4.6 is marked COMPLETE.


## Branded Explorer UI reconciliation

The bespoke 420 Integrated Explorer removes the historical broad user-facing phrase `Qualified, read-only visibility...`. Current presentation instead identifies the Explorer as read-only network intelligence and explicitly states that it is a non-canonical projection. EXP-CONTRA-003 remains retained as historical evidence; the verifier now fails if the stale broad qualification wording is reintroduced or if the current authority disclaimer disappears.
