# CMP-1.1.4.3 — profile and evidence integrity

**Status: implementation and tests committed; exact-head CI qualification pending.** This gate covers one workload: `420/CMP/PROFILE/INTEGER_SUM_OF_SQUARES/V1`. It does not qualify general AI, GPU execution, actual identity independence, production wiring, or settlement.

## Reproducible workload and known vectors

The canonical request commits exactly four ABI-encoded `uint64` input values, each at most 1,000,000,000, under `INPUT_DOMAIN`. The worker claims a `uint256` output committed under `OUTPUT_DOMAIN`. An evaluator recomputes the sum of four `uint256(values[i]) * uint256(values[i])` terms without taking the answer from the worker. For `[3,4,5,12]`, the independently computed answer is `9+16+25+144=194`. The `194` worker claim is correct; `195` is incorrect. A verifier must sign `approved=true` for the former and `approved=false` for the latter, subject to canonical committed output preimage and eligibility checks. Neither a signed approval of `195` nor a signed rejection of `194` is admissible.

## Exact decision-to-evidence reconstruction

`contracts/src/compute/ComputeJobIntegerProfileVerification420.sol` defines a versioned, ABI-encoded evidence commitment. A reviewer can reconstruct it from the recorded decision and original preimages:

1. Read the canonical job record and its signed request; independently recompute `inputCommitment = keccak256(abi.encode(INPUT_DOMAIN, values))` and `workerOutputHash = keccak256(abi.encode(OUTPUT_DOMAIN, claimedOutput))`.
2. Read the assigned worker record, including the match, acceptance, resource, attempt, worker, and worker receipt. Reconstruct the strict result commitment using `RESULT_DOMAIN`, `block.chainid`, the worker-evidence contract address, canonical job/request/manifest identifiers, assignment fields, receipt and worker-output hash. Require the reconstructed result to equal both the assignment and canonical job commitments.
3. Read the independent-verifier appointment snapshot for that *job*. Reconstruct `appointmentRef = keccak256(abi.encode(APPOINTMENT_DOMAIN, policyAddress, jobId, appointmentStruct))`. The active appointment must name the same verifier and profile as the signed verdict. The policy-enforced super-call also checks live attested controller independence, selection eligibility, signed authorization and actual payer. The appointment hash is a record of the accepted snapshot, not a guarantee of future eligibility or proof of beneficial ownership.
4. Recompute `expectedOutput` from the committed input, set `correct = (claimedOutput == expectedOutput)`, and check the signed `approved` flag agrees. Compute `decisionRef` as the EIP-712 verdict digest, which binds job, request, manifest, match, assignment, result, verifier, profile, revision, expiry, nonce, chain ID and verification adapter.
5. Independently calculate `evidenceRef = keccak256(abi.encode(EVIDENCE_DOMAIN, decisionRef, jobId, inputCommitment, strictResultCommitment, workerOutputHash, receiptHash, claimedOutput, expectedOutput, correct, appointmentRef))`. Compare it with `evaluation(decisionRef).evidenceRef` and the `IntegerEvaluationRecorded` event. Confirm `decisionForJob(jobId) == decisionRef`, and the job transitioned to `VERIFIED` on a correct result or `FAILED` on an incorrect committed result.

This version **extends** the earlier evidence encoding with the appointment reference. Past evidence hashes created by an earlier contract build must not be represented as matching this new version; qualify and publish the concrete deployed code hash before production use.

## Automated test matrix

`contracts/test/ComputeJobProfileEvidenceIntegrity420.t.sol` constructs full signed requests, actual payer custody reservations, canonical accepted matches, committed worker results, attested verifier appointments and signed evaluated verdicts. It independently reconstructs exact evidence refs for `194` acceptance and `195` rejection and verifies profile, appointment, input, output, receipt, worker, verdict and canonical job bindings. Two distinct funded jobs with distinct requests, receipts and appointment evidence are used to reject cross-job receipt and signed-verdict substitution; a substituted profile is also rejected. Every failed submission must leave canonical job status and decision unchanged, verifier nonce unused, and the full reserve untouched; a clean verdict must still succeed afterward. Earlier suites cover tampered input/output preimages, hostile verdict fields, chain-domain replay and independence drift.

## Exit criteria and limitations

Record **all three workflows passing on the same exact head commit**, including the new test file in Solidity's executed test list, and inspect diagnostics for any failures. Preserve a reproducible reviewer record of the accepted and rejected vectors and the algorithm above. CMP-1.1.4.4 must separately establish that deployed canonical registry wiring actually points at this profile-evaluating adapter and record code hashes, authorized roles and identities. Actual appointment and off-chain identity evidence remains a distinct operational gate. Keep PR #370 draft and unmerged until remaining CMP-1.1 requirements are qualified.
