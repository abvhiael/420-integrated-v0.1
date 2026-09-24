# CMP-1.1.4.1 — hostile-path signed verdict qualification

Status: **IMPLEMENTED TESTS; NOT QUALIFIED UNTIL EXACT-HEAD SOLIDITY CI PASSES.** This is one qualification slice of CMP-1.1.4, not general GPU/AI output correctness, live settlement, production beneficial-ownership validation, or CMP-1.1 completion.

## Canonical test system

`contracts/test/ComputeJobIntegerProfileHostile420.t.sol` deploys the real signed-request authority, payer custody, compute capability registry and authorization, provider/node/resource registries, accepted match, worker assignment/receipt, controller-attested verifier policy, integer-profile verifier adapter, and guarded ComputeJobRegistry. The fixture uses a payer-funded 3 ETH reserve and the versioned four-integer workload input `[3,4,5,12]`. An independently recomputed sum of squares is 194. The test-only settlement evidence denies settlement, so a verification must *not* be interpreted as a release of payer escrow.

## Hostile acceptance criteria

1. Canonical identifiers: substitute request, manifest, match, assignment, or result commitment in a signed verdict; reject every substitution and preserve the reserved balance, job revision/state, unused nonce, and empty decision reference.
2. Authentication: a verdict purportedly from another verifier/controller, or bearing a signature from the job owner rather than the appointed verifier, fails closed. The signature-only base endpoint cannot bypass independently evaluated output.
3. Correctness and profile: a negative verdict for the correct committed answer, unsupported profile, altered input, altered output, and altered worker receipt fail closed. The correct answer can be approved only when all committed preimages match.
4. Freshness and replay: reject expired verdicts, stale revisions, duplicate verdicts and a signature generated under a different chain domain. An accepted decision consumes its nonce once; replay must not release or change the job or its reserved funds.
5. Positive control: after invalid attempts, the original valid signature and matching canonical evidence must still permit a VERIFIED transition while preserving the 3 ETH reserve.

The suite cannot establish whether the attestor correctly identified beneficial owners in the real world. It does not qualify the earlier signature-only adapter for production. A production deployment must prove the canonical job registry is wired to a profile-specific, policy-enforced verifier, and separately qualify final settlement, refund, and dispute handling.

## Evidence and disposition

- Test source: `contracts/test/ComputeJobIntegerProfileHostile420.t.sol`.
- Existing known-good/incorrect/tamper profile tests: `contracts/test/ComputeJobIntegerProfileVerification420.t.sol`.
- On any failure, inspect the failing Foundry test and preserve the draft PR. Do not mark 1.1.4.1 or CMP-1.1.4 qualified on passing documentation/integrated jobs alone.
- Record the exact PR head, Solidity workflow run and shard result only after completion. CI remains the authority for pass/fail; the existence of this document or of test code is not evidence of execution.
