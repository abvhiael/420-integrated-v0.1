# Step 1 — Historical Source Preservation

Status: **preservation inventory established; remote source locations verified; key immutable artifacts recovered locally.**

No historical code has been modified in this step.

## Verified PUFFScoin / 420 Integrated source

Primary surviving repository:

- https://github.com/puffscoin/go-Puffscoin

Launchpad mirror:

- https://code.launchpad.net/puffscoin
- clone URL: https://git.launchpad.net/puffscoin

The Launchpad project identifies itself as an import of the GitHub repository.

The surviving GitHub repository describes itself as the official Golang implementation
of the PUFFScoin protocol and contains the expected Ethereum-derived directories,
including `consensus`, `contracts`, `core`, `eth`, `miner`, `params`, `rpc`, `p2p`,
and a root `genesis.json`.

## Historical July 2019 checkpoint

Checkpoint commit:

`e48ad5c90fa171affe779852bc12353282e730b2`

Commit message:

`Update genesis.json`

The commit changes the genesis gas limit from `0xC350` to `0x989680`.

The recovered genesis at the surviving repository contains:

- chainId: 420
- nonce: 0x0000000000000420
- gasLimit: 0x989680
- difficulty: 0x40000000
- Ethash enabled
- allocation address:
  `0x47351dd0c42e1947102ce729a0753c96471c9dd0`
- allocation:
  `200000000000000000000000000` base units

A normalized copy is preserved as:

`historical/puffscoin/genesis-2019-recovered.json`

## WhaleCoin ancestry source

Historical repository identity:

`github.com/WhaleCoinOrg/WhaleCoin`

The original repository is not currently dependable as a direct web source, but
Go's package archive still preserves the module as:

`github.com/whalecoinorg/whalecoin`

Verified archived release:

- version: v1.6.9
- published: 2018-05-31
- license: GPL-3.0
- executable: gwhale

This is sufficient to establish WhaleCoin as a concrete ancestry source for Step 2,
but a byte-for-byte repository mirror should still be acquired from Git history,
an archive service, an old local copy, or another surviving mirror if possible.

## Later 420coin public registry

A 2020 chain registry record preserves:

- name: 420coin
- chain: 420
- network: mainnet
- native currency name: Fourtwenty
- symbol: 420
- decimals: 18
- chainId: 2020
- networkId: 2020
- infoURL: https://420integrated.com

A normalized copy is preserved as:

`historical/420coin-registry/eip155-2020-recovered.json`

## Important historical discrepancy

The 2019 PUFFScoin `genesis.json` uses `chainId: 420`.

The later 2020 chain registry uses `chainId: 2020` and `networkId: 2020`.

Do **not** collapse these into one value yet. Step 2 should determine whether:

1. the network was intentionally renumbered after the July 2019 genesis;
2. the registry represented a later 420 Integrated network;
3. the registry entry was incorrect or aspirational;
4. there were multiple historical genesis configurations.

## Preservation rule

Historical material is evidence, not the new codebase.

Never edit files in `historical/` to make them conform to the v0.1 protocol.
If normalization is needed, create a new derived file outside the original artifact
and document its source.

## Remaining acquisition task

The execution environment used to build this package cannot directly perform the
remote Git clone, so the complete repository object databases are not embedded in
this ZIP yet. `scripts/fetch-historical-source.sh` is included to perform mirror
clones in any normal networked development environment.

Once run successfully, generate SHA-256 hashes and retain the resulting Git bundles
or mirror repositories as immutable project evidence.
