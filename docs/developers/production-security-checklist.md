---
title: Production and security checklist
audience:
  - developer
category: developer
status: development
version: current
---

# Production and security checklist

Use this checklist before treating a 420 Integrated application or service release as a production candidate. It does not replace project-specific security review, protocol governance, operational launch evidence or the repository release-readiness process.

## Environment and chain binding

- Select one explicit environment manifest.
- Verify chain ID and the environment-specific identity/fingerprint required by the integration.
- Never fail over across local/devnet/testnet/mainnet boundaries.
- Resolve RPC/WSS, Registry, Indexer, Verify and other services from approved environment metadata rather than hard-coded assumptions.
- Reject a response whose chain/environment identity does not match the selected release target.

## Contract and deployment provenance

- Resolve the canonical service/version/interface before composing calls.
- Confirm implementation code exists at the declared address.
- Confirm runtime-code or implementation identity against the release evidence.
- Treat proxy/admin/implementation relationships explicitly.
- Keep deployment planning non-custodial and hand signing to the declared signer/Wallet boundary.
- Confirm the deployment receipt and required finality from canonical RPC.

## Wallet and signing isolation

- Never request or persist a user's seed phrase, private key, passkey secret or Wallet signing material.
- Distinguish connection from authorization.
- Build bounded intents and let Wallet/SmartAccount420 perform simulation/review/signing.
- Revalidate account/capability/session state before sensitive execution.
- Scope reusable authority by target, selector, limits and validity where supported.
- Expect authorization-epoch changes to invalidate stale reusable authority.
- After recovery or authority changes, fail closed until the current authority is re-established.

## Reads, Indexer and finality

- Use canonical RPC/owning contracts for security-sensitive truth.
- Label 420Indexer/search/analytics results as derived/rebuildable projections.
- Preserve network, block/hash/cursor and finality provenance where decisions depend on freshness.
- Handle reorgs and duplicate event delivery idempotently.
- Do not convert optimistic or indexed state into canonical ownership, settlement, Registry legitimacy or entitlement.
- Define the required confirmation/finality level per action rather than using one generic "confirmed" state.

## Replay, retry and idempotency

- Define the protocol/transaction/application identity that prevents duplicate execution.
- Retry read-only operations only within bounded deadlines/backoff policy.
- Retry state-changing operations only when the owning interface is demonstrably idempotent or canonical state proves the first attempt did not take effect.
- After an uncertain broadcast, query transaction, nonce and owning-protocol state before preparing another write.
- Carry correlation identifiers through request, transaction, receipt, event and projection diagnostics.

## Secrets and private data

Do not place raw secrets in source, docs, logs, CI artifacts, qualification evidence or support bundles. This includes:

- private keys and seed phrases;
- passkey/session signing material;
- bearer tokens and API secrets;
- passwords;
- validator/Engine secrets;
- private prompts, datasets or documents where the protocol only requires a commitment;
- storage plaintext, decryption keys or private shard metadata.

Use commitments, references, redacted evidence or secure external secret stores instead.

## Provider-backed integrations

For Storage/Resource, AI/Compute, Bridge and other replaceable providers:

- bind provider/service/offer/route/model/resource identity before execution;
- bind spend, deadline, privacy and verification constraints before execution;
- treat provider receipts/proofs/attestations as evidence only within their declared verifier semantics;
- require the owning protocol's authorization, risk, replay and settlement gates independently;
- preserve historical evidence when replacing or suspending a provider;
- fail closed when the bound verifier, route, provider or canonical dependency becomes ineligible.

## Bridge-specific checks

- Display/record exact external network identity and canonical local asset representation, not ticker alone.
- Verify route direction and live route status.
- Verify the configured source-finality rule.
- Verify adapter/verifier identity.
- Recheck asset eligibility, risk limits and replay state after proof verification.
- Treat destination value as complete only at the canonical terminal state/finality required by the route.

## Gaming-specific checks

- Core gameplay remains available without a 420 Wallet unless the game documents a separate non-420 requirement.
- Guest saves, routine progression and anti-cheat stay off-chain by default.
- Pin the client to the expected registered game namespace.
- Use exact-scope entitlement, claim and attestation lookups.
- Do not expose or rely on a canonical wallet-wide player-activity enumeration surface.
- Keep SmartAccount420/CapabilityRegistry420 as the Wallet/session authority.
- Ensure Wallet linkage itself does not grant an automatic pay-to-win statistical advantage.

## Verification, Registry and AppStore

- Treat 420Verify output as reproducibility evidence, not a security audit or endorsement.
- Recheck canonical code and Registry state before publication.
- Confirm the expected next Registry version.
- Preserve governance-only publication authority; Developer Hub must not sign or bypass it.
- Treat AppStore discovery metadata as non-canonical presentation state.

## Developer qualification evidence

DEVHUB-18 developer qualification should be evaluated against its versioned profile. Required evidence includes network binding, authority boundaries, secret rejection, Wallet isolation, Indexer provenance, service-auth isolation, automated tests, dependency/release review and production transport policy where applicable.

A `PASS` means the supplied evidence satisfied that profile. It does not mean the application is vulnerability-free or that an external security audit occurred.

Exact-head CI handoff evidence must bind every required successful workflow to the same candidate commit SHA. Stale or different-SHA evidence must fail closed.

## Production launch evidence

DEVHUB-19 consumes three independent inputs:

1. DEVHUB-18 qualification;
2. DEVHUB-18 exact-head CI handoff;
3. repository `release/readiness.json`.

Developer tooling may report a release candidate `READY` only when all required inputs are explicitly ready. It cannot infer readiness from the existence of code, manifests or successful local tests.

At DOC-9 closeout, `release/readiness.json` still records `public_testnet_ready: false` with blocked production dependency, live Engine, real-node, partition/restart and production-soak evidence. This is an operational launch constraint, not a failure of the developer documentation phase.

## Minimum release evidence package

Keep a redacted release package containing at least:

- exact candidate commit SHA;
- target network/environment identifier;
- build/artifact provenance;
- deployment/verification/Registry evidence as applicable;
- required workflow results bound to that SHA;
- dependency/release review evidence;
- project-specific threat/risk review notes;
- known limitations and recovery procedures;
- the independent release-readiness result for production launch candidates.

The package must contain references and redacted evidence, never raw signing or service credentials.

## Related documentation

- [End-to-end developer examples](end-to-end-examples.md)
- [Errors, retries and idempotency](errors-retries-and-idempotency.md)
- [Diagnostics and correlation](diagnostics-and-correlation.md)
- [Verification and evidence](verification-and-evidence.md)
- [Registry and publishing](registry-and-publishing.md)
- [DOC-9 coverage audit](coverage-audit.md)
