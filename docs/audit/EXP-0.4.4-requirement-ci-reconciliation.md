# EXP-0.4.4 — mandatory requirement-to-CI coverage reconciliation

**Status:** implementation complete; exact-head qualification required.

## Objective

EXP-0.4.4 maps every authoritative mandatory 420Explorer Genesis requirement to the qualification machinery that currently covers it and to the later evidence still required before Genesis closeout.

The matrix covers **all 60 mandatory requirements**.

## Current automated coverage

Every mandatory requirement is protected by the retained authoritative requirement, qualification-status and bidirectional-traceability verifiers.

Those gates are deliberately classified as **model-consistency coverage**. They prove that the requirement remains present, correctly classified, status-disciplined and traceable. They do not by themselves prove functional runtime behavior.

The ten mandatory required views additionally retain concrete functional test files through the EXP-0.3.3 acceptance-test mapping.

Current distribution:

- 60/60 have current automated model/traceability gates.
- 10/60 have explicitly mapped current functional test files.
- 50/60 rely on source/configuration/model evidence plus named later qualification procedures rather than pretending a direct functional test exists.
- 60/60 have explicit future qualification procedures.
- 0 mandatory requirements are orphaned.

## Future evidence ownership

The matrix normalizes later evidence ownership as:

- **EXP-1** — blockchain data integrity/runtime evidence;
- **EXP-2** — Explorer service/API runtime evidence;
- **EXP-3** — contract/Registry runtime evidence;
- **EXP-4** — deployed UI/workflow evidence;
- **EXP-5** — ecosystem integration evidence;
- **EXP-6** — security, operations and recovery evidence;
- **EXP-7** — deployment/live-network evidence;
- **EXP-8** — exact-release-candidate Genesis closeout.

Each requirement's `missing_evidence_layers` is derived from its authoritative later-owner set. No missing layer is treated as waived.

## Qualification discipline

A requirement that has a passing audit verifier is not automatically functionally qualified. A requirement with passing repository functional tests is not automatically runtime-qualified. Runtime evidence does not automatically establish deployment or live-network state. Final Genesis qualification remains an EXP-8 release-candidate decision after all applicable evidence layers are closed.

## Scope boundary

EXP-0.4.4 qualifies coverage accounting and orphan prevention. It does not implement missing fee/event/validator functionality, deploy services, execute the live-testnet validator, or close any of the ten current Genesis blockers.


## Cross-cutting procedure ownership reconciliation

The first exact-head verifier identified eight requirements where an acceptance-criterion verification procedure names a supporting owner that is not present in that requirement's direct `later_qualification_owners` list.

The coverage model now preserves three distinct fields:

- `authoritative_later_owners` — the direct owner set from EXP-0.3.1;
- `procedure_owners` — owners of concrete procedures inherited from EXP-0.3.7 / the acceptance map;
- `future_qualification_owners` — the union used for coverage accounting.

This does not rewrite the authoritative requirement inventory. It records cross-cutting supporting ownership without dropping valid later procedures or inventing direct ownership.
