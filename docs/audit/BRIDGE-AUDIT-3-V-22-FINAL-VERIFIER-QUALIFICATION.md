# BRIDGE-AUDIT-3.V.22 — final verifier qualification audit

Baseline main is `97413f2eea862d5f2ec3117313cd3beb15a634f4`. This audit reconciles the qualified implementation heads into one integration tree. The associated PR records the published qualified SHA and merge SHA; no self-referential commit identifier is fabricated inside its own tree.

## Scope and classification

The authoritative [inventory](BRIDGE-AUDIT-3-1-VERIFIER-QUALIFICATION-INVENTORY.md) and machine-readable `contracts/config/bridge/verifier-qualification-inventory.json` distinguish independent cryptographic components, eleven locally qualified verifier trust models, and production qualification. SOL, POT and ARRR retain explicitly documented source-authority/historical evidence gaps. There are no approved production instances or active production token profiles. Historical transactions unrelated to the configured gateway do not establish transfer authorization.

Original PR heads, evidence and retained CI IDs are recorded in `final-verifier-qualification/ORIGINAL-PR-EVIDENCE.json`. The consolidated commit preserves those heads as ancestors, including the reconciled outstanding BRIDGE-AUDIT-3.2 draft. It does not discard concurrent main work or relabel old runs as current-head tests.

## Required work reconciled

| Original requirement | Implementation or evidence |
| --- | --- |
| Reconcile all implementations with current main | Original source-head integration, explicit conflict resolutions, retained source comparisons and merge ancestry |
| Complete locally executable work | Canonical envelope and authenticated source context completed; live CADC issuer-guard revocation enforced; affected fixtures use actual governance admission |
| Validate exact-head evidence | Current source SHA256 input manifests, affected Foundry results, runtime-size assertions, SDK tests and inventory validator |
| Independently qualified components | Twelve unchanged native component graphs retain their original source fingerprints, historical corpus and reference evidence |
| Fully qualified verifier implementations | Eleven documented local trust models; no production approval; SOL/POT/ARRR remaining gaps explicit |
| External infrastructure dependencies | Per-family source/issuer/root/native-service/gateway requirements in authoritative inventory |
| Unsupported routes fail closed | All fourteen unqualified adapter paths reject; legacy tuple gateway and two unwired placeholders reject; native routes require current approval |
| Merge qualified implementations | Qualified consolidated tree is merged through its associated PR; original source heads retained as ancestors |
| Update authoritative inventory | Human and machine inventories, asset/token declarations and original evidence reconciled |
| Deployment-dependent handoff | Existing 420Bridge testnet roadmap updated; missing external source evidence remains separately identified |

## Integration changes

The native CADC adapter now invokes `CADCBridgeIntegration.requireActive()` at execution time. A stored active flag cannot authorize delivery after guard qualification is revoked. The actual Endpoint/OFT regression verifies rejection before token, endpoint or replay side effects.

The canonical proof envelope binds source and destination chain/network, route/adapter/asset, verifier configuration, executing EVM chain/router, source gateway/token, recipient/amount and source transaction/message. The native verifier authenticates the inner proof; each adapter exposes source context only for its successfully authenticated result. Both router admission entry points share the same checks. The envelope is public transport, not a substitute for consensus or source authority. Its caller observation/expiry window cannot establish source-tip freshness. Existing persistent source replay remains authoritative across refreshed transport, replacement and recovery.

Legacy `VerifiedGateway420` four-tuple verification cannot supply that source domain and now fails closed even when governance qualification exists. Supported native adapters preserve their own outpoint/nonce/nullifier protection. No new generic consensus mechanism or destination deployment is invented.

Controlled fixtures were migrated to actual qualification and canonical transport. Historical BTC/LTC/DOGE/ETH/SOL and native CCTP/CADC verifier paths remain distinct from mock admission tests. Production checks were not relaxed to accommodate older fixtures. Existing fee, precision, token-behavior, settlement-receipt, rollback, risk and replay assertions remain enabled.

## Qualification evidence and reproducibility

Current affected qualification: **200 Foundry cases pass**, including **20,000 fuzz inputs**, **256 invariant runs / 16,384 calls / zero handler reverts**, plus **12 Python SDK cases**. All **93 production bridge artifacts** satisfy EIP-170; maximum runtime is **22,063 bytes**. Fourteen executed qualification input manifests match the final Solidity source graph. Catalogue integrity passes for **495 artifacts / 15 datasets / 25,240,921 bytes**; this grants zero complete 420 gateway authorizations.

Actual commands, exact source hashes, logs and bytecode sizes are retained under `final-verifier-qualification/`. `RESULTS.json` is the final machine-readable result. Run `scripts/verify-final-verifier-inventory.py` to reproduce source/evidence and inactive-production consistency checks. `scripts/qualify-bridge-final.py` limits compilation and execution to the affected bridge owners. `scripts/test_bridge_proof_envelope.py` covers strict serialization and public-data validation.

The initial integration selection accidentally included eight inherited unit-only cases under the real token-router owner; their required stub API does not exist on the real router. They were correctly excluded from that owner, while the proper unit owner remained covered. The later canonical-envelope code change invalidated the interim common integration results; those logs remain diagnostic evidence, not final qualification.

The envelope test helper initially exceeded the Solidity IR stack when constructing a twenty-field struct in one expression. Sequential field assignment fixes the actual compiler failure without changing assertions. Native test linking is selected explicitly after Forge's dynamic-linker fallback exposed the same issue. Retained diagnostics record the failure rather than claiming it passed. The subsequent combined 251-file compile exited with SIGKILL before tests; the same optimizer/compiler settings are retained in smaller owner-scoped projects. The separately successful 207-file legacy compilation covers all 93 production bridge artifacts, with a maximum runtime of 22,063 bytes. No assertion or compiler optimization is weakened.

No expensive unchanged historical replay, native signature, source-consensus, BLS or historical fork qualification is rerun. Original Bitcoin CI `43563876850` and `43563876854` remain tied to source `5f58baf6dc861939a21119a0fce645060a067518`; earlier historical run `43553972819` retains its original SHA and scope. New qualification is local and has no invented CI run ID. Publication skips redundant CI; existing workflow path filters retain their job bodies and branch policies.

## Canonical transport use

Encode the exact public claim schema shown in `contracts/test/fixtures/envelope/claims.json` with `python3 scripts/bridge_proof_envelope.py --claims claims.json --inner-proof 0x... --output envelope.hex`. Submit those encoded bytes to the configured router with the same adapter ID. Claims must be derived from the authenticated native transfer and current canonical route/chain configuration. The encoder creates no signature, consensus proof, qualification or authority; the router independently rejects mismatches. Never include spending/viewing credentials in claims or proof transport. The native shielded verifier accepts only the documented public ownership evidence.

## Genuine remaining prerequisites

SOL still needs authenticated source epoch stake/voter authority and genuine bridge-domain validator certificates. POT still lacks the required post-500 raw history/native replay and source/build provenance. ARRR still needs authenticated Pirate/KMD/onward-anchor finality/notary infrastructure and an owned production gateway. Those gaps are not solved merely by running destination testnet.

Production source/custody/gateway services, deployed identities and roots, issuer-supported 420 USDC domain/native contracts and CADC endpoint/OFT/DVN authorization, funded transfers and authorized settlement belong to the [existing testnet roadmap](420BRIDGE-TESTNET-WORK-ROADMAP.md). All unsupported configurations remain inactive and must reject at execution time. No issuer authorization was obtained or implied by this audit.

The next canonical work is that existing testnet qualification/handoff when its prerequisites exist, followed by the main roadmap's independent audit and launch review. No successor verifier step is invented or begun.
