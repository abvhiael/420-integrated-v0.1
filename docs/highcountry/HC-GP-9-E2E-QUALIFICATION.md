# HC-GP.9 — End-to-End Qualification

HC-GP.9 qualifies the progressive High Country access model across the already-merged HC-GP.1 through HC-GP.8 boundaries.

## Qualified journeys

1. Guest-only play
   - core gameplay is immediately available
   - no registration or wallet prompt is required

2. Registered cloud save
   - registration is optional
   - cloud save may require registration
   - no wallet is required for registration or cloud save

3. Wallet-link transition
   - wallet prompts occur only when the player selects a wallet-only feature
   - persistent linkage and current connectivity are separate states

4. Guest migration
   - shared migration claim is consumed by the target wallet
   - consumed claim is bound to the canonical High Country grower profile
   - migration application is one-time and replay-safe

5. Optional entitlement access
   - wallet linkage alone is insufficient
   - the exact active entitlement is also required

6. Disconnect / reconnect
   - disconnecting a linked wallet does not interrupt core gameplay
   - wallet-only features request reconnect only at their feature boundary

7. Revoked session authority
   - revoked/stale routine session authority fails closed
   - the client escalates to wallet authority rather than silently authorizing the action
   - core gameplay remains available

8. Cross-game attestation
   - a specific active High Country attestation is required
   - no global player-history enumeration is introduced

9. Anti-pay-to-win regression
   - equal ordinary gameplay progress produces equal progression regardless of wallet linkage
   - wallet state does not grant cultivation yield, capacity, genetics quality, equipment stats, BUDS generation, land stats, or ordinary progression advantage

## Scope

This qualification is a deterministic repository-level E2E harness. It does not claim physical-device, production-network, or live-testnet certification. Those require deployment and environment-specific evidence.

## Core invariant

The wallet is a key, not a tollbooth: High Country remains playable without a wallet, while optional ecosystem features become available contextually when the player chooses to use them.
