# GROW-02 — Canonical identity decision

**Roadmap:** GROW-02 — Canonical identity decision (do not renumber).  
**Decision:** **CONSUMER_ONLY / NO_NEW_PROTOCOL_SERVICE_ID** for the bounded read-only GROW-01 scope.  
**Scope of this decision:** app identity/trust and the absence of protocol authority. This is not Genesis admission, independent service registration, endpoint publication, or completion of GROW-03 through GROW-10.

## Source-traced rationale

1. `docs/audit/420GROW-GROW-01-PRODUCT-DEFINITION.md` limits this implementation to public FARM/BUSINESS Place discovery from shared 420Location. It creates no new ownership, settlement, wallet authority or chain writes.
2. `docs/genesis-services/GEN-SVC-2-LOCATION-EVENTS.md` and `config/420location-events-genesis.json` explicitly name 420Grow as a consumer; 420Location owns provider-neutral Place indexing and provenance. A Grow display does not turn its records into Registry records.
3. `docs/genesis-services/GEN-SVC-0-ROADMAP.md` and `config/genesis-consumer-services.json` prohibit implicit promotion or authority elevation. A new Genesis-facing application needs an explicit frozen-catalog decision.
4. `config/genesis-applications.json` remains FROZEN and contains no 420Grow application. `contracts/src/libraries/ServiceIds420.sol` contains no Grow protocol ID.
5. `docs/420WALLET-W14.5-APP-CATALOG.md` and `wallet/web/core/genesis-app-catalog.js` deliberately identify Grow as lacking a canonical service ID; Wallet launch URLs require verified manifest discovery.

**Rejected option A:** allocate `420/service/grow/v1` just to launch a read-only UI. This would invent an independent Genesis service role without a distinct authority or explicit catalog decision, and create a false protocol trust claim.

**Rejected option B:** alias Grow to the 420Location ID or to 420Market, 420Registry or another protocol ID in Wallet. Displaying a branded consumer with an upstream service's ID conflates authority and origin; a verified upstream ID does not verify the consumer's branding or endpoint.

**Selected:** Grow is an unregistered, non-authoritative branded consumer. It can read appropriately public 420Location Place data as a normal client. Its identity is **not** inferred from an upstream canonical service, a map-provider alias, a Registry Place record, or a website domain.

## Canonical and noncanonical identity boundaries

- **Protocol service ID:** none created or reserved for Grow. Do not add a GROW constant to ServiceIds420 or a Grow service record to the frozen catalogs.
- **ProtocolRegistry:** do not register Grow as a protocol service, assign ownership, publish a Grow Registry key or allocate a frozen/reserved address during this step. Display upstream Place Registry references only with their true source and provenance.
- **Wallet:** keep Grow in the named unresolved-product list, not in `GENESIS_APP_SERVICES`. Do not create an enabled launch URL or co-opt an upstream service's ID. Wallet's verified-manifest fail-closed requirement remains enforced.
- **AppStore / links:** possible future **non-canonical application listing**, only once its publication policy is explicitly defined and evidence of authentic app origin and safe URL handling is available. No hardcoded, guessed or implicit URLs now.
- **Identity / authorization:** public reads require no Smart Account or wallet connection. No new application-owner privileges, verified-business status, business claims, signing or private-coordinate access are created by this decision.
- **Chain and network:** a read-only public place display can operate without a chain transaction; when it represents chain-derived Registry/Verify status, the source chain and provenance must be matched explicitly and fail closed on unknown/wrong chain.
- **Backend and endpoints:** the 420Location service remains authoritative for its own Place data contract (not protocol ownership); Grow cannot attest an upstream Place or claim independent Registry authenticity.
- **Security invariant:** there must be no path from a Grow display label or provider-specific ID to wallet execution, contract permissions, service registry changes, public coordinate precision escalation, or invented verification.
- **Release status:** pre-implementation, pre-Genesis-approved. No testnet/Genesis/production readiness is granted here.

## Conditions that reopen the decision

If an approved new product specification requires an independently discoverable canonical service, authority-bearing registration, custody, settlement, grower claims, token rewards, production Wallet launch integration, or a new on-chain contract, open an **explicit protocol/catalog decision** before adding a service ID, deployment reservation, manifest or Wallet entry. Reconcile `ServiceIds420.sol`, `config/genesis-applications.json`, relevant consumer catalog, frozen-address maps, Registry/Wallet contracts, security reviews and qualification evidence together. No partial identifier-only promotion.

## Acceptance criteria — app-specific Level 1

1. Explicit selected option, rejected alternatives, source authority and release classification.
2. No Grow protocol service ID, Genesis app/service entry, reserved/frozen address or Wallet canonical launch entry.
3. Consistent Wallet unresolved-product marker; no alias to 420Location or another service.
4. No new privilege, payment, signature, contract or private-location capability.
5. App-local verifier and affected CI path trigger validate invariants on the exact implementation SHA.
6. Evidence records run ID, job/conclusion, implementation/evidence SHAs, base/main, relevant failure/skips and milestones honestly.
7. No broad Solidity/Genesis/Docs qualification required for this documentation-only identity decision; Level 2 integration only when app dependencies converge and Level 3 at phase closeout.

**Next canonical roadmap step:** **GROW-03 — Shared location consumer**.
