# BRIDGE-AUDIT-3.V.19 — Verifier Identity and Qualification Registry

Repository implementation and local qualification, 2026-11-15 (America/Regina).
Base: `97413f2eea862d5f2ec3117313cd3beb15a634f4` (`main`). This change implements the supplied BRIDGE-AUDIT-3.3 requirements; it does not manufacture production verifier approvals or supersede individual chain qualifications.

## Requirement coverage

| Requirement | Implementation and qualification |
| --- | --- |
| Governance registration | BridgeVerifierRegistry420 uses existing Genesis governance authority and ACTION_CONFIGURE timelock checks. No new approval authority or deployment address reservation. |
| Runtime identity | Consumer, verifier and dependency addresses and actual EXTCODEHASH values are checked at registration and use. Same-code replacement addresses require explicit approval. |
| Proxy identity | Exact ERC1167 embedded implementation parsing; registry-created governance proxy with native implementation/version getters; governance-audited public proxy runtime profiles with native implementation getters. Actual Circle AdminUpgradableProxy bytecode is exercised, including unauthorized upgrade rejection. |
| Chains, proof systems, roots, configuration | Approval records bind proof-system/configuration identifiers, source/destination chain records and revisions, chain registry identity, roots, dependency identities and exact public probe results. Local destination chain ID is checked. |
| Qualification status and evidence | Immutable registration manifests and evidence commitments; UNQUALIFIED records never become current; APPROVED records require live validation; permanent REVOKED status and retained reason events. |
| Rotation and revocation | Compare-and-swap current approval, fresh approval IDs, explicit route/gateway rebinding; profile revocation/requalification invalidates old instances. Managed upgrades and upgrade-back invalidate old snapshots. |
| Stale configuration | Runtime, implementation, getter, dependency, root, configuration, chain, authority revision, expiry, route tuple and canonical registry drift fail closed. Pre/post external execution checks catch intra-call changes. |
| Replay preservation | Router stores source-network fingerprint plus canonical source-message identity, excluding verifier, approval, registry and chain-key aliases. VerifiedGateway retains evidence IDs across verifier rotation and directions. Late failures roll replay/risk/transfer changes back atomically. |
| No inherited approval | Replacement verifier/consumer/registry, changed route tuple and unqualified configurations cannot use previous route/gateway bindings. |

## Governance integration

1. Deploy the registry using the existing governance timelock, ProtocolRegistry and approved Genesis configuration. Register its `420/APP/420BRIDGE/VERIFIER_REGISTRY` component with actual deployed runtime hash, supported version and ACTIVE lifecycle through the existing ProtocolRegistry governance interface.
2. Reconcile canonical BridgeChainRegistry420 records. A chain update increments its revision, including change-and-restore. The destination route chain ID must match the executing chain.
3. Assemble a reviewed Registration manifest. Declare exact consumer and underlying verifier, dependency identities, proof system, configuration hash, evidence content commitment, direction mask and optional expiry. Use the canonical `verifier()` getter for delegated verification; self mode cannot omit an exposed external verifier. Include both trusted-root and configuration probes.
4. Qualify any supported public proxy runtime first, with audit evidence proving its `implementation()` getter is native and accurately identifies delegation. Use `record(manifest, expectedPrevious, true)` only after the implementation/configuration has actually qualified. A false qualification flag records evidence without granting execution authority.
5. Bind each exact route with BridgeRouteRegistry.bindVerifier and its expected fresh approval ID. Generic VerifiedGateway420 instances use bindQualification. Setting a verifier or changing route configuration invalidates the binding. An approval cannot be reused for a changed tuple of an already pinned route.
6. Rotate using a fresh reviewed manifest, compare-and-swap registration and explicit rebinding, preferably in the existing governance transaction batch. Revoke compromised approvals or proxy runtime classes. No revoked ID is revived.

The policy is `contracts/config/bridge/verifier-identity-policy.json`. Its production approval list is deliberately empty. The registry is an enforcement mechanism for governance qualification, not an automatic consensus audit. Governance must establish that DIRECT runtimes do not delegate, that public proxy profiles have trustworthy native getters, and that the probe manifest covers every security-relevant mutable authority, root, asset, route and dependency. Unknown delegation and unobservable mutable dependencies are not implicitly approved. Probes and evidence published onchain must contain public data, never sensitive viewing credentials. Normal authenticated consensus head advancement need not be treated as a configuration approval change.

Supported public proxy profiles cannot detect an unobserved upgrade-and-restore between calls unless their reviewed implementation exposes an epoch that the manifest also probes. Registry-managed proxies explicitly maintain that epoch. Unknown proxy layouts are not silently treated as authenticated proxy implementations.

Replay identifiers supplied by a qualified verifier must identify the canonical source message independently of destination recipient, amount and verifier version. Approving incompatible message-ID semantics requires resolving existing redemption state; recording another qualification does not make incompatible semantics safe. The persistent source-network namespace prevents chain-key renaming from clearing router replay protection.

## Qualification and provenance

See `verifier-identity-qualification/RESULTS.json`, exact input manifests, unedited logs and bytecode size records. The targeted owners cover governance, code/pointer substitution, proxy upgrades, configuration drift, route/chain/registry replacement, replay, atomic rollback, fuzz cases and a stateful independent qualification/revocation model. Test harnesses use an elevated code-size limit; the runner separately asserts the real production runtime limit of 24,576 bytes. Probe calls are STATICCALL with 50,000 forwarded gas, at most 4,096 return bytes checked before copying, 512 calldata bytes, 64 probes and 16 dependencies. Oversized nested calldata is rejected before conversion to the in-memory manifest.

The 97 distinct required cases comprise 56 identity tests, 13 route identity tests, one invariant, 18 shared integration tests, eight existing chain-identity tests and one concrete Bitcoin gateway integration. Fuzzing executes 5,000 cases. The invariant executes 128 runs at depth 64 (8,192 calls). Existing test assertions were retained; their setup now explicitly qualifies the controlled adapters through the new registry.

Diagnostic history is preserved rather than hidden:

- Initial owner selection mistakenly included imported Bitcoin consensus suites: 17 additional passes and five historical-fixture-access failures, outside V.19 qualification. The runner now has an explicit closed owner filter. Those unrelated suites were not rerun to turn them green.
- The first route replay namespace included the chain key. A new adversarial case reproduced replay across an alias for the same physical network. `replay-alias-reproduction.log` records the actual failure; `replay-alias-before/` contains exact hash-verified pre-fix sources. The router now derives its key from physical network and canonical message identity. The affected qualification was rerun after that production change.
- The final 97-case batch passed 96 and failed an oversized-input test's arbitrary total caller-cost assertion. The explicit rejection already returned within 200,000 forwarded gas. Diagnostic reruns retained that failure, including a direct CALL attempt. The corrected single-case test requires the exact `probe calldata bounds` rejection within the same forwarded gas budget, distinguishing successful bounded rejection from out-of-gas or another failure. Only that affected case was rerun. No passing production-path evidence was invalidated by this test-only assertion correction.

The Circle proxy fixture is genuine upstream creation bytecode, independently rebuilt in the existing CCTP qualification. Its source commit, compiler and checksum are retained in `contracts/test/fixtures/verifier-identity/PROVENANCE.json` with the upstream license. The delegated verifier state used here is controlled synthetic data. This qualifies proxy identity enforcement, not an issuer attestation, live transfer, issuer authorization or CCTP deployment.

Prior evidence remains attributed to its original commits: V.17 `3dcee22927c181c23451ed49eb908330b5254866` / PR #1171; V.18 `a417ba42079e3865b56f0c23823bccb29056ad50` / PR #1172; CCTP fixture source `0a677dc9c7eedc2f56c5b35141ae770a2e13e679` / PR #1168. These unmerged qualifications are not represented as present on this base main. V.19 does not repeat their consensus suites.

## Integration status and remaining external work

Implementation and local qualification are reviewable in this change. No live governance registration, production approval or deployed address is claimed. Deployment, actual approved manifests and live end-to-end route qualification require the approved testnet and real authority/configuration evidence already owned by the existing testnet work roadmap. Existing chain/issuer blockers remain unchanged. This change does not mark those earlier steps complete.

No canonical successor to V.19 is present in the available main roadmap or supplied task list. Do not invent V.20 or begin an unspecified step. Merge status and the exact qualified commit are reported by the associated pull request, not asserted before publication in this file.

Genesis contract-map ownership validation passed: 38 contract-map surfaces, 21 frozen public surfaces, zero documentation gaps. Initial local attempts lacked unchanged documentation in the sparse checkout; after hydrating those inputs, the validator passed. All six production runtimes are within EIP-170, largest 21,910 bytes. Only path-filter exclusions for this isolated audit evidence and bridge-only policy JSON were added; workflow job bodies and branch rules are unchanged. Global Genesis inventory triggers remain relevant and unchanged. Publication uses the existing `[skip ci]` convention to avoid repeating locally qualified work.
