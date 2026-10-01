# CMP-1.4.4 — Signed verdicts and decision provenance

Status: **IMPLEMENTED; QUALIFICATION PENDING AS PART OF CMP-1.4.12 CLOSEOUT.**

## Canonical definition

> Bind every verdict to chain, contract, job, unit, attempt, worker, result, verifier, policy, evidence, nonce and expiry.

CMP-1.4.12 found this canonical step still open even though later CMP-1.4 work had deliberately preserved it as a blocker. Phase closeout therefore repairs the missing provenance binding rather than silently carrying the gap forward.

## Implementation

`ComputeJobIndependentVerification420` now derives a canonical `DecisionProvenance` from the bound JobRegistry and worker-evidence endpoint. The signed EIP-712 verdict includes the resulting provenance hash.

The binding is:

- chain — EIP-712 domain plus provenance evidence commitment;
- contract — verifier contract in the EIP-712 domain and canonical JobRegistry in provenance;
- job — exact `jobId`;
- unit — current CMP-1 fixed-price scope has one canonical payable unit per job, so `unitId == jobId`;
- attempt — exact result-bearing `attemptRef` plus monotonic attempt number;
- worker — canonical worker returned by the worker-evidence contract;
- result — canonical JobRegistry/result-evidence commitment;
- verifier — signed verifier identity;
- policy — frozen verification policy id, revision and commitment;
- evidence — canonical execution-evidence commitment;
- nonce — verifier-scoped one-use nonce;
- expiry — signed verdict expiry.

Both retained worker-evidence implementations expose `verdictContext(jobId)`. The WorkerRegistry snapshot implementation resolves the latest result-bearing retry while retaining the root assignment in canonical JobRegistry state, preventing a retry verdict from collapsing back to attempt one.

## Security and authority boundaries

Relayers do not supply worker, attempt or policy provenance. Those values are reconstructed from bound canonical contracts.

A signed verdict remains authentication/provenance evidence, not objective correctness by itself. Production profiles still require the appropriate policy-enforced/objective adapter. A verdict never grants custody, settlement, stake/slash, governance, validator, bridge or arbitrary-wallet authority.

## Qualification

Focused retained coverage proves canonical persisted provenance, frozen-policy provenance, retry-aware attempt binding, cross-domain replay rejection, expiry/nonce replay rejection, hostile field substitution, negative verdict isolation and no implicit settlement.

Level 1 is run on the exact closeout implementation SHA. Because this gap is repaired at the final CMP-1.4 reconciliation boundary, its integration evidence is also included in the CMP-1.4.12 Level 3 campaign.

No fixed Genesis predeploy or live deployment is introduced.
