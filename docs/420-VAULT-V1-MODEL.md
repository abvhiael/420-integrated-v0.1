# 420Vault V1 Model

Status: **FROZEN FOR IMPLEMENTATION**

420Vault is the programmable custody, escrow, reserve, beneficiary, and policy-controlled asset protocol for 420 Integrated. User-facing products such as 420Stash, 420Cure, 420Escrow, 420Reserve, 420Treasury, and 420Legacy are policy/configuration profiles over the same Vault primitive and do not create separate custody authority.

## Core rule
A Vault is a canonical asset-holding object whose assets may move only through explicit, versioned, reconstructable authorization and release paths.

## Canonical lifecycle
`ACTIVE -> FROZEN / WINDING_DOWN -> CLOSED`. CLOSED is terminal. FROZEN is non-confiscatory. WINDING_DOWN forbids new obligations while preserving valid settlement/claim paths.

## Canonical Vault types
PERSONAL, ESCROW, TREASURY, RESERVE, COLLATERAL, ROYALTY, BENEFICIARY, PROJECT, COMMUNITY, APPLICATION. Types are descriptive only.

## Policy dimensions
Authorization, asset, release, and accounting policies are independent and versioned. Policy IDs cannot silently change material semantics.

## Accounting
For every Vault/asset the protocol tracks recorded balance, reserved value, claimable value, released value, and derived free balance. `freeBalance = recordedBalance - reserved - claimable`, never below zero. Ordinary withdrawals consume only free balance. V1 claimable obligations are fully collateralized.

## Authorization
Vault actions use the shared 420 Capability Registry with Vault-scoped or narrower route-scoped authorization. Creator, deployer, factory, registry, application identity, Commons role, or product branding never imply custody authority.

## ActionIds
UPDATE_METADATA, UPDATE_AUTH_POLICY, UPDATE_ASSET_POLICY, UPDATE_RELEASE_POLICY, UPDATE_BENEFICIARIES, DEPOSIT, WITHDRAW, TRANSFER, CREATE_OBLIGATION, CANCEL_OBLIGATION, RELEASE_OBLIGATION, CLAIM, FREEZE, UNFREEZE, BEGIN_WIND_DOWN, CLOSE, SETTLE_ESCROW, SETTLE_PROTOCOL, EXECUTE_STREAM.

## Invariants
- **VAULT-INV-001:** `vaultId` is unique and never reassigned.
- **VAULT-INV-002:** creator/deployer/registry provenance does not imply custody authority.
- **VAULT-INV-003:** no outbound asset movement occurs without an authorized action and valid release path.
- **VAULT-INV-004:** no hidden owner, factory, upgrader, governance, or emergency withdrawal backdoor exists.
- **VAULT-INV-005:** one Vault cannot spend or pledge another Vault's assets.
- **VAULT-INV-006:** an obligation cannot settle for more than validly assigned value.
- **VAULT-INV-007:** outstanding claimable obligations are fully collateralized in V1.
- **VAULT-INV-008:** ordinary withdrawals cannot consume reserved or claimable value.
- **VAULT-INV-009:** withdrawal, claim, release, and settlement operations are replay-safe.
- **VAULT-INV-010:** material operations bind stable policy semantics; later policy changes cannot silently weaken them.
- **VAULT-INV-011:** beneficiary entitlements cannot be redirected by unrelated administrators.
- **VAULT-INV-012:** emergency freeze can halt movement but cannot confiscate or redirect value.
- **VAULT-INV-013:** wind-down preserves outstanding obligations and claims.
- **VAULT-INV-014:** closure must not destroy unresolved valid claims or encumbered value.
- **VAULT-INV-015:** CLOSED is terminal and cannot reactivate.
- **VAULT-INV-016:** deposits, withdrawals, obligations, releases, claims, policies, and lifecycle transitions are historically reconstructable.
- **VAULT-INV-017:** a raw asset transfer does not by itself create beneficiary attribution.
- **VAULT-INV-018:** permissions in other 420 protocols do not automatically escalate into Vault custody rights.
- **VAULT-INV-019:** Bridge backing cannot become deployable capital merely by being held through a Vault.
- **VAULT-INV-020:** Vault movement cannot bypass Stake bonding, unbonding, slashing, or withdrawal restrictions.
- **VAULT-INV-021:** emergency authority cannot create a new beneficiary, recipient, or claim.
- **VAULT-INV-022:** every accounting transition preserves exact balance/encumbrance conservation.
- **VAULT-INV-023:** policy semantic identity is stable; material broadening requires a new version/identity.

No new frozen system/predeploy address is allocated by 420Vault V1. Discovery remains through the application/protocol registry layer.