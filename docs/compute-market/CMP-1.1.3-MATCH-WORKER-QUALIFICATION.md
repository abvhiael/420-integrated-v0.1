# CMP-1.1.3 — accepted match, worker assignment, result provenance

CMP-1.1.3 builds on the EIP-712 signed request and actual payer-attributed, job-isolated native-420 reservation in CMP-1.1.1–1.1.2. This is not a general-purpose escrow, capacity reservation, independent verification, or full CMP-1.3 worker protocol.

## Production-candidate evidence wiring

Configure `ComputeJobSignedRequestAuthority420` as `ComputeJobRegistry420.requestEvidence`, `ComputeJobPayerCustody420` as `fundingEvidence`, `ComputeJobAcceptedMatch420` as `matchEvidence`, and `ComputeJobMatchedWorkerEvidence420` as `workerEvidence`; bind the same registry in the custody, match, and worker authorities. The verifier and settlement endpoints remain fail closed until independently qualified. Neither `ComputeJobRequestAuthority420` (unsigned), `ComputeJobVaultReservationEvidence420` (pooled funding), the old `ComputeJobWorkerEvidence420`, nor test-only permissive fixtures qualify this real-custody integration.

The job owner proposes one match for a funded job, snapshotting the resource's provider, node, revision and registered operator. The selected operator accepts that exact match with job-scoped `ACTION_ACCEPT_MATCH`. The strict worker gateway requires the same accepted resource, operator, job revision and job-scoped `ACTION_EXECUTE_ATTEMPT`, then locks attempt 1. A single authenticated `ACTION_SUBMIT_RECEIPT` operator transaction commits the receipt/output hash to the job, request, manifest, match, acceptance, resource and assignment. This establishes identity and the linkage of the submitted commitment, not GPU hardware attestation, metering, correctness, assured resource capacity or settlement rights.

## Qualification evidence

`ComputeJobAcceptedMatchWorker420.t.sol` tests accepted-match/assignment/receipt mechanics with a TEST-ONLY funding gateway. `ComputeJobSignedCustodyMatchWorkerIntegration420.t.sol` exercises the actual combined signed-request, native payer transfer, exact job funding proof, accepted match, strict assignment and result commitment. It also covers an unfunded job's inability to match, foreign payer and above-ceiling deposits, cross-job funding and assignment replay, independently reserved funds across two jobs, stale resource revisions, and a payer-only unmatched refund that does not consume another job's reservation. Both tests use a restricted TEST-ONLY capability fixture: its acceptance cannot attest to canonical registrar registration, authorized real-world grant issuance, expiries or revocation. The integrated test deliberately denies verification and settlement.

The earlier CMP-1.1.3 standalone workflow succeeded at commit `168d514cbbbaebf1efb9dcb4b1d0cbb91a758535`. The added integrated test requires a NEW qualification of the exact resulting head in all three workflows: Solidity Contracts, 420 Integrated Qualification, and 420Docs. Do not cite prior green workflow runs as proof for a new commit. On the new head, record and diagnose any compilation or failing test before signing off this slice.

## Remaining boundaries

- Production capability wiring and privilege-policy qualification: use the canonical CapabilityRegistry420 registrar; demonstrate component registration and constrained, revocable job-scoped grants for `ACTION_ACCEPT_MATCH`, `ACTION_EXECUTE_ATTEMPT` and `ACTION_SUBMIT_RECEIPT`. A test-only grant map is not deployment approval.
- CMP-1.1.4 independent verifier correctness/provenance remains unimplemented in this integrated graph. A result commitment must not imply verified work or authorize a payment.
- CMP-1.2 escrow settlement, matched/failed/disputed refunds, timeout handling and final spending enforcement remain unimplemented; matched funds must stay locked. CMP-1.3 capacity reservation, metering, multiple attempts and actual hardware attestation require separate specifications and tests.
- Before PR merge or production deployment: reconcile the branch to current main, requalify the exact final merge candidate, and explicitly assess end-to-end hostile cases and the full capability and custody deployment graph. PR #370 remains draft and unmerged until all CMP-1.1 admission gates are met.
