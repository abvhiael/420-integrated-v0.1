# 420 Developer Hub — DEVHUB-7 Templates & Starter Projects

## Status
DEVHUB-7 adds deterministic starter projects and scaffolding on top of DEVHUB-1 through DEVHUB-6.

## Starters
- `sdk-basic` — minimal read-only `@420/sdk` bootstrap;
- `wallet-aware` — wallet integration skeleton that preserves the 420 Wallet signer boundary;
- `protocol-reader` — canonical contract/service discovery without creating a new authority source.

## CLI
`420 templates` lists available starters. `420 create TEMPLATE NAME [TARGET]` delegates to the DEVHUB-7 scaffolder.

## Invariants
- **DEVHUB-INV-040** — starter projects consume canonical network/contract discovery rather than embedding production addresses or chain identity.
- **DEVHUB-INV-041** — wallet-aware starters never own private keys, mnemonics, session authority, or smart-account authorization.
- **DEVHUB-INV-042** — scaffold template IDs come only from the checked-in registry; arbitrary filesystem sources are rejected.
- **DEVHUB-INV-043** — project names reject traversal and unsafe path syntax.
- **DEVHUB-INV-044** — existing targets fail closed and are never silently overwritten.
- **DEVHUB-INV-045** — generated files are deterministic except for the explicit project-name token.

## Exit criteria
DEVHUB-7 is complete when starter templates can be listed and scaffolded from the CLI, hostile path/overwrite cases fail closed, generated content contains no embedded secrets, and Developer Hub qualification remains green.

## Next
DEVHUB-8 adds testnet faucet and developer test-account workflows.
