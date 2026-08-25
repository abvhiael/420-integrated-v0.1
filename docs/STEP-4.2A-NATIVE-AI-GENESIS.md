# Step 4.2A — Native AI Genesis Preparation

Status: **ENCODED**

420 Integrated reserves a native distributed AI protocol surface from genesis.

## Node roles

- `fourtwentyd` — consensus
- `node420` — execution
- `420ai` — distributed AI compute

`420ai` is a protocol-recognized node role, but it is **not required for chain liveness**.

## Architectural boundary

AI model inference does not run in EVM execution or in consensus.

`420ai` providers perform GPU/accelerator workloads off-chain. The 420 blockchain provides the economic,
identity, registry, commitment, and settlement layer.

On-chain responsibilities include:
- provider registry;
- model/version registry;
- job publication/identifiers;
- escrow;
- payments in native 420;
- provider staking/bonding;
- model/job/result commitments;
- reputation;
- attestations/dispute hooks.

Large model files, prompts/media, and generated outputs remain off-chain. Their hashes/commitments may be
recorded on-chain.

## Reserved system addresses

- `0x...042F` AIProviderRegistry
- `0x...0430` AIModelRegistry
- `0x...0431` AIJobManager
- `0x...0432` AIJobEscrow
- `0x...0433` AIReputationRegistry

These addresses are inside the already-reserved `0x...0420`–`0x...04FF` protocol range.

## Domain namespace

- `420/AI_PROVIDER`
- `420/AI_MODEL`
- `420/AI_JOB`
- `420/AI_RESULT`
- `420/AI_ATTESTATION`
- `420/AI_PAYMENT`
- `420/AI_DISPUTE`

## Security invariants

Registration as a 420ai provider:
- grants no consensus vote;
- does not make the provider a validator;
- does not make model output consensus truth;
- cannot bypass normal wallet/user authorization;
- cannot alter finality.

Paid jobs may escrow and settle native 420, but AI jobs do not mint currency.

## Genesis/liveness invariant

The AI protocol surface exists from genesis, but genesis and ordinary chain liveness do not require any
GPU provider to be online. This prevents the AI subsystem from becoming a dependency for block
production or finality before the distributed compute network matures.
