---
title: 420Storage upgrade and compatibility qualification
audience:
  - developer
  - operator
category: developer-guide
status: development
version: current
---

# 420Storage upgrade and compatibility qualification

SR-10.4 defines the production rolling-upgrade, migration and rollback boundary for the 420Storage Resource Network.

The critical distinction is between **software release identity** and **public compatibility identity**. Providers may run different software releases during a rolling deployment, but the qualified storage developer contract remains `v1` and the production topology schema remains `storage-topology-v1` until a separately qualified migration changes them.

## Compatibility rules

A rolling upgrade is acceptable only when:

- every participating provider/node keeps the same provider and node identity;
- the public developer API remains `v1`;
- the production topology configuration schema remains `storage-topology-v1`;
- the target deployment contains the same qualified node set as the source deployment;
- only software release versions change during the rolling step;
- canonical object, manifest, shard, agreement and commitment identity remains unchanged;
- rollback can be expressed through the same compatibility rules.

Changing an API version, configuration schema, provider identity or node identity is a migration, not a normal rolling upgrade, and must fail the SR-10.4 rolling-upgrade gate until separately qualified.

## Rolling procedure

For each deterministic step in the generated production upgrade plan:

1. confirm at least one other qualified provider remains available;
2. drain or stop the target node/service according to the operator runbook;
3. upgrade only the target software release;
4. restart the node and restore its qualified service lifecycle;
5. verify discovery returns the original provider/node/service identities;
6. retrieve known objects through the mixed-version topology and verify shard integrity;
7. compare immutable manifest identity fingerprints before and after the step;
8. proceed to the next node only after the current node is healthy.

The upgrade helper intentionally does not mutate canonical chain state and does not rewrite manifests or placements.

## Mixed-version qualification

A mixed deployment is supported when old and new software releases expose the same qualified `v1` storage contract and production configuration schema. Test traffic should include public/private retrieval, cache/store fallback, discovery and status calls while at least one old-release and one new-release node are active.

## Rollback

Rollback reverses the software version transition while preserving the same provider/node/API/schema identity. A rollback plan is valid only if it passes the same compatibility checks as an upgrade.

Rollback must not:

- rewrite manifest hashes;
- substitute shard roots or sizes;
- substitute agreement or commitment identity;
- replace provider/node identity under an existing placement;
- infer canonical truth from local filesystem state.

## Identity evidence

`ProductionManifestIdentityFingerprint` binds the immutable upgrade evidence to:

- API version;
- object ID;
- manifest hash;
- shard index/root/size;
- agreement ID;
- commitment ID;
- placement node ID.

Software version is deliberately excluded. A software-only upgrade therefore preserves the fingerprint, while canonical identity substitution changes it.

## Qualification coverage

SR-10.4 automated coverage verifies:

- deterministic rolling plans across multiple providers;
- software-only mixed-version upgrades;
- rejection of silent API-version drift;
- rejection of topology-schema drift;
- rejection of node substitution;
- no-op and rollback planning;
- persistence of immutable manifest/shard/commitment identity.

## Exit criteria

SR-10.4 is qualified when the exact branch head passes node420 Release Gate, 420 Integrated Qualification and 420Docs Qualification with the rolling-upgrade and rollback tests enabled.
