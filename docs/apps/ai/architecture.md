# 420 AI architecture

Genesis discovery exposes `AIProviderRegistry`, `AIModelRegistry`, `AIJobManager`, `AIJobEscrow` and `AIReputationRegistry` compatibility surfaces.

420AI defines model/version identity, workload class, input commitment, privacy policy, provider constraints, maximum spend, deadline, verification profile and AI-level result/job state. 420 ComputeMarket defines provider/node/resource/offers, accepted matches, execution receipts, verification outcome and settlement entitlement.

Actual inference/training/generation executes off-chain. Provider, matcher and worker infrastructure is replaceable and never gains consensus, governance, bridge, identity, custody or arbitrary Wallet authority.