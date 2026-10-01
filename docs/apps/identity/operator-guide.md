# 420 Identity operator guide

420Identity is a Genesis protocol application anchored by `Identity420`. This guide describes current repository authority and does not itself prove a live deployment.

## Canonical authority

- frozen Identity420 address: `0x0000000000000000000000000000000000000436`;
- frozen governance authority address: `0x0000000000000000000000000000000000000429`;
- canonical address authority: `contracts/config/system-addresses.json` and `contracts/config/genesis-canonical-addresses.json`;
- predeploy plan: `contracts/config/predeploy/predeploy-plan.json`.

Do not use retired Wallet proposals such as 0x0424 or 0x0449 as active Identity authority.

## Before enabling Identity

Require all of the following:

1. approved network manifest and exact chain/genesis identity;
2. retained Identity420 artifact from the pinned compiler profile;
3. expected runtime code hash for the approved release;
4. verified code at 0x0436;
5. verified immutable governanceTimelock value;
6. expected storage/predeploy state;
7. exact ABI/interface compatibility for the approved release;
8. qualified Indexer/Search/Wallet bindings.

Fail closed if any authority record, code hash, chain identity or dependency status is unknown or conflicted.

## Governance and issuer operations

Issuer creation, replacement, trust-class changes and activation/deactivation are governance actions.

Operational rules:

- never treat an issuer controller key as governance authority;
- use issuer deactivation when a compromised or unreliable issuer must stop validating credentials;
- remember that current issuer state affects existing credential validity;
- retain governance transaction, block and release provenance for every issuer mutation;
- independently verify the target issuer ID, controller, metadata commitment, trust class and active state before execution.

## Credential lifecycle

Applications must query current canonical state before a security-sensitive decision.

A credential is invalid when:

- it does not exist;
- it is revoked;
- the subject rejected it;
- it is expired;
- its issuer is inactive;
- its subject profile is inactive.

Do not rely on a cached badge as authorization.

## Profile control incidents

Profile controller transfer is two-step. If a transfer is unexpected:

- inspect `ProfileControllerTransferStarted`;
- verify the pending controller;
- verify whether `ProfileControllerTransferred` occurred;
- treat derived displays as non-authoritative until canonical state is confirmed.

There is no operator shortcut that overrides profile controller state.

## Names integration

A primary .420 name is strong only when both canonical sides agree:

- Names420 claims the profile ID; and
- Identity420 profile.primaryName equals the label hash.

Do not treat a one-sided pointer as a verified binding.

## Monitoring

Monitor at minimum:

- `ProfileCreated`
- `ProfileUpdated`
- `PrimaryNameSet`
- `ProfileControllerTransferStarted`
- `ProfileControllerTransferred`
- `IssuerSet`
- `CredentialIssued`
- `CredentialRevoked`
- `CredentialRejected`

Indexer/Search/Explorer state must retain chain/block/log provenance and handle reorg/replay according to their own qualified policies.

## Privacy

Identity metadata and claims may point to hashes/commitments. Do not automatically dereference or publish private material.

Do not put raw KYC records, private contact information, health information, secret credentials or other sensitive payloads on-chain unless a separately approved protocol explicitly requires public disclosure.

## Recovery boundaries

Identity canonical state is on-chain. Derived Indexer/Search/Explorer state is rebuildable and must never overwrite canonical state.

If a derived service is stale or corrupt:

1. stop presenting it as current;
2. re-establish chain identity/finality;
3. rebuild/replay from canonical history using the service's qualified recovery procedure;
4. re-check profile/issuer/credential state before restoring dependent features.

## Current release blockers

At the 2026-09-30 audit baseline:

- the frozen `IIdentityCredential420` API is incompatible with `Identity420`;
- the retained Identity420 compiled artifact is missing;
- Identity420 predeploy-state materialization is missing;
- live chain code/hash evidence at 0x0436 is absent;
- Wallet marks Identity420 frozen but not chain-verified;
- public testnet network bindings are not complete.

Do not mark Identity testnet-ready or Genesis-ready until those blockers are closed.
