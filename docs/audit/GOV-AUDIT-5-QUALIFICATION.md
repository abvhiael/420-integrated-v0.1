# GOV-AUDIT-5 — qualification evidence

## Step identity

- Step: **GOV-AUDIT-5 — 420 Wallet Governance user application**
- Qualification model: **Level 1 complete**
- Implementation SHA: `2ea64dded4b2ea600adcc8989b6efbfc872a2ae1`
- Audit branch: `audit/420governance-complete-20261001`
- PR: #449
- PR base SHA: `01dc4d3a7c272e5e0e70261d3a5f7a26afd04872`
- Current `main` observed at closeout: `cdd5f58f20a3673bb9a81c6210be2a3019e22380`
- PR mergeability at closeout: **mergeable**

This evidence file and the roadmap status update are documentation-only. They do not change executable source, tests, workflows, dependencies, configuration, interfaces, artifacts or deployment state. The implementation SHA above remains the exact Level 1 qualification target.

## Purpose satisfied

The frozen 420 Governance classification as both a Genesis protocol and a user application now has a Wallet-integrated Governance surface.

The Wallet remains a presentation/submission client. It does not become proposal, voting-outcome, queue, execution or cancellation authority.

## Implementation summary

Implemented:

- `wallet/web/core/governance-management.js`
- `wallet/web/governance-management-ui.js`
- `wallet/web/test/governance-management.test.js`
- `wallet/web/test/governance-management-ui.test.js`
- `wallet/web/scripts/check-governance.mjs`
- `.github/workflows/governance-wallet-audit.yml`
- Wallet shell/navigation integration in `wallet/web/index.html`
- responsive Governance styles in `wallet/web/styles.css`

## Canonical discovery and authority boundary

Wallet Governance does not embed Civic contract addresses or Civic component IDs.

Runtime discovery must provide:

- source = `protocol-registry`;
- canonical Governance service ID `420/service/governance/v1`;
- deployed ProtocolRegistry address;
- runtime-provided component IDs for:
  - CivicConstitution420;
  - CivicProposalRegistry420;
  - CivicElectorateRegistry420;
  - CivicVoting420;
  - CivicGovernor420;
- resolved module addresses.

Before allowing Governance interaction, Wallet:

1. verifies the connected chain ID;
2. verifies the connected account remains authorized;
3. verifies deployed ProtocolRegistry code;
4. verifies ProtocolRegistry contract identity and protocol version;
5. resolves every runtime-supplied Civic component ID through `ProtocolRegistry.resolve(bytes32)`;
6. requires the resolved addresses to match the supplied Civic module graph exactly;
7. verifies deployed code for every Civic module;
8. verifies each Civic module `systemName()` and protocol version;
9. verifies Governor and Voting cross-module bindings.

The actual canonical Civic component IDs remain intentionally undefined by GOV-AUDIT-5 and belong to GOV-AUDIT-6. Wallet therefore consumes canonical discovery without inventing future Registry IDs.

## Requirement-by-requirement completion

1. **Proposal list and proposal detail** — proposal IDs are enumerated through non-authoritative 420Indexer `CivicProposalRegistered` history, then every proposal is re-read from canonical chain state. Stale/reorged Indexer IDs are omitted if canonical chain lookup fails.
2. **Proposal class and frozen constitutional revision** — proposal class is decoded from Proposal Registry; the frozen revision is read from `CivicGovernor420.frozenRule`.
3. **Voting window and current state** — snapshot/vote-start/vote-end/state are read from `CivicProposalRegistry420.proposals`.
4. **Frozen community/validator electorate information** — read from `CivicElectorateRegistry420.proposalSnapshot`, including source, source type, root, total weight, source revision and required-house state.
5. **Quorum/approval thresholds and live non-authoritative tallies** — frozen thresholds are read from Governor; tallies are read from CivicVoting and explicitly labelled non-authoritative convenience state.
6. **Exact committed actions hash** — shown from canonical proposal state.
7. **Decoded action-batch review where ABI metadata permits** — candidate batches are hashed through canonical `CivicGovernor420.hashActions`; per-action metadata is decoded only when qualified ABI metadata is supplied.
8. **Fail-closed action review** — action-batch commitment mismatch blocks review; missing ABI metadata produces an explicit undecoded warning rather than invented semantics.
9. **FOR / AGAINST / ABSTAIN vote submission** — all three Civic support values are exposed.
10. **Required-house awareness** — Community and Validator house state is surfaced; Validator voting is blocked when the frozen proposal does not require that house.
11. **Connected-account eligibility/weight preflight** — Wallet checks prior ballot state and resolves voting weight from the frozen electorate source through `CivicElectorateRegistry420.votingWeight`.
12. **Chain ID and deployed-code validation** — chain, ProtocolRegistry code and every Civic module are checked before mutation.
13. **Canonical Governance/Civic discovery** — component IDs are runtime inputs and every ID is verified on-chain through ProtocolRegistry resolution; no Civic address or component ID is invented in Wallet source.
14. **Transaction simulation/gas estimation** — every vote is `eth_call` simulated and gas-estimated before submission.
15. **Submitted/confirmed/failed/replaced transaction state** — explicit transaction lifecycle states are implemented; replacement tracking is supported through an optional replacement resolver.
16. **Account/network-change invalidation** — EIP-1193 `accountsChanged` and `chainChanged` invalidate the Governance context and require reconnect/reload.
17. **Safe retry semantics** — no automatic vote resubmission; every explicit retry re-runs full chain/account/proposal/eligibility preflight and an already-cast ballot blocks retry.
18. **Loading, empty and error states** — proposal loading/empty state, blocked-action state, transaction state and explicit recovery messaging are present.
19. **Accessibility basics** — labelled regions/controls, `role=status`, `role=alert`, polite/assertive live regions, vote group labelling and focus recovery are present.
20. **Responsive behavior** — Governance context, proposal/detail grids and detail rows collapse under existing Wallet mobile breakpoints.
21. **No manufactured authority** — proposal creation, queue and execution controls are intentionally absent from the ordinary Wallet Governance UI.

## Security and failure-path qualification

Named coverage includes:

- non-Registry discovery rejection;
- ProtocolRegistry-resolved Civic address mismatch rejection;
- ProtocolRegistry missing/zero Civic component rejection;
- wrong-chain rejection;
- missing deployed code rejection;
- account drift rejection;
- duplicate/malformed discovery graph rejection;
- ProtocolRegistry component-resolution verification;
- frozen proposal/rule/electorate/tally decoding;
- stale/reorged Indexer proposal omission;
- non-authoritative Indexer enumeration;
- already-cast ballot rejection;
- electorate weight preflight;
- exact action commitment validation;
- explicit undecodable-action warning;
- FOR/AGAINST/ABSTAIN submission;
- inactive/out-of-window voting rejection;
- network change during vote preflight;
- safe retry after an already-cast ballot;
- confirmed/failed/pending/replaced transaction states;
- UI account/network invalidation;
- prohibition on ordinary Wallet create/queue/execute controls.

## Exact-head Level 1 qualification

Exact implementation SHA:

`2ea64dded4b2ea600adcc8989b6efbfc872a2ae1`

### Dedicated GOV-AUDIT-5 workflow

Workflow: **420Governance Wallet GOV-AUDIT-5**

- exact-head run **#9**
- run ID `36928579854`
- job ID `110591915321`
- result: **SUCCESS**

Passed:

- exact-head SHA verification;
- Governance Wallet static contract;
- Governance Wallet unit/integration tests;
- retained Wallet Web static qualification;
- complete Wallet Web test inventory.

### Retained Wallet Web qualification

The exact-head GOV-AUDIT-5 workflow itself reran the retained Wallet Web static qualification and complete Wallet Web test inventory on `2ea64dded4b2ea600adcc8989b6efbfc872a2ae1`; both passed in run `36928579854` / job `110591915321`.

The generic **420 Wallet Web Verification** pull-request job is intentionally skipped on `audit/*` branches by its job-level policy. The last independent push qualification before this test-only hardening was run `36927074075` / job `110586924615`, result **SUCCESS**. The follow-up commit changes only Governance test coverage, not Wallet executable/configuration/deployment surfaces, and the dedicated exact-head workflow re-executed the complete Wallet Web test inventory after that change.

## Diagnosed intermediate failure

An earlier GOV-AUDIT-5 run failed because the Indexer test mock passed a property named `fetch` instead of the client constructor's `fetchImpl` injection point. Node therefore attempted a real network fetch. The mock was corrected; no production behavior or assertion was weakened.

## Current-main relationship

At qualification time, current `main` was `cdd5f58f20a3673bb9a81c6210be2a3019e22380`.

A base-to-main review found no overlapping changes in the Wallet Web, Governance contract or Governance Indexer surfaces affected by GOV-AUDIT-5. Full current-main reconciliation therefore remains intentionally deferred to Level 3 rather than repeated ceremonially at this ordinary step.

## Level 2 status

**NOT SEPARATELY REQUIRED FOR THIS STEP.**

The step introduced a Wallet client/UI surface but did not change shared protocol authority or contract semantics. The final follow-up commit is test-only and adds explicit mismatch/zero-resolution coverage for ProtocolRegistry discovery. The dedicated GOV-AUDIT-5 workflow already ran the complete Wallet Web test inventory in addition to its focused Governance tests.

## Level 3 status

**DEFERRED BY POLICY.**

Full current-main reconciliation, canonical repository Solidity inventory, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation and final app-phase merge-candidate qualification remain reserved for Governance phase closeout.

## Limitations and deferred live dependencies

- GOV-AUDIT-5 does not define Civic Registry component IDs or deployed Civic addresses; that is explicitly GOV-AUDIT-6 scope.
- The checked-in generic Wallet runtime configuration therefore does not activate live Governance discovery yet.
- Production-equivalent live Wallet proposal/vote evidence remains GOV-AUDIT-9 scope.
- These deferred deployment/live items do not block the repository/user-application implementation and Level 1 exit criterion for GOV-AUDIT-5.

## Exit criterion

**SATISFIED.**

The Wallet can inspect and vote on canonical Governance state through the qualified Governance client/UI without trusting Wallet or Indexer as governance authority. Runtime activation requires the later canonical deployment/discovery inputs rather than invented placeholders.

## Completion

**GOV-AUDIT-5 — COMPLETE.**

Next canonical roadmap step:

**GOV-AUDIT-6 — deployment, artifacts, discovery and initialization.**
