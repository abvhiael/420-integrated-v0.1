# 420Wallet — audit remediation and Genesis release roadmap

**Status:** in progress; NOT live-testnet qualified. **Working branch/PR:** `wallet-w14-6-names-send-integration`, [PR #358](https://github.com/abvhiael/420-integrated-v0.1/pull/358) (draft, unmerged). This is an audit-remediation status document, not authorization to deploy, merge, flip runtime gates, or present a reservation as deployed code. Revalidate this roadmap against the PR head and `main` before each closeout.

## What the audit established

1. Canonical wallet contract assignments overlap the frozen economic/consensus system namespace. Wallet anchors for SmartAccountFactory420 (`0x0420`), CapabilityRegistry420 (`0x0421`), ProtocolRegistry (`0x0422`), and Identity420 (`0x0424`) collide with the frozen system roles; the issue extends through other Genesis anchors within `0x0425`–`0x043b` and a bridge candidate at `0x043c`. The legacy predeploy/deployment map places ProtocolRegistry at `0x0434`, Names420 at `0x0435`, and Identity420 at `0x0436`; a Names420 reservation at `0x0445` is **not** a deployed or attested contract. A four-address-only Wallet fix is insufficient. Candidate Wallet addresses `0x0446`–`0x0449` are **unapproved proposals**. The frozen consensus/economic assignments must not be silently overwritten.
2. `wallet/deployment-inventory.json` still states `readyForLiveTestnet: false` and `canonicalAddressConflictResolved: false`; its official network manifest is missing, endpoints are unset, and live-chain code/identity/EntryPoint checks are not met. Never fill these values with sample URLs or invented attestations.
3. The predeploy plan is not artifact-ready. Compiled runtime bytecode for the complete selected placement set, pinned compiler/build provenance, independently derived constructor/post-init storage, allocation integrity, runtime-code hashes and storage roots remain release requirements. Offline generation or synthetic tests cannot establish on-chain deployment.
4. Repository unit/static checks and synthetic tests are distinct from end-to-end wallet send, account-abstraction sponsorship, dApp permission, extension/mobile-device, bridge, and adversarial security qualification. Record evidence for each separately.

## Implementation and evidence ledger

| Stage | State | Evidence / exact remaining exit criterion |
| --- | --- | --- |
| W14.1–W14.5: inventory, web/extension/mobile wiring and guarded dApp integrations | Implemented on development branches; release closeout **not demonstrated** | CI validates portions of the clients, but production device/browser qualification and deployed-network binding must still be evidenced on the release candidate. |
| W14.6: 420Names guided-send and `0x0445` reservation | Guarded code and reservation on PR #358; **deployment pending** | Verify on-chain Names420 runtime code, chain identity, resolver and recipient/address integrity before enabling send; guard against wrong-chain and ambiguous names. |
| W14.7.1: namespace validator and six synthetic regressions | Validator and synthetic tests committed; synthetic suite passed in Wallet Web #945 on `454b4cf`; **actual namespace unresolved** | Approve one *global* canonical map, migrate all registries/manifests/references and independently pass the real-data collision verifier; release gate must remain false until then. |
| W14.7.2: guarded predeploy generator and ten synthetic regressions | Generator, tests and CI wiring committed; synthetic suite passed in Wallet Web #945 on `454b4cf`; **actual artifacts/storage missing** | Generate complete reproducible runtime artifacts and constructor-derived storage after address migration, then produce non-attested Genesis candidate. |
| W14.7.3: generated-Genesis integrity verifier and twelve synthetic regressions | Verifier, tests and CI wiring committed at `f82c8c3`; Wallet Web #953 passed, but complete head-wide CI was pending at roadmap review; **real candidate not verified** | Confirm all new CI jobs; inspect exact test steps/logs; run verifier on a genuinely generated candidate and match manifest, addresses, code hashes and storage. Never claim deployment from file integrity alone. |

**CI tracking:** the six workflows on predecessor `454b4cf` passed, including 16/16 Solidity shards. New work at `f82c8c3` requires its *own* complete six-workflow result; older green runs do not qualify later commits. Even fully green CI will not resolve real Genesis/predeploy and live-network gates.

## Remaining work — execution order

### W14.7.4 — global Genesis address decision and migration (BLOCKING, cross-protocol)

- Inventory *every* contract assignment, system mirror, canonical anchor, bridge candidate, predeploy plan, deployment manifest, storage-init binding, wallet inventory, generated address constant, client SDK and runtime reference; establish a single contract-identity-to-address map and disjoint reserved/frozen sets.
- Obtain explicit cross-protocol approval for proposed addresses, including EntryPoint420, Names420 and the remaining non-Wallet anchors; retain frozen economic/consensus roles and reconcile legacy `0x0434`–`0x043b` placements and the `0x043c` bridge collision without aliases.
- Atomically update all authoritative records and address-dependent tests/code/build inputs; remove conflicting obsolete aliases. Verify global uniqueness, contract-identity consistency, cross-file parity, slot bindings and no collision with genesis allocations. Negative tests must reject the old map.
- **Exit:** the real-data namespace verifier and global collision audit both pass on the exact approved map; the `canonicalAddressConflictResolved` release gate is changed only with reviewed evidence, and `readyForLiveTestnet` remains false.

### W14.7.5 — reproducible contracts, constructor storage and Genesis image (BLOCKING)

- Pin compiler, optimizer, EVM version, dependency revisions, source hashes and build inputs; compile runtime bytecode for every approved predeploy, including Wallet authority/EntryPoint contracts as applicable. Prove artifacts are complete and free of unresolved links.
- Generate, independently review and simulate all constructor and post-init storage using compiled layouts and approved operator/beneficiary/verifier inputs; do not invent keys, governance roles, founder beneficiaries, bridge verifier, timestamps or an empty map as evidence.
- Produce the candidate Genesis allocation and manifest; verify address uniqueness, exact runtime-code hashes, storage roots, full planned inventory and deterministic regeneration using W14.7.2/W14.7.3 tooling. Check consensus-system call bindings explicitly.
- **Exit:** reproducible, independently reviewed artifact set and Genesis candidate; still **not** on-chain attested or an enabled Wallet release.

### W14.7.6 — official network manifest and deployment attestation (BLOCKING)

- Publish an approved, versioned testnet manifest with chain ID **and** genesis hash, chain identity evidence, vetted RPC/WSS URLs, explorer/faucet availability and canonical contract addresses/code hashes. Sample/local files are not substitutes.
- Start or qualify the designated testnet from the exact Genesis image; independently read contract bytecode and storage through distinct trusted RPC paths and compare with pinned manifest/artifacts. Verify EntryPoint, factory, registries, Names420, Identity420, bundler/paymaster and dependencies actually exist and are callable as intended.
- **Exit:** signed/reviewed deployment and chain-identity evidence, per-address code-hash/storage attestations and healthy supporting infrastructure. Only then generate environment-specific client config; never set release gates from a reservation or a local fixture.

### W14.7.7 — live Wallet user and integration qualification (BLOCKING)

- Exercise web, extension, developer-facing and mobile wallet on the qualified network: onboarding, import/recovery, account discovery, balance, fee estimation, native/token transfer, signing, rejection/cancel/timeout, wrong-chain guards, transaction receipts/reorg handling and accessibility/error states.
- Exercise canonical smart-account deployment, EntryPoint user operations, bundler/paymaster sponsorship and fallback, capability-scoped dApp permissions and revocation, Names420 resolution-to-recipient safeguards, Identity420, and ecosystem dApp handoffs with real deployed contracts. Keep transfer/sponsorship disabled if any required dependency is absent.
- Complete browser-version and physical Android/iOS device release checks, secure key/backup/storage review, privacy and telemetry review, and negative/adversarial tests (malicious dApp, stale resolver, chain spoofing, replay, account mismatch and RPC disagreement).
- **Exit:** reproducible signed live-testnet test matrix, transaction hashes, screenshots/logs/device results, independently reviewed high-severity issue disposition and a clear per-client readiness decision.

### W14.7.8 — release gates, audit closure and integration to main (BLOCKING)

- Map every original audit finding to a changed file/PR, regression test, environment evidence, reviewer, and explicit disposition; do not mark an issue closed from green synthetic tests alone.
- Reconcile PR #358 and its unusually old/non-main base against the current `main`; evaluate all overlapping Genesis/Wallet/Exchange/AI/Identity/bridge changes, run complete CI and conflict audits on the **actual merge candidate**. Do not directly merge PR #358 merely because its branch CI is green.
- Review deployment inventory gates; enable live sending only after *all* address, official-manifest, code, network-identity, supported-infrastructure and client-qualification evidence passes. Keep controlled rollback and emergency disable procedures.
- **Exit:** independently reviewed release candidate, documented audit closeout, qualified deployment and approved non-draft merge/release decision.

## Immediate next action

Start **W14.7.4**, not a further synthetic-green-only release claim: prepare and approve the complete Genesis namespace reconciliation in coordination with the chain/consensus and all dependent dApps. Until that approval and the downstream W14.7.5–W14.7.8 evidence exist, `readyForLiveTestnet` stays **false**, transfer paths remain fail-closed, and PR #358 remains **draft/unmerged**.
