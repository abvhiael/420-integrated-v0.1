# GOV-PRE-06 — Constitutional post-Genesis electorate bootstrap qualification

**Local implementation:** The focused, exact-source-head Governance and 420Identity voting paths **PASSED**. **Live V4 Genesis approval, real testnet members, first live votes and production-equivalent testnet execution remain unqualified.** This record does not authorize deployment or bypass frozen V3 commitments.

## Provenance and changed implementation

Authoritative repository: `abvhiael/420-integrated-v0.1`; PR [#1333](https://github.com/abvhiael/420-integrated-v0.1/pull/1333); source qualification SHA `e239889bebdbbb80eadfb033e451e0997ddccdb8`. The exact generated artifact commit `6985e52c177d228757a445bfd96c12752cfd206c` updates the materialized Governance runtime and seven-slot bootstrap approval records without invented release identities.

- `contracts/src/governance/CivicInitialElectorateEnrollment420.sol`: independent verified 420Identity profile/controller and issuer-approved house-specific credential, active registered Validator ownership, self-enrollment, duplicate prevention, real chain binding, withdrawal and independently provable invalid-record pruning before seal, permission-restricted one-way seal and computed Merkle commitment. A user cannot self-certify eligibility.
- `contracts/src/governance/Governance420.sol`: old five-field Genesis mode remains byte-for-byte consistent in plan-hash calculation and the 19-operation initialization; new deferred mode requires the Genesis-approved enrollment/helper contract and constitutional authority with both initial house roots/totals zero. The distinct plan commitment binds the chain, seven Civic graph/code hashes, approval addresses, enrollment runtime and 420Identity/ValidatorRegistry code hashes. A single immutable additional G1 operation (index 19) installs the approved VERIFIED 420Identity issuer, enabling genuine post-Genesis issuance before the first electorate exists.
- `Governance420.schedulePostGenesisInitialElectorates()`: only approved constitutional authority can seal verified enrolled wallets and schedule previously reserved fixed checkpoint operations 17/18, each still subject to its original G1 Timelock floor. Final activation verifies authenticated frozen checkpoint roots/totals and eligible records, then irreversibly hands execution scheduling to CivicGovernor420. No arbitrary first-root setter, fake member list or upgrade/bypass exists.
- `contracts/config/governance-deployment-v1.json` and the GOV-AUDIT-6 generator/independent verifiers: frozen Genesis materialization now has **seven** slots, with only two valid fully approved modes. The unapproved default remains all zero and release readiness false. Any partial/mixed or unapproved plan fails closed.
- `contracts/test-governance-audit-6/GovPre06Electorate420.t.sol`, `scripts/test-governance-rec-6.py`, `.github/workflows/governance-pre-06.yml`: deterministic source-head checks, Python approval-mode rejection tests, real Identity420 issuer and credential operations, Merkle ballots, constitution classes, Timelock handoff, one-way seal, stale enrollment recovery and adversarial wrong-chain/wrong-house/ineligible-controller attempts.

## Actual qualified execution

[**GOV-PRE-06 targeted GitHub Actions #44995030222**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44995030222) — **SUCCESS**, source SHA `e239889bebdbbb80eadfb033e451e0997ddccdb8`:

- **5/5** new Foundry tests (no failures or skips): real post-Genesis dual-house voting and Timelock batch/handoff; ineligible/duplicate credential rejection; authorization and sealing replay prevention; wrong-chain and live-status failure; authorized pruning and renewal of genuinely invalid registrations before irrevocable seal.
- **7/7** independent Python Genesis approval-mode tests.
- Source formatting, full modified Governance contract compilation and explicit **EIP-170 runtime size check** all passed.

The retained `contracts/artifacts/Governance420.json` after artifact regeneration contains deployed runtime **24,499 bytes** (EIP-170 maximum 24,576; 77 bytes headroom) and `runtimeCodeHash = 0x14e278b3f691b8e00adc75972ca53e0e8ef8de938bdd583a7ea94822528f5c14`. The dedicated workflow now enforces the same code-size cap, so future regression cannot silently qualify an undeployable 0x0437 runtime.

The materialization check `GOV-AUDIT-6` and wider GOV-AUDIT-7/integration workflow conclusions must independently be verified for the **final PR head** before calling the entire retained qualification complete. An artifact-generation commit is not itself a testnet receipt.

## Release gate

**Not claimed:** verified constitutional authority signing and source-chain ID; actual deployed enrollment helper with approved runtime hash; actual Community members and selectable Validator owners; genuine independently issued 420Identity credentials; approved signed V4 Genesis; actual Timelock G1 transactions, first checkpoint receipts, live dual-house ballots and canonical proposal execution on the first testnet. No synthetic fixture owner, empty approval, speculative production address, or GitHub CI result may substitute for these external receipts. No changes were made to historical V3, 42M $420 issuance, community economics, validator reward rules, or the existing G1–G4 constitution.

After exact-head local code qualification, the next pre-existing release milestone remains **GOV-AUDIT-9 — production-equivalent testnet deployment qualification**. Do not start it as part of this local GOV-PRE-06 change.
