# BNB-6.5 — External provider adapter readiness

Canonical Phase 6 requirement: deployable fail-closed integration contracts/configuration for Identity, Pay/Wallet, Compliance, Search, Travel, Location, and Notifications. Independently controlled production approval remains deferred.

- `services/420bnb/providers.template.v1.json`: exact seven-service schema and explicit role/issuer bindings. Each service requires HTTPS endpoint, mounted independent trust root, a narrowly scoped audience, bounded timeout, redirects prohibited, no automatic retries of side effects and disabled live execution. References in the template are intentionally unresolved; no live credentials, provider approvals or external URLs have been fabricated.
- `services/420bnb/provider_adapters.py`: rejects unknown/missing provider inventory, malformed configuration, cross-provider issuer identity, inline key settings, unsafe HTTPS origin, symlinked mount, unapproved activation, and unproven live acceptance. A completely resolved operator configuration is still denied live activation.
- `tests/test_bnb65_providers.py`: adversarial inventory, issuer/identity, wrong-origin, inline credential, redirect and unauthorized activation checks.
- Existing integrations in `identity.py`, `authority.py`, `travel_location.py`, `discovery_consumer_service.py`, `notification_delivery.py`, Pay observation pipeline and `bnb210_external_acceptance.py` continue to own runtime verification/replay and domain semantics. No adapter in this new configuration file bypasses those existing verifiers.
- Independent issuer approvals, key rotation/revocation, Pay/Wallet chain finality, jurisdiction authority, live Search/Travel network delivery, Location evidence and Notifications provider signoff remain in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`. No fixture or metadata can assert live release acceptance.

**No production activation or provider acceptance is granted by this repository-side Level 1 step.**
