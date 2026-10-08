# CMP-7.1 — @420/compute-sdk

Status: **COMPLETE — Level 1 exact-head qualified on `2ea2b3d2d7da94a9b864516655436b46321039a4`.**

## Canonical purpose

Provide the typed developer SDK boundary for Compute Market without moving signing, custody, protocol authority, or canonical state into the SDK.

## Requirements

- bind every Compute intent to the selected chain identity and verified canonical contract catalogue;
- reuse the already-qualified Compute request validators rather than creating parallel request semantics;
- expose typed request validation and unsigned write-intent construction;
- fail closed when the canonical contract is unavailable or malformed;
- never request, store, derive, or manage private keys, mnemonics, seed phrases, or other signing secrets;
- mark SDK write plans as non-canonical until Wallet-authorized execution succeeds on-chain;
- preserve CMP-0/CMP-6 authority boundaries.

## Implementation

CMP-7.1 adds `createComputeSdk420` as the high-level Compute developer client. It prepares canonical-contract write intents for request submission/cancellation and delegates all authorization to the qualified Wallet/signing boundary.

The existing `compute.ts` protocol types, read-model client, request validation, offer/pricing validation, and deterministic encodings remain authoritative inputs and are not duplicated.

## Qualification

Level 1 requires:

- TypeScript strict build;
- retained `@420/sdk` tests;
- CMP-7.1 negative tests for chain identity, canonical contract availability, malformed IDs, expiry and payer maximum;
- no broad Solidity/Genesis/global qualification because this step changes no contracts, address authority, deployment config, or global runtime.

## Milestone

CMP-7.1 is an ordinary Level 1 step. The first CMP-7 Level 2 milestone is CMP-7.5 after the job/worker/verifier/research API surfaces converge.

## Next canonical step

**CMP-7.2 — Job submission API**
