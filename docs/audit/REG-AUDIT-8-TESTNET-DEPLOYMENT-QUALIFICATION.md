# REG-AUDIT-8 — production-equivalent testnet deployment

## Canonical definition

Deploy the reconciled Registry candidate and record chain ID/environment, exact source/release SHA, final Registry address, deployment/predeploy proof, runtime code hash, initialized governance authority, smoke reads and strict publication, deprecation/history behavior, and recovery/restart observations for derived consumers.

**Exit:** testnet evidence is immutable and reproducible.

## Repository gap analysis

The reconciled Registry candidate is repository-qualified through REG-AUDIT-7, but the official testnet is not provisioned. `testnet/services/endpoints.json` contains placeholder URLs; `testnet/infrastructure/inventory.json` is `PLANNED` with every required node/service `UNPROVISIONED`; and no official `developer-hub/manifests/testnet.json` exists.

Existing Explorer production-equivalent deployment/recovery evidence independently records the same external blockers. Repository CI cannot manufacture those live witnesses.

## Repository-controlled implementation

REG-AUDIT-8 now includes:

- an immutable live-evidence template;
- an operator runbook that keeps governance credentials outside repository automation;
- a live verifier checking exact release SHA, chain ID, genesis predeploy proof, runtime code hash, governance read, smoke/history reads, strict-publication and deprecation receipts/events, derived-consumer authority boundaries and recovery evidence;
- an exact-release live workflow;
- a repository-readiness verifier/workflow that explicitly cannot claim live completion.

Expected Registry identity remains `0x0434`, governance `0x0429`, source blob `9ab3d53a68b6533978f41e0202e5268f1d615c19`, runtime code hash `0x9f9e5f794296cf9faf5f8c8d17cd815f3c19c004a158c15cb61b5a29eaacb330`, and the empty genesis storage root qualified by REG-AUDIT-5.

## Status

**NOT YET COMPLETE — external production-equivalent testnet infrastructure and live evidence remain blocking.**

REG-AUDIT-9 must not begin until REG-AUDIT-8 live qualification succeeds and immutable live evidence is committed.
