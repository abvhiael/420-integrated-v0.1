# BUD-AUDIT-5 — Offline Progression

Status: COMPLETE — Level 1 exact-head qualified

## Authority and scope

This audit step closes the BUD-0 architecture gap for `BUD-ARCH-008` without renumbering or inventing a canonical gameplay phase.

Canonical BUD-0 requires offline progression to be deterministic from stored state plus elapsed time, bounded, and independent of blockchain availability. It permits offline effects only for systems explicitly marked offline-capable.

The currently implemented BUD-1 through BUD-4 simulation contains no staff automation, production, cultivation, delivery, or other subsystem that is canonically marked offline-capable. Those systems therefore remain offline-inert.

This step introduces the reusable domain boundary for future explicitly-authorized offline effects. It does not fabricate future gameplay systems and it does not make UI/client input authoritative for economy state.

## Frozen policy

- Maximum elapsed time processed per offline transition: **24 hours**.
- Time beyond the 24-hour bound is discarded, not banked for repeated collection.
- Clock rollback produces no grant and preserves the last trusted processing cursor.
- Reprocessing the same wall-clock timestamp produces no second grant.
- Offline rewards use whole deterministic intervals only.
- Every source has an explicit remaining cash cap.
- Source identifiers must be unique.
- All timestamps, interval values, rewards, caps, intermediate rewards, and aggregate rewards must remain JavaScript safe integers.
- Disabled sources produce no reward.
- No wallet, blockchain, account, Gaming Protocol, oracle, or network dependency participates in calculation.
- BUD-1 through BUD-4 mechanics are not implicitly offline-capable.
- Inventory, orders, upgrades, customers, and progression state are not mutated by the offline calculator.
- A future persistence/application layer must supply trusted stored source state and apply the returned grant through authoritative domain services.

## Implementation

`src/budtender/OfflineProgression.ts` provides a pure deterministic calculation:

`stored offline cursor + current timestamp + explicit source state -> bounded offline result`

The result includes:

- raw elapsed time;
- effective bounded elapsed time;
- discarded excess elapsed time;
- next processing cursor;
- clock-rollback signal;
- per-source grants;
- aggregate cash grant.

The calculator itself does not credit the store. This is intentional: current BUD-1 through BUD-4 contain no canonical passive-income source, and allowing presentation code to supply arbitrary rates and directly mutate cash would violate the BUD-0 authority boundary.

## Audit invariants

- `BUD-OFF-001`: Equal stored state and elapsed time produce equal results.
- `BUD-OFF-002`: Effective elapsed time never exceeds 24 hours.
- `BUD-OFF-003`: Excess elapsed time cannot be reclaimed by repeated processing at the same timestamp.
- `BUD-OFF-004`: Clock rollback fails closed with zero economic effect.
- `BUD-OFF-005`: Rewards accrue only for complete configured intervals.
- `BUD-OFF-006`: Each source is bounded by an explicit remaining cash cap.
- `BUD-OFF-007`: Duplicate source IDs are rejected.
- `BUD-OFF-008`: Unsafe numeric inputs/intermediates are rejected.
- `BUD-OFF-009`: No source means zero economic mutation.
- `BUD-OFF-010`: The calculation has no wallet/blockchain/network dependency.
- `BUD-OFF-011`: Existing BUD-1 through BUD-4 systems remain offline-inert until a canonical later system explicitly opts in.
- `BUD-OFF-012`: The offline calculator cannot directly mutate store inventory, orders, upgrades, customers, or cash.

## Level 1 qualification

Directly applicable qualification is the Budtender app-specific fast workflow:

- Node 22 strip-only syntax validation for `src/budtender/*.ts` and `test/budtender/*.spec.ts`;
- the complete Budtender TypeScript test suite, including offline progression boundary/adversarial tests.

Shared Gaming SDK and Gaming Protocol behavior is unchanged by this app-only domain addition. Existing workflow jobs may run because the retained Budtender workflow groups them, but no Level 2 or Level 3 claim is made from this step.

## Exit criteria

BUD-AUDIT-5 is COMPLETE only when:

1. the deterministic bounded offline domain service exists;
2. all invariants above are covered by tests;
3. current BUD-1 through BUD-4 systems remain offline-inert;
4. no chain/wallet dependency is introduced;
5. the exact implementation SHA passes the directly applicable Budtender Level 1 qualification (satisfied by `c619c3fecbbb17ae34303209b908e78844d48051`, Budtender Qualification run `37659072145`, core job PASS);
6. durable audit evidence records the implementation SHA, workflow evidence, base SHA, limitations, deferred checks, and next roadmap step (recorded in `docs/audit/BUD-AUDIT-5-EVIDENCE-2026-10-07.md`).

## Known limitation / next dependency

This step does not create durable saves. A future persistence layer must own the trusted offline cursor and source state before offline rewards can be safely exposed in a production client.
