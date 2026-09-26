# EXP-0.2.4 — dependency readiness matrix

**Status:** dependency readiness register committed; exact-head CI qualification required before closeout.  
**Machine-readable register:** `docs/audit/EXP-0.2.4-dependency-readiness-matrix.json`.

## Objective

EXP-0.2.4 converts the dependency inventories from EXP-0.1.2 and EXP-0.1.3, together with the canonical-authority rules from EXP-0.2.3, into a single readiness register.

The key requirement is to keep three questions separate:

1. **Does the implementation exist in source?**
2. **Is the dependency actually deployed for the target network?**
3. **Has the deployed dependency been qualified live?**

No source file, frozen address, unit test, CI run, or placeholder readiness record may be used to answer the second or third question affirmatively without deployment/runtime evidence.

## Readiness dimensions

The matrix records:

- source status: implemented/tested, implemented source, source present, not observed, or not applicable;
- deployment status: deployed, pending deployment, unverified, or not applicable;
- live qualification: qualified, unverified, or not applicable;
- whether the dependency is mandatory for core Genesis;
- remaining gates needed before later qualification can close.

## Mandatory dependencies

### 420Indexer /v1

Source implementation and qualification are strong, but `testnet/public-services/indexer/readiness.json` still has URL `REPLACE` and `PENDING_TESTNET_DEPLOYMENT`.

Disposition: **source implemented/tested; deployment pending; live qualification unverified.**

### Explorer backend

The shared-indexer consumer path is implemented and tested, and a live validator workflow exists. The Explorer readiness fixture still has backend URL `REPLACE` and status `INDEXER_CONSUMER_IMPLEMENTED_PENDING_DEPLOYMENT`.

Disposition: **source implemented/tested; deployment pending; live qualification unverified.**

### Explorer frontend/public URL

The frontend source exists and implements the current required views, but its readiness status is `PENDING` and its URL remains `REPLACE`.

Disposition: **implemented source; deployment pending; live qualification unverified.**

### Canonical chain/RPC source

420Indexer source supports chain ID 420, wrong-chain rejection, finality tracking, checkpointing and rebuild. The Explorer audit does not establish the official deployed RPC/node endpoint or live target-network identity.

Disposition: **implemented source; deployment/runtime binding unverified; live qualification unverified.**

### ProtocolRegistry

The source contract exists and the frozen address authority assigns ProtocolRegistry to `0x0000000000000000000000000000000000000434`. That assignment is not proof that the target network contains the expected runtime bytecode or authorized Registry publications.

Disposition: **implemented source; deployment unverified; live qualification unverified.**

### Frozen system-address authority

The two authoritative source maps agree. This configuration authority itself is source-present, but live code identity at those addresses still requires target-network verification.

Disposition: **source present; deployment dimension not applicable to the map itself; live target-network verification unverified.**

### Registry ABI/descriptor provenance

ProtocolRegistry source/event definitions and service IDs exist. EXP-0.1.3 already recorded that generated ABI/descriptor artifacts and live deployment provenance are separate concerns.

Disposition: **source present; release/runtime descriptor qualification unverified.**

### Consensus/validator projection

Explorer and Indexer consensus interfaces exist in source and required consensus fields are declared. The audit does not yet prove that the deployed Indexer backend wires the consensus provider or serves representative live data.

Disposition: **implemented source; deployment wiring unverified; live qualification unverified.**

## Optional dependencies

420 Names, 420 Identity and verified-source/420 Verify metadata are optional display enrichments for Explorer's core Genesis scope.

Their absence must not block core Explorer Genesis qualification. If enabled later, their provenance and authority boundaries still require qualification.

## Automated gate

`scripts/verify-exp-0-2-4-dependency-readiness.py` fails closed unless:

1. all expected dependencies are present exactly once;
2. every dependency has source/deployment/live status, evidence and remaining gates;
3. all evidence paths exist;
4. required dependencies cannot be silently marked live-qualified;
5. current readiness fixtures remain faithfully represented;
6. Indexer URL and Explorer backend/frontend URL placeholders force pending/unverified deployment status;
7. ProtocolRegistry's frozen address remains `0x...0434`;
8. fixed addresses are not promoted to deployment evidence;
9. Names, Identity and verified-source metadata remain optional;
10. optional dependency absence cannot become a Genesis blocker.

The verifier writes `exp-0-2-4-evidence/summary.json` and `dependencies.tsv` for CI upload.

## Completion condition

EXP-0.2.4 is qualified when the dedicated verifier and the existing Explorer/Indexer/repository qualification suites pass on the same exact head and the evidence artifact is uploaded.

This qualifies the **readiness classification**, not the live dependencies themselves.
