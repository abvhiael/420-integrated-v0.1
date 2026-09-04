# 420Media Phase 2 — Operator CLI and Secure Signer

Status: implementation branch

This increment adds the first operator-facing configuration and signing boundary for the 420Media node.

## CLI

`cmd/420media-node` provides:
- `version`
- `validate-config -config <path>`
- `show-config -config <path>`

Configuration is JSON and contains only non-secret runtime data plus the *name* of the environment variable holding the signer bearer token. The CLI emits a redacted view and never reads or prints private keys.

## Secure signer

`media/node/ethadapter.HTTPSigner` implements the existing `Signer` interface by sending only `{to, data}` to a separate signing service. The media node never loads ECDSA private-key material.

Security requirements:
- remote signer URLs require HTTPS;
- plain HTTP is accepted only on loopback (`127.0.0.1`, `localhost`, `::1`);
- embedded URL credentials are rejected;
- bearer tokens are loaded from the configured environment variable only at transaction time;
- transaction responses must contain a canonical 32-byte transaction hash;
- signer responses are size-bounded;
- the signer endpoint receives only destination address and ABI calldata.

## Additional invariants

- `MEDIA-NODE-INV-032`: operator configuration never stores raw private keys, mnemonics, or signer bearer-token values.
- `MEDIA-NODE-INV-033`: non-loopback signer traffic requires HTTPS.
- `MEDIA-NODE-INV-034`: signer authentication material is resolved at call time and is never emitted by config inspection commands.
- `MEDIA-NODE-INV-035`: malformed or non-canonical signer transaction hashes fail closed.

## Next Phase 2 steps

1. local Anvil integration tests across the Phase 1 420Media contracts and node adapters;
2. final Phase 2 hardening: immediate cancellation on lease loss, runner error surfacing, health probes, and failure-injection coverage.
