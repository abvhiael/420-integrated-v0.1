# 420 Developer Hub — DEVHUB-4 Wallet / Smart-Account SDK Integration

## Status
DEVHUB-4 adds a typed wallet integration layer to `@420/sdk` without moving signer, session-key, smart-account, or capability authority into the Developer Hub.

The integration mirrors the existing 420 Wallet model: wallet providers expose connected accounts and chain identity; `SmartAccountFactory420` derives/discovers canonical smart accounts; `CapabilityRegistry420` remains the canonical capability authority; session execution is delegated to the qualified Wallet runtime and EntryPoint transport.

## Initial surface

- connect to an injected 420-compatible wallet provider;
- fail closed when the connected wallet chain differs from the SDK network;
- resolve `SmartAccountFactory420` and `CapabilityRegistry420` from the verified DEVHUB-2 catalogue;
- discover the controller's canonical smart account through an injected Wallet runtime adapter;
- reject non-canonical factory or capability-registry identities returned by the runtime;
- prepare, submit, and confirm session user operations through the Wallet runtime boundary;
- keep signing and session-key authority outside SDK core.

## Existing Wallet relationship

The current Wallet implementation performs deployed smart-account state reads, deterministic factory discovery, session preflight, EntryPoint simulation, signature collection, revalidation, broadcast, confirmation, and nonce checks. DEVHUB-4 does not duplicate those rules. It exposes typed orchestration around that runtime so applications can use one stable SDK entry point.

## Invariants

- **DEVHUB-INV-021** — connected wallet chain identity must equal the SDK network chain exactly.
- **DEVHUB-INV-022** — smart-account factory identity must originate from the verified contract catalogue.
- **DEVHUB-INV-023** — capability-registry identity must originate from the verified contract catalogue.
- **DEVHUB-INV-024** — SDK wallet integration must not hold private keys, sign autonomously, or silently acquire signer authority.
- **DEVHUB-INV-025** — session preparation, signing, revalidation, broadcast, and confirmation remain delegated to the qualified Wallet runtime.
- **DEVHUB-INV-026** — runtime-reported non-canonical wallet authority contracts fail closed.

## Exit criteria

DEVHUB-4 is complete when:

1. `@420/sdk` exposes a typed wallet/smart-account integration surface;
2. connected chain mismatch fails closed;
3. canonical smart-account factory and capability registry are resolved from DEVHUB-2 metadata;
4. smart-account discovery validates runtime authority identities;
5. session lifecycle calls pass through the Wallet runtime adapter rather than reimplementing policy;
6. tests cover successful binding, chain mismatch, authority mismatch, and signer-boundary behavior.

## Next

DEVHUB-5 builds the reproducible local development network and developer bootstrap workflow.
