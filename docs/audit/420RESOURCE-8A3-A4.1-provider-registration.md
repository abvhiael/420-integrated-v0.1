# A4.1 — Provider identity and registration

## Canonical policy

ResourceProviderRegistry420 is the authoritative identity registry for relay, store, cache and gateway providers. No existing Resource specification designates an external allocator. ComputeMarket has a separate identity namespace. The Resource registry therefore enforces a deterministic, registry-local operator namespace: the 20-byte operator address followed by a nonzero unsigned 96-bit serial, in big-endian order. Operators may choose distinct serials to operate multiple providers; an identifier is meaningful only with its chain and registry address. The identifier is not a proof of real-world identity, hardware, or collateral. It is immutable and does not support operator rotation in this step.

Direct registration requires the encoded operator. Delegated registration requires both an active canonical REGISTER_PROVIDER scoped capability and prior on-chain consent by the encoded operator to the exact identifier, delegate, metadata and stake reference. Consent is replaceable or revocable before registration, consumed on successful registration, and cannot override duplicate checks. Governance grant authority alone cannot claim an operator's namespace. No registration grants collateral eligibility.

## Compatibility and deployment

The registerProvider selector, Provider tuple, existing storage slots and registration event remain unchanged. The consent mapping is append-only. New helpers expose deterministic derivation and consent. Existing pre-deployment fixtures and SDK callers must derive the identifier before requesting capability grants, collateral and node registrations. A3 typed scope derivation is unchanged. Arbitrary historical identifiers are not reinterpreted or reassigned: if any historical live registrations exist, inventory them and plan a separately authorized migration preserving obligations and history; never blindly rewrite existing provider references. No live migration is asserted here.

## Qualification

The ResourceGenesis suite covers preemption, malformed identifiers, operator substitution, grant-only delegation, copied transactions, modified payloads, revoked consent, successful dual authorization and duplicate registration, including multiple providers per operator. Existing Resource and Storage regression fixtures use canonical IDs without removing custody or lifecycle assertions. SDK tests cover exact encoding and malformed inputs. Compiler comparison must permit only the explicitly reviewed additive ABI and storage delta and retain all previous layout checks. Qualification is pending CI.
