
# 420 Integrated Testnet — Validator Onboarding

## Requirements

A validator must:
- run compatible `fourtwentyd` and `node420`;
- use the frozen testnet genesis bundle;
- independently generate BLS, owner and withdrawal keys;
- provide a BLS proof of possession;
- meet the 42,000 420 effective testnet bond;
- complete probation/readiness;
- satisfy 40 of 42 readiness epochs;
- maintain slashing-protection storage.

## Security

Never send:
- BLS secret key;
- owner private key;
- withdrawal private key;
- seed phrase;
- JWT secret.

Keep the withdrawal key offline. Prefer remote or encrypted consensus signing. Back up the
slashing-protection database.

## Lifecycle

Registration -> probation -> readiness -> eligible -> selected active seat -> 3-rotation term ->
normal cooldown -> eligible again.

The committee uses one-validator/one-seat equal weight. Extra stake does not increase voting weight.

## Liveness

A validator should maintain:
- stable consensus peers;
- synced execution head;
- correct finalized checkpoint;
- compatible protocol version;
- clock synchronization.

Do not sign conflicting blocks, attestations or recovery certificates.
