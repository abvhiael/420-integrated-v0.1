# Step 2 — Code Archaeology and Ancestry Report

Date: 2026-08-23
Status: **provisional source archaeology complete; exact byte-level ancestry diff remains dependent on full historical Git mirrors**

## Executive finding

The surviving evidence establishes three distinct layers that must not be conflated:

1. **Upstream Go-Ethereum** supplied the overwhelming majority of the client architecture.
2. **WhaleCoin** introduced a genuinely custom reward path and the social/follower reward concept.
3. The surviving **PUFFScoin / early 420 Integrated** repository is a later Ethereum-derived client whose visible 2019 Ethash reward path no longer contains WhaleCoin's custom follower/developer reward hook. It instead uses a conventional Ethereum-style reward accumulator with a flat 5-PUFFS block reward.

Therefore the modern 420 Integrated project should treat WhaleCoin as **design ancestry**, not as code that must be mechanically forward-ported.

The full historical Git object databases are still required to prove whether PUFFScoin was created by directly modifying a WhaleCoin tree, by rebasing/copying selected WhaleCoin ideas into a newer Geth tree, or by another route. Until that mirror comparison is performed, that exact source-lineage claim remains unproven.

---

## A. Upstream Ethereum inheritance

The surviving PUFFScoin repository contains the standard Geth-era structure:

- accounts
- cmd
- common
- consensus
- console
- contracts
- core
- crypto
- eth
- ethclient
- ethdb
- ethstats
- event
- graphql
- les
- light
- log
- metrics
- miner
- mobile
- node
- p2p
- params
- rlp
- rpc
- signer
- swarm
- tests
- trie
- whisper

Its source headers still identify much of the code as originating from the go-ethereum authors.

### Archaeological interpretation

Most of the historical repository is infrastructure inherited from Geth. It is **not 420-specific intellectual architecture** and should not be manually ported file-by-file.

Modern policy:

> start from a current maintained execution client and preserve the smallest possible 420-specific patch surface.

---

## B. WhaleCoin-specific evidence

The archived WhaleCoin v1.6.9 Ethash package exposes:

`AccumulateNewRewards(state, header, uncles, genesisHeader)`

That is a notable departure from the ordinary Ethereum reward accumulator and is direct evidence of a customized consensus reward path.

The WhaleCoin whitepaper describes the intended economics:

- WhaleCoin is an Ethereum fork.
- consensus rules require miners to pay a fraction of mining rewards to a smart contract;
- the contract funds a Developer's Fund;
- follower rewards are based on Whale upvotes;
- follower rewards should include anti-spam limits;
- upvote rewards should decay over time;
- the design contemplated moderator rewards;
- follower rewards were delayed during the initial 200,000 blocks.

The archived client also used a Whale-specific main network ID of `30373`.

### What matters to modern 420

The historically valuable concept is **protocol-funded participation**:

`block issuance -> protocol reward pool -> useful social participation`

This directly informs the modern 33% Attention allocation.

### What does not survive

Do not forward-port:

- Ethash mining;
- miner-enforced payment into a mutable reward contract;
- the exact old `AccumulateNewRewards` implementation;
- the old social anti-spam algorithm without redesign;
- old Ethereum networking/config constants.

The modern implementation must be deterministic, auditable, and compatible with the separate execution/consensus architecture.

---

## C. PUFFScoin / early 420 Integrated evidence

### Network identity

Surviving 2019 code:

- `ChainID = 420`
- mainnet genesis hash:
  `0x2515eaa9d7576909b634873b1bddaf314e5021b277f62730b1a82c0cbd4b762c`
- Ethash consensus
- root genesis gas limit `0x989680`
- root genesis nonce `0x0000000000000420`
- genesis allocation:
  `0x47351dd0c42e1947102ce729a0753c96471c9dd0`
- allocation amount:
  `200000000000000000000000000` base units

The code's `MainnetChainConfig` activates:

- Homestead at block 1
- DAO fork at block 1
- EIP-150 at block 1
- EIP-155 at block 1
- EIP-158 at block 1
- Byzantium at block 2
- Constantinople at block 3
- Petersburg at block 4

This is characteristic of a new Ethereum-derived chain intentionally activating inherited protocol upgrades almost immediately.

### Reward path

The surviving 2019 PUFFScoin `consensus/ethash/consensus.go` explicitly defines:

- Frontier block reward: 5 PUFFS
- Byzantium block reward: 5 PUFFS
- Constantinople block reward: 5 PUFFS

Its `accumulateRewards(...)` function follows the conventional Ethereum-style model:

1. select block reward;
2. calculate uncle rewards;
3. add uncle inclusion reward;
4. credit final reward to `header.Coinbase`.

Critically, searches of this surviving file find:

- no `AccumulateNewRewards`;
- no `Follower`;
- no 200,000-block follower activation;
- no visible Development/Follower split.

### Conclusion

The WhaleCoin social reward mechanism is **not present in the surviving PUFFScoin Ethash reward file**.

This is one of the most important Step-2 findings.

---

## D. Chain-ID discrepancy

Two historical states are preserved:

### 2019 PUFFScoin source
`chainId = 420`

### later 420coin chain registry
`chainId = 2020`
`networkId = 2020`

No attempt should be made to choose between them for the new chain until the historical Git timeline is fully reconstructed.

For the new testnet/mainnet, a fresh non-conflicting chain ID should be selected independently anyway.

---

## E. Earlier PUFFScoin history warning

A 2017 PUFFScoin announcement describes a substantially different architecture involving proof-of-stake phases, masternodes, a Genesis Sale, and a staged reward schedule.

That predates the surviving 2019 Ethereum/Ethash repository configuration.

This strongly suggests that **"PUFFScoin" referred to more than one protocol design over its lifetime**.

Step 2 therefore treats:

- 2017 masternode/PoS PUFFScoin,
- 2018 WhaleCoin design ancestry,
- 2019 Geth/Ethash PUFFScoin,
- 2020 420coin registry identity

as separate historical snapshots until Git history proves otherwise.

---

# Patch Inventory

## KEEP AS CONCEPT

### Whale / publisher role
Historical idea:
staked/high-commitment publisher whose activity can direct or influence participation rewards.

Modern form:
`WhaleRegistry` / publisher staking, with explicit eligibility and anti-Sybil rules.

### Protocol-funded participation
Historical idea:
part of block issuance funds social participation.

Modern form:
33% immutable top-level Attention allocation.

### Development funding
Historical idea:
part of protocol issuance continuously supports development.

Modern form:
33% immutable Development allocation routed to a transparent treasury.

### EVM compatibility
Historical inheritance:
Ethereum accounts, contracts, transaction model and tooling.

Modern form:
current maintained EVM execution client with minimal 420 patch set.

### Public native currency identity
Historical:
PUFFS / later Fourtwenty / symbol 420.

Modern:
public native currency name and symbol `420`.

---

## REIMPLEMENT FROM FIRST PRINCIPLES

### Reward routing
Old:
Ethash finalization / miner reward changes.

New:
consensus-authorized issuance with deterministic 34/33/33 routing and system-contract accounting.

### Attention distribution
Old:
Whale upvotes/follower reward model.

New:
epoch aggregation, fraud resistance, anti-Sybil mechanisms, claim roots, application-specific participation proofs.

### Validator economics
Old:
PoW miners / earlier PUFFS masternode or PoS concepts.

New:
15 active bonded validators, five rotated per period, cryptographic random selection, cooldown and slashing.

### Genesis
Old:
manually maintained Geth-style JSON.

New:
one canonical machine-readable configuration -> generated execution genesis + consensus genesis + allocation manifest + hashes.

### Treasury governance
Old:
developer-fund concept.

New:
rate-limited, timelocked, auditable treasury contracts whose governance cannot increase issuance or change the constitutional 34/33/33 split.

---

## DISCARD

- Ethash mining.
- DAG/cache mining machinery as 420 consensus logic.
- Ethereum difficulty bomb / PoW difficulty rules.
- uncle-reward economics.
- old hard-coded Ethereum testnet identities.
- obsolete Whisper/Swarm components as required protocol dependencies.
- old masternode architecture.
- old Genesis Sale implementation.
- old client branding substitutions as a development strategy.
- any assumption that wallet count proves unique humans.
- any reward-per-click design with no fraud aggregation.
- any privileged founder reward address embedded in consensus code.

---

# Files requiring focused historical diff when Git mirrors are available

Priority 1:
- `consensus/ethash/consensus.go`
- `core/genesis.go`
- `core/genesis_alloc.go`
- `params/config.go`
- `params/protocol_params.go`
- `eth/config.go`

Priority 2:
- `miner/*`
- `core/state_processor.go`
- `core/state_transition.go`
- `core/types/*`
- `cmd/gwhale/*` vs `cmd/gpuffs/*`
- RPC/API registration files
- bootnode configuration
- network identifiers and discovery constants

Priority 3:
- wallet/social repositories that may contain Whale/follower UX or contracts outside the node repository.

---

# Step-2 conclusion

The modern 420 implementation should **not** be a resurrection of the historical node binary.

What should survive is the architectural DNA:

`Ethereum programmability + protocol-funded development + protocol-funded attention + cannabis-centered application economy`

What must be replaced is the old mechanism:

`Ethash miner + old reward hook + old client/network stack`

The new design therefore proceeds cleanly into Step 3: a normative 420 Integrated Protocol Specification that takes the recovered ideas as requirements rather than legacy code.
