# REG-AUDIT-8 production-equivalent testnet runbook

This runbook executes the canonical REG-AUDIT-8 requirements without weakening the distinction between repository readiness and live deployment evidence.

## Preconditions

Do not run live closeout until the official chain-420 testnet infrastructure is provisioned and placeholder endpoint inventory has been replaced by approved endpoints. The deployed release candidate must be an exact Git commit and include the REG-AUDIT-5 qualified ProtocolRegistry predeploy at `0x0000000000000000000000000000000000000434`.

Required facts:

- chain ID exactly `420`, environment `testnet`;
- exact deployed Git/release SHA;
- archive-capable HTTPS RPC able to answer genesis `eth_getCode` and `eth_getProof`;
- Registry genesis/runtime code hash `0x9f9e5f794296cf9faf5f8c8d17cd815f3c19c004a158c15cb61b5a29eaacb330`;
- Registry genesis storage root equal to the Ethereum empty-trie root;
- immutable governance authority `0x0000000000000000000000000000000000000429`;
- production-equivalent 420Indexer and 420Explorer endpoints bound to this network.

## Governance-controlled live exercise

Never commit, print, or pass governance signing material to repository scripts.

Using the approved GovernanceTimelock process:

1. execute one `publishRegisteredService` for a designated test service whose implementation has runtime code;
2. capture transaction hash, block, service ID, implementation, version, metadata hash, manifest hash, dependency root and interface hash;
3. verify the successful receipt contains both `ServiceVersionPublished` and `ServiceRegistrationProfilePublished`;
4. execute `deprecateService` for that same service/version;
5. capture its successful receipt and `ServiceDeprecated`;
6. record exact calldata and expected return bytes for governance, smoke, current-version, registration-profile and post-deprecation historical reads.

Legacy `publishService` or `setService` does not satisfy strict publication.

## Derived-consumer recovery

Against the same exact release candidate, record immutable evidence for restart/resume, RPC outage, provider unavailable, bounded non-finalized reorg, finalized-conflict fail-closed behavior, and full rebuild. 420Indexer and 420Explorer remain non-authoritative projections.

## Evidence

Start from `docs/audit/templates/REG-AUDIT-8-live-evidence.template.json`. Replace every placeholder. Set `status` to `LIVE_EVIDENCE_COMPLETE` only after every live requirement occurred.

Compute `evidenceSha256` by removing that field, serializing with sorted keys and compact separators, then SHA-256 hashing the UTF-8 bytes. Publish the JSON at an immutable HTTPS location.

## Independent verification

Dispatch `.github/workflows/registry-reg-audit-8-live.yml` with the exact deployed SHA, approved archive-capable RPC URL, and immutable evidence URL. Only that successful live workflow plus committed immutable evidence can close REG-AUDIT-8. Repository-readiness CI is insufficient.
