# HC-SEED-04 — Rare breeding and authorized genome registration

## Status and honest exit boundary

Implementation is complete for reconciliation, immutable breeding plans, canonical inheritance verification, chain-bound registration/request/finalize tooling and scoped Level 1/Level 2 contract qualification. **Live registration closeout remains blocked.** `deployments/highcountry/r07-1.testnet.json` is `UNRESOLVED_NOT_DEPLOYED`: chain ID, component addresses, code hashes and deployment receipts are null. The gaming runtime is also unresolved. No live deployment, signer, finalized HighCountry Genesis or approved production randomness route is established by these files. The repository contains a randomness-verifier interface, not an approved deployed proof provider that this task can assume.

Do not relabel this step LIVE COMPLETE until independent live readback proves all 23 common reference genomes and all 26 finalized rare breeding events. A disposable contract qualification is not production registration. No generated live transaction hashes, invented provider proofs, guessed contract addresses or fictitious breeding events are inserted into the catalog.

## Reconciled crosses and deterministic plan

`deployments/highcountry/rare-parent-pairs.v1.json` contains all 26 previously approved fictional parent pairs. Each resolves to exactly two distinct HC-SEED-03 common reference genome IDs; every rare name, ID and regional home matches the canonical catalog. Blue Moon remains Blueberry × Northern Lights; Spirit Bear remains White Widow × Blueberry; Crow Mother remains Granddaddy Purple × Chemdawg. Original Sixteen names and reserved founder line IDs are not reused.

`rare-breeding-plan.v1.json` commits pair metadata and common reference evidence before entropy is known. Each rare has a deterministic nonzero uint64 event ID, child ID, nonfounding line ID, metadata commitment, exact Solidity ABI context hash and local request ID. Child IDs contain no target-yield salt or entropy-search input. Planned entropy/loci stay null. These are plans, not completed breeding records. Changed pairs or canceled plans require an explicit new version, not an automatic retry with new randomness.

The metadata preserves intended parentage as fictional game canon. No desired pigment, yield, aroma, strength or phenotype is fabricated from inherited opaque loci. Actual offspring are derived by the unmodified canonical BreedingEngine and registered only through that engine, with its exact child-genome capability.

## Authorized lifecycle

1. Confirm approved deployed chain, operator, code hashes and dependency bindings. Confirm HighCountry Genesis is already finalized; this tool neither finalizes Genesis nor grants itself authority.
2. Register each exact common reference with its existing scoped GENOME_REGISTER capability. Existing exact records are read back; mismatches reject.
3. Verify both parents' full registered records before requesting a rare cross. Bind event ID, parents, child identity, line and metadata to the canonical context before entropy exists.
4. CanonicalBreedingRandomnessAdapter routes the request to the actual RandomnessRouter420. The independently operated approved proof provider fulfills it. The registration runner has **no entropy/proof injection or provider-fulfillment command**.
5. Finalize through BreedingEngine with its scoped request/finalize authorities and child-registration capability. Any failed finalization rolls back entropy consumption and child registration together.
6. Independently read the finalized breeding event, adapter consumption, canonical router/registry proof result and child registry record. Recompute all 28 loci, including the exact canonical mutation ABI encoding. Verify IDs, metadata, line, nonfounding state and ancestry bindings.

Raw RandomnessCoordinator fulfillment is not used as a canonical production substitute. The integration tests use the actual router, route/profile/result registries and adapter. Their signature-based provider is explicitly a **test-only proof verifier**, never claimed as production VRF or independent production entropy.

## Deployment and evidence tooling

`seed-registration-runtime.v1.json` deliberately starts unresolved. An approved runtime must supply actual chain ID, operator, seven explicit contract addresses/code hashes, profile ID, confirmation policy and approved provider route/operator/verifier/method/code-hash records. Do not populate these from test addresses. `seed_registration_rpc.py` rejects unresolved state before any RPC call.

After a real deployment is qualified:

```
export HC_SEED_RPC_URL=... # authorized external signer/read RPC; no keys in configuration
python scripts/highcountry/seed_registration_rpc.py --runtime APPROVED_RUNTIME.json --phase preflight --journal JOURNAL.json --output PREFLIGHT.json
python scripts/highcountry/seed_registration_rpc.py --runtime APPROVED_RUNTIME.json --phase commons --send --journal JOURNAL.json --output COMMONS.json
python scripts/highcountry/seed_registration_rpc.py --runtime APPROVED_RUNTIME.json --phase request --send --journal JOURNAL.json --output REQUESTS.json
# Wait for independent canonical proof fulfillment; do not synthesize provider entropy.
python scripts/highcountry/seed_registration_rpc.py --runtime APPROVED_RUNTIME.json --phase finalize --send --journal JOURNAL.json --output FINALS.json
python scripts/highcountry/seed_registration_rpc.py --runtime APPROVED_RUNTIME.json --phase audit --journal JOURNAL.json --output AUDIT.json
```

Without `--send`, write paths return unsigned transaction payloads. Signing belongs to the authorized external RPC/signer. The journal binds chain, runtime and plan; it persists transaction hashes and receipts and resumes existing transactions instead of silently resubmitting. Successful receipts require status 1, configured confirmations, canonical block hash and independently queried matching sender, target and calldata. Reverts/reorgs/missing confirmations reject or remain pending. RPC/transport errors are never converted into nonexistent events or successful registration.

Finalized rare audit uses a confirmed block snapshot; it checks context, exact parents, child metadata, nonfounding flag, canonical proof/entropy, request-bound approved operator/verifier/method, verifier runtime hash, adapter consumption and recomputed loci. Runtime code/dependency checks happen in preflight. Evidence readback still depends on the configured trusted RPC; this is not a cryptographic light-client proof.

## Qualification and artifacts

- Level 1: 22 Python plan/runtime-boundary tests, deterministic plan validation and canonical formatting.
- Genetics Level 2: eight tests against actual unmodified registry, authorization, Genesis, emergency, breeding, canonical randomness router and adapter contracts. The existing capability mock is only a test grant issuer. These tests register all 49 genomes in disposable contracts, validate all 26 crosses, and reject proofless finalization, wrong-provider/invalid-proof fulfillment, replay, duplicate reservations, emergency finalization, canceled/expired plans and registration without engine capabilities.
- The test exports `artifacts/highcountry/hc-seed-04-test-evidence.json` directly from actual contract state. The separate Python evidence verifier matches all 728 rare loci against canonical recombination/mutation and emits `hc-seed-04-qualification-report.json`. Both files explicitly state `liveRegistration:false` and disposable test provenance. CI uploads both as reviewable artifacts.
- The test runner compiles only the transitive import closure (29 files) with canonical Solidity 0.8.24, Cancun, via-IR and optimizer 200; production sources are copied unchanged. No unrelated Solidity/global suite is manually relaunched.
- HC-SEED-01/02/03 files and their passing evidence remain unchanged. Prior qualified SHAs/runs: 2c97a94 / 40265740974; 830cb2c / 40266592926; 4f17985 / 40268715028. Exact new CI evidence is reconciled in PR #838.

## Remaining live closeout requirements

Resolve an independently verified deployed runtime and authorized signer; establish finalized Genesis through the launch process; provision the exact scoped capabilities; confirm the governance-approved production proof provider and profile; execute the above lifecycle; preserve confirmed transaction receipts and all 49 genome readbacks plus all 26 canonical breeding/randomness records. Only that evidence satisfies the live registered-genomes exit. No merge to main is performed at this intermediate roadmap step.
