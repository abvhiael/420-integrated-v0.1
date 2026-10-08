# GROW-06 — Contracts: scoped no-contract determination

**Canonical step:** GROW-06 — Contracts. **Level 1:** app-scoped gate. **Decision:** NO_GROW_AUTHORITY_BEARING_CONTRACT_REQUIRED under the approved bounded GROW-01–05 design.

## Canonical rationale and exit criteria

- GROW-01 defines a public, read-only farm/business Place discovery client of shared 420Location.
- GROW-02 explicitly selects CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID, prohibiting implicit Genesis service admission, a Wallet launch manifest, app-specific protocol ownership and new chain writes.
- GROW-03 binds public Places to GEN-SVC-2's versioned read-only SDK, retains upstream source and Registry record reference as *non-endorsement* provenance, and rejects approximate/private coordinate escalation.
- GROW-04 renders only the public projection and leaves claims, editing, wallet execution, payments and signing unsupported.
- GROW-05 implements only GET discovery, bounded filters/pagination, no Grow DB or indexer, no mutations, no identity/escrow/protocol authority.

No approved spec calls for Grow-owned token, payment, staking, custody, claim, settlement, owner-verification, governance or other contract. Creating any contract, address or service ID would violate the frozen Genesis app and catalog decisions. Therefore GROW-06 is a **negative authorization decision** with enforceable repo checks, not permission to invent inert Solidity or treat another app's contracts as Grow's own.

## Contract accounting and security applicability

| Category | GROW-06 disposition |
|---|---|
| Solidity contract, inherited ABI, constructor and bytecode | Not applicable — none required or introduced |
| Deployment wiring, CREATE2, factory, frozen address and Registry admission | Not applicable — no Grow contract/Genesis service |
| Token/fund custody, balances, allowances, escrow or fees | Not applicable — no value moves |
| Roles, privileged ownership, claims, signatures, replay or reentrancy | Not applicable at Grow contract layer — no writes/signatures |
| Chain reorg/invariant and settlement verification | Not applicable at Grow contract layer — only upstream public projections |
| 420Location source privacy, provenance and read-only SDK | Enforced by app Go/web tests in GROW-03–05 |
| Wallet/Registry service manifest and protocol ID | Must remain absent for Grow; cannot alias 420Location's identity |
| Later production deployment and app integration | Reserved for GROW-07/GROW-10; does not authorize new contract |

If a later approved scope requires authoritative chain activity, REOPEN GROW-02 and explicitly authorize service-ID/catalog/address/security/deployment changes; then add dedicated contracts, Foundry invariants and exact-SHA qualification under Solidity Contracts. Never silently promote this consumer.

## Targeted verification

`scripts/verify-grow-06.py` checks this determination against GROW-01/02/06, frozen catalogs, named Wallet marker, service ID declarations, and the explicit absence of Grow-owned Solidity sources/chain deployment. GROW-01–05 fast workflow retains app regressions. The verifier is a guard against future unauthorized authority-bearing drift, not a substitute for the canonical full Foundry inventory at Level 3.

**Milestone:** No new material shared contract authority. Level 2 accumulated integration remains GROW-03–07 milestone; Level 3 full Solidity owned once by Solidity Contracts, Genesis address-authority separately at phase closeout.

**Next exact canonical step:** GROW-07 — Cross-app qualification.
