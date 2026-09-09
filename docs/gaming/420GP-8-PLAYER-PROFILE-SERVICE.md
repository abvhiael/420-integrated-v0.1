# 420GP-8 Player/Profile Service

## Purpose
Provide the off-chain account, cloud-save, wallet-link, and migration orchestration boundary used by 420 Gaming clients without making conventional account data canonical chain state.

## V1 responsibilities
- conventional account records remain off-chain;
- game profiles are scoped by account + game;
- cloud-save references remain off-chain;
- wallet linkage is explicit and game-scoped;
- migration preparation stores only commitments/hashes required to issue `GameClaims420` claims;
- claim issuance is replay-safe at the service boundary;
- the service never owns player signing keys or SmartAccount authority.

## Privacy invariants
The service API must not publish or write on-chain raw guest saves, passwords, credential material, email addresses, device identifiers, or a cross-game activity dossier. Cross-game sharing continues through explicit entitlements/attestations.

## Authority split
- service: account/cloud-save orchestration and migration preparation;
- `GameClaims420`: canonical target-bound migration claim;
- `GameIdentity420`: canonical wallet/game profile;
- `GameEntitlements420`: canonical optional entitlements;
- `CrossGameRegistry420`: canonical scoped cross-game attestations;
- `SmartAccount420` / `CapabilityRegistry420`: wallet/session authority.

## Next increments
1. persistent datastore adapter and account/session repository;
2. authenticated HTTP/service API;
3. SDK adapter implementation;
4. `GameClaims420` issuance adapter;
5. cloud-save provider abstraction;
6. observability, rate limits, retention, recovery, and privacy controls.
