# HC-NEXT-6.2 — Licensing and rights

## Canonical boundary

**In-game economic rights are permissions inside High Country only.** Parcel ownership in `LandRegistry`, a `LeaseRegistry` tenant position, a gameplay collectible, a rent receipt, and any High Country permission cannot constitute a real-world deed, tenancy, agricultural authorization, cannabis cultivation licence, IP assignment, trademark licence, franchise right, commercial endorsement, or ecosystem protocol/app authorization. Game payments are never statutory rent, tax, royalties or legal fees.

**External legal or ecosystem licensing is separate, opt-in and independently authoritative.** It requires its own issuer, legal instrument or deployed protocol authorization, subject matter, jurisdiction, effective dates, chain/network and identity binding, revocation checks and verified evidence. HC-NEXT-6.2 **does not issue or verify** those external rights. The game API returns `allowed:false` for every supported external category. No token metadata, self-assertion, signed player message, owner claim or game-land entitlement can upgrade that result.

## Executable v1 entitlement contract

`GameplayLicensing.evaluate(session,{parcelId,namespace,capability})` requires a registered player, a safe canonical parcel id, an allowlisted namespace and capability, current canonical parcel/plant/lease state, and live authenticated visibility inherited from `LandLeaseAccounts`.

- `highcountry.game.v1`: `cultivate` only with the current canonical cultivating owner or a live matching lease cultivation scope; `terminate-plants` only within the authenticated current owner/occupant and canonical plant lifecycle; `view-rent` only on a matching lease with current owner or occupant; `assign-occupancy` only for current owner with cleared occupancy and no active plants.
- `external.unverified`: `real-property`, `statutory-cultivation`, `trademark`, `copyright`, `patent`, `commercial-brand`, `ecosystem-app`, `protocol-operator`, `off-chain-distribution` always return DENY with `externalLicenceVerified:false`. All other names and mixed namespaces are rejected.
- A result is a point-in-time authorization observation, **not** an enduring licence, signed credential, transferrable token, or permission to bypass canonical contract admission. All mutations must independently re-check their own on-chain authority and emergency controls. Ownership transfer preserves existing plants but invalidates a stale lessor for new cultivation.
- Refusal and disagreement fail closed. Do not expose third-party parcel detail to unregistered/unauthorized callers, allow arbitrary caller-supplied licence metadata, or infer permission from client-provided `allowed` fields.

HTTP (POST, authenticated): `/land/license/evaluate` requires exactly `{ "parcelId": 11, "namespace": "highcountry.game.v1", "capability": "cultivate" }`. Runtime must have a trusted, finalized canonical land/lease/plant adapter; otherwise this endpoint is disabled. No write endpoints for legal/licensing grants are added.

## Qualification and remaining deployment gate

Level 1: `node --test test/gameplay-licensing.test.js test/land-lease-accounts.test.js` under `services/highcountry-economy`. Level 2: affected economy `npm test` and ordinary/canonical composition tests. Preserve previously qualified HC-NEXT-6.1 Solidity evidence: this step does not modify Solidity.

Deployment acceptance **remains gated** on independently provisioned finalized-chain adapters, chain ID and contract address binding, real role/issuer verification, emergency-mode checks, settled receipt validation, and negative integration tests in a production-equivalent environment. Do not label off-chain legal licensing issued, verified, or production-ready from this service alone. Separate legal counsel and external protocol teams define any future genuine external entitlement system.
