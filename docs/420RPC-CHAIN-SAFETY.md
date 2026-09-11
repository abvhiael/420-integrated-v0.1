# 420RPC RPC-4 chain identity, freshness and finality safety

RPC-4 adds a safety gate in front of RPC-3 routing. It uses fresh observations from already RPC-1-eligible execution providers to determine whether an upstream is safe to receive a public request. It does not decide chain state or finality.

## Safety evidence

Each execution provider observation records:

- provider ID;
- observed chain ID;
- head block number and hash;
- safe block number and hash;
- finalized block number and hash;
- observation timestamp.

The default policy is pinned to chain ID `420`, allows a provider to trail the freshest valid observed head by at most 8 blocks, requires observations newer than 15 seconds, and requires both safe and finalized checkpoints.

## Fail-closed rules

A provider is removed from routing when any of the following are true:

- it is no longer RPC-1 eligible or is disabled;
- no RPC-4 observation exists;
- the observed chain ID is not 420;
- chain identity changed relative to RPC-1 discovery;
- the observation is stale or dated in the future;
- the head is too far behind the fleet reference head;
- required safe/finalized checkpoints are absent;
- safe or finalized height is ahead of head;
- finalized height is ahead of safe height;
- checkpoint hashes are malformed.

The fleet fails closed when two eligible providers report different hashes for the same safe or finalized block height. Provider priority does not resolve that conflict.

## Authority boundary

420RPC only judges whether available upstream evidence is safe enough to route. The gateway does not choose a canonical fork, invent a safe/finalized checkpoint, or override node consensus. A disagreement is an availability failure from the gateway's perspective, not permission to declare a winner.

## Routing integration

`safeRouteCandidates420` first applies RPC-4 safety filtering and then delegates the remaining provider set to RPC-3 routing. Therefore health, transport, priority and method-capability rules continue to apply, but only after chain-safety qualification.
