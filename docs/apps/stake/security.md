# 420 Stake security

Never disclose validator signing keys, Wallet private keys, recovery secrets or remote-signer credentials. Validator signing authority must remain separate from ordinary frontend/session credentials.

Canonical value and lifecycle authority is split deliberately:

- `ValidatorRegistry` owns validator lifecycle records and native-420 collateral custody.
- `CommunityValidatorReserve` owns matched protocol credit.
- `fourtwentyd` owns committee, proposer, finality, reward and slash adjudication.
- `ConsensusSystemCall420` is the only execution gateway for consensus-owned lifecycle/slash/reward writes.
- `RewardController` records consensus-issued reward accounting but does not compute issuance policy.
- `Stake420`, Wallet, Indexer, Explorer, Search and Analytics are read/presentation surfaces and must not become authority.

Every principal slash requires non-zero finalized evidence and the same evidence commitment is single-use in `ValidatorRegistry`. Reward application is bound to the current execution block and is single-use per block; the participant list is bounded by the maximum active committee and rejects zero, duplicate, or proposer-as-participant entries.

Do not rely on cached Stake/Indexer state for safety-critical signing, exit, slash, reward, or withdrawal decisions. Recheck canonical validator lifecycle and consensus state.

The broader Genesis interface-layer safety integration remains a separate release gate: the frozen dependency matrix names ProtocolRegistry, pause/health, capability, system-safety, initialization/migration, replay, chain-context and metadata dependencies for 420Stake. Those requirements must be reconciled against the runtime contracts before Genesis qualification; documentation alone does not satisfy that gate.
