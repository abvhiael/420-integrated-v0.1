# CMP-1.5.11 — Hostile economic qualification

Status: **IMPLEMENTED. LEVEL 1 + LEVEL 2 QUALIFICATION PENDING.**

## Canonical definition

> Hostile economic qualification

CMP-1.5.11 is the explicit adversarial convergence point for the accumulated ComputeStake phase.

The frozen CMP-1.5 architecture requires executable coverage for solvency, isolation, exit races, slash finality, replay, duplicate withdrawal, duplicate slash, duplicate reward, hostile authorization, reentrancy, and failure atomicity.

This step does not invent a new economic mechanism. It attempts to break the mechanisms already implemented in CMP-1.5.1 through CMP-1.5.10.

## Gap analysis

Before CMP-1.5.11, retained tests already covered most hostile behavior: worker/verifier policy isolation; premature exit and exit-policy revision races; objective-slash and dispute holds; non-final slash rejection; slash/reward replay rejection; wrong subject/policy/beneficiary rejection; Vault rollback; insufficient reward backing rollback; and failed dispute-to-slash hand-off atomicity.

Three phase-level gaps remained insufficiently explicit: duplicate withdrawal after completed terminal withdrawal, stake-path reentrancy through a malicious slash recipient callback, and mixed-path solvency across slash, exit and withdrawal in one collateral Vault.

CMP-1.5.11 adds executable regressions for all three.

## Duplicate withdrawal

A fully withdrawn worker position is called again with the same withdrawal path. The second call must revert, pay no additional native $420, change no Vault accounting field, and leave the terminal position unchanged.

## Reentrant slash recipient

A hostile slash recipient receives native $420 during the collateral distribution callback and immediately attempts to reenter requestExit(positionId). The callback must not mutate stake lifecycle. The outer slash must still complete exactly once with the intended payout and expected remaining collateral.

## Mixed-path solvency

One canonical collateral Vault is exercised through 100 $420 worker collateral under policy A, 50 $420 under policy B, a 25 $420 slash from policy A, and a complete 50 $420 exit/withdrawal from policy B.

Terminal accounting must show 75 $420 live Vault balance, 75 $420 recorded balance, 75 $420 reserved, zero claimable, 75 $420 released historically, policy A backed by exactly 75 $420, and policy B terminal at zero.

## Retained hostile coverage

Retained app tests cover isolation, exit races, slash finality, authorization replay, distribution replay, reward replay, bounded slash reservation, hostile authorization, insufficient backing, and failure atomicity.

## Qualification level

CMP-1.5.11 is a **Level 2 Compute app milestone** because it intentionally converges every economic authority introduced across CMP-1.5.1 through CMP-1.5.10.

Required qualification is affected Compute build, focused hostile-economic tests, the CMP-1.5.11 mechanical verifier, and the retained Compute*.t.sol integration suite.

Repository-wide Level 3 remains deferred to **CMP-1.5.13 — Phase closeout**.

## Exit criteria

CMP-1.5.11 is COMPLETE only when every frozen hostile-economic category has explicit executable evidence; duplicate withdrawal fails without accounting movement; malicious payout reentrancy cannot mutate stake lifecycle; mixed slash/exit/withdraw accounting remains exactly solvent; retained isolation, exit-race, finality, replay, duplicate slash/reward, hostile authorization and failure-atomicity tests remain green; Level 1 passes; retained Compute Level 2 passes on the same exact implementation SHA; and durable evidence records that SHA.

Next canonical step:

**CMP-1.5.12 — Release candidate**
