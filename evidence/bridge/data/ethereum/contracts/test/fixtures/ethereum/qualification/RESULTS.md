# Ethereum qualification evidence — 2026-11-14

BRIDGE-AUDIT-3.V.3 is implemented and locally qualified on the source closure
in `source-sha256.json`, based on main
`bb4bd6374d561bcba65345a1dbc86c0c70d53272`. The implementation commit containing
this record identifies the qualified tree; this record does not invent a
self-referential commit SHA. Bitcoin evidence and its existing SHAs/run IDs are
unchanged.

| Scoped owner | Unique passing cases | Evidence |
|---|---:|---|
| Real immutable SP1 Groth16 proof and adversarial mutations | 1 | sp1-proof.log |
| Consensus, SSZ, canonical RLP/MPT, execution, ancestry, historical accounts | 14 | consensus-initial.log, accounts-correction.log, ancestry.log, header-boundaries.log |
| Concrete ETH/seven-token gateway, receipt/transaction identity, destination, replay, escrow | 7 | gateway-initial.log, native-gateway-correction.log, destination-router.log |
| Real shared gateway/route/risk/transfer registry rollback and replay integration | 1 | shared-router-correction.log |
| Affected existing ETH/seven-token routes and cross-adapter hardening | 69 | route-regressions.log |
| Stateful real consensus proof/forgery/replay invariant | 1 | consensus-invariant.log |
| **Total** | **93** | test-results.json |

Five fuzz cases ran 2,500 inputs each: **12,500 fuzz inputs**. The invariant ran
**128 sequences × 64 calls = 8,192 handler calls**, zero handler reverts and no
forged consensus state. Actual test configuration: Forge 1.9.0, solc 0.8.24,
Cancun, optimizer 200, via-IR, deterministic fuzz seed 0x420.

Initial consensus execution passed 11/12: the account ABI fixture had not been
copied into the isolated snapshot before generation completed. After generating
it, only the missing-account case reran and passed. Initial gateway execution
passed 3/6: native fixture calls impersonated an unfunded sender. After funding
that local sender, only the three affected cases reran and passed. The same
fixture correction qualified the single shared-router case. No production
assertion was weakened. An initial route selector matched no tests; it is not
passing evidence. The corrected selector executed all 69 intended cases, and
the runner now explicitly rejects a zero-test result. Passing cases were not
repeated to obtain these corrections.

Independent verification also passed:

- The checked-in guest ELF's verification key was actually derived with the
  pinned native SP1 tool and matches the immutable contract key; program-vkey.log.
- Both genuine historical Groth16 proofs, including committee period 1909→1910,
  pass the real verifier on Cancun.
- All 221 actual transaction hashes, receipt encodings, both MPT roots, finalized
  execution hash, bootstrap/committee SSZ proofs and all seven token account/code
  proofs match independently computed Python results; historical-oracle.log.
- An actual 512/512-participant mainnet BLS aggregate signature, signing domain,
  finality branch, next committee branch and execution SSZ branches pass py_ecc;
  altered signing roots, invalid signatures and empty participation fail;
  bls-independent.log.
- All six deployable production contracts fit both EIP-170 runtime and EIP-3860
  creation limits under the actual Cancun compiler settings; bytecode-sizes.json.

No production source changed after its applicable passing tests. Later additions
were new tests, provenance/configuration, documentation and workflow path filters.
The complete scoped workflow is supplied for future relevant changes. No CI run
is needed to repeat this already-passing local evidence; publication uses
`[skip ci]` to prevent unrelated workflows and redundant reruns. **CI run ID:
none launched for this qualification.** These named original logs are local
execution evidence, not fabricated GitHub run IDs.

Historical evidence does not claim a deployed 420 Ethereum gateway or historical
420 deposits. Those event integrations use explicit local controlled roots and
actual local escrow/log execution. The source gateway, light client, proof
relayer and destination contracts have not been deployed or activated by this
work. Existing deployment/custody/activation requirements remain in effect.
There is no external blocker to the completed local implementation and tests;
live operation requires those existing deployment dependencies and fresh proofs.

The next numbered audit item is BRIDGE-AUDIT-3.V.4. Its chain/title is not
established by the checked-in canonical roadmap; no unverified title or new
roadmap step is assigned here, and no next-step work was begun.
