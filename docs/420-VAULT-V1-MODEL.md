# 420Vault V1 Model

Status: **FROZEN FOR IMPLEMENTATION**

420Vault is the programmable custody, escrow, reserve, beneficiary, and policy-controlled asset protocol for 420 Integrated. User-facing products such as 420Stash, 420Cure, 420Escrow, 420Reserve, 420Treasury, and 420Legacy are policy/configuration profiles over the same Vault primitive and do not create separate custody authority.

## Core rule
A Vault is a canonical asset-holding object whose assets may move only through explicit, versioned, reconstructable authorization and release paths.

## Canonical lifecycle
The only valid V1 lifecycle transitions are:

- `ACTIVE -> FROZEN`
- `FROZEN -> ACTIVE`
- `ACTIVE -> WINDING_DOWN`
- `FROZEN -> WINDING_DOWN`
- `WINDING_DOWN -> CLOSED`

`WINDING_DOWN` cannot return to `ACTIVE` or detour through `FROZEN`; `CLOSED` is terminal. `FROZEN` is non-confiscatory. New deposits, withdrawals, and new obligations require `ACTIVE`. Existing released claims remain payable while frozen. Existing obligations may be released or cancelled during `WINDING_DOWN` through their explicit authorization paths. Closure requires zero canonical recorded asset positions and zero unresolved obligations.

## Canonical Vault types
PERSONAL, ESCROW, TREASURY, RESERVE, COLLATERAL, ROYALTY, BENEFICIARY, PROJECT, COMMUNITY, APPLICATION. Types are descriptive only.

## Policy dimensions
Authorization, asset, release, and accounting policies are independent and versioned. Policy IDs cannot silently change material semantics. A Vault registration must bind an active policy of the correct class for every canonical policy slot.

The generic V1 Vault primitive commits these policy identities but does not pretend that an opaque `semanticsHash` is executable logic. Specialized product/adaptor implementations are responsible for enforcing any additional asset eligibility, timelock, vesting, oracle, multisig, streaming, escrow, or other product-specific semantics declared by their referenced policies. The generic primitive itself enforces capability authorization, lifecycle, exact custody accounting, obligation conservation, replay protection, and beneficiary integrity.

## Registration
A Vault address cannot be registered merely because a caller names it. The candidate Vault must prove that it was instantiated for the same `vaultId`, points to the same registry, and names the registering caller as its intended registration creator. Factory/deployer provenance still does not confer custody authority.

## Accounting
For every Vault/asset the protocol tracks recorded balance, reserved value, claimable value, released value, and derived free balance. `freeBalance = recordedBalance - reserved - claimable`, never below zero. Ordinary withdrawals consume only free balance. V1 claimable obligations are fully collateralized.

The accounting layer additionally tracks unresolved-obligation count and nonzero canonical asset-position count so a Vault cannot close while value or claims remain in canonical accounting.

Raw ERC-20 transfers sent directly to the Vault do not create canonical accounting or beneficiary attribution. Native deposits through the Vault receive/deposit entrypoint are accounted. Supported ERC-20 deposits and outbound transfers must exhibit exact balance deltas; fee-on-transfer or otherwise non-conserving token behavior is rejected by the generic V1 primitive. Asset-policy adapters must not admit assets whose balance semantics invalidate Vault collateral accounting.

## Obligation lifecycle
Canonical V1 obligation states are:

- `RESERVED`
- `CLAIMABLE`
- `CLAIMED`
- `CANCELLED`

Only a `RESERVED` obligation may be cancelled. Release moves `RESERVED -> CLAIMABLE`. Claim moves `CLAIMABLE -> CLAIMED`. Once claimable, the beneficiary entitlement cannot be cancelled or redirected by an unrelated administrator.

## Authorization
Vault actions use the shared 420 Capability Registry with Vault-scoped or narrower route-scoped authorization. Creator, deployer, factory, registry, application identity, Commons role, or product branding never imply custody authority. Authorization is checked before custody/accounting mutation for outbound and obligation actions. Operation IDs provide Vault-local replay protection.

## ActionIds
UPDATE_METADATA, UPDATE_AUTH_POLICY, UPDATE_ASSET_POLICY, UPDATE_RELEASE_POLICY, UPDATE_BENEFICIARIES, DEPOSIT, WITHDRAW, TRANSFER, CREATE_OBLIGATION, CANCEL_OBLIGATION, RELEASE_OBLIGATION, CLAIM, FREEZE, UNFREEZE, BEGIN_WIND_DOWN, CLOSE, SETTLE_ESCROW, SETTLE_PROTOCOL, EXECUTE_STREAM.

## Invariants
- **VAULT-INV-001:** `vaultId` is unique and never reassigned.
- **VAULT-INV-002:** creator/deployer/registry provenance does not imply custody authority.
- **VAULT-INV-003:** no outbound asset movement occurs without an authorized action and valid release path.
- **VAULT-INV-004:** no hidden owner, factory, upgrader, governance, or emergency withdrawal backdoor exists.
- **VAULT-INV-005:** one Vault cannot spend or pledge another Vault's assets.
- **VAULT-INV-006:** an obligation cannot settle for more than validly assigned value.
- **VAULT-INV-007:** outstanding claimable obligations are fully collateralized in V1 for supported admitted assets.
- **VAULT-INV-008:** ordinary withdrawals cannot consume reserved or claimable value.
- **VAULT-INV-009:** withdrawal, claim, release, cancellation, and settlement operations are replay-safe.
- **VAULT-INV-010:** material operations bind stable policy semantics; later policy changes cannot silently weaken them.
- **VAULT-INV-011:** beneficiary entitlements cannot be redirected by unrelated administrators.
- **VAULT-INV-012:** emergency freeze can halt new movement but cannot confiscate or redirect value; already-released beneficiary claims remain valid.
- **VAULT-INV-013:** wind-down preserves outstanding obligations and claims and cannot transition back into ordinary ACTIVE operation.
- **VAULT-INV-014:** closure is forbidden while any canonical recorded asset position or unresolved obligation remains.
- **VAULT-INV-015:** CLOSED is terminal and cannot reactivate.
- **VAULT-INV-016:** deposits, withdrawals, obligations, cancellations, releases, claims, policies, and lifecycle transitions are historically reconstructable.
- **VAULT-INV-017:** a raw asset transfer does not by itself create beneficiary attribution or a canonical obligation.
- **VAULT-INV-018:** permissions in other 420 protocols do not automatically escalate into Vault custody rights.
- **VAULT-INV-019:** Bridge backing cannot become deployable capital merely by being held through a Vault.
- **VAULT-INV-020:** Vault movement cannot bypass Stake bonding, unbonding, slashing, or withdrawal restrictions.
- **VAULT-INV-021:** emergency authority cannot create a new beneficiary, recipient, or claim.
- **VAULT-INV-022:** every accounting transition preserves exact recorded-balance/encumbrance conservation.
- **VAULT-INV-023:** policy semantic identity is stable; material broadening requires a new version/identity.
- **VAULT-INV-024:** every registered policy reference must be active and match the canonical policy class of its Vault slot.
- **VAULT-INV-025:** a Vault address cannot be registered by an account other than its bound registration creator.
- **VAULT-INV-026:** generic V1 ERC-20 deposits and outbound transfers must conserve the exact requested token amount at the Vault boundary.
- **VAULT-INV-027:** authorization is established before a claim or other outbound economic state transition is committed.
- **VAULT-INV-028:** a CLAIMABLE obligation cannot be cancelled back into free balance.
- **VAULT-INV-029:** a Vault in WINDING_DOWN cannot escape wind-down through another lifecycle transition.
- **VAULT-INV-030:** product-specific policy semantics not enforced by the generic primitive must be implemented by an explicit versioned adapter/module; a policy reference alone never creates hidden executable semantics.

No new frozen system/predeploy address is allocated by 420Vault V1. Discovery remains through the application/protocol registry layer.
