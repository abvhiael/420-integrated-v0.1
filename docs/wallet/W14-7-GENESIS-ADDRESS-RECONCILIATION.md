# W14.7 — Genesis namespace and Wallet authority reconciliation

Status: IN PROGRESS — no address rebinding or verified deployment is claimed by this document.

## Authority decision

Preserve the frozen system allocation at 0x0420–0x043c, including ConsensusSystemCall420 at 0x043c. Do not silently replace consensus/economics contract code at those addresses. The swap/bridge candidate BridgeAssetRegistry at 0x043c must be reassigned or explicitly removed from the candidate map. The existing canonical application-anchor allocation at 0x0420–0x043b is not a second valid Genesis namespace: many addresses already belong to different frozen system contracts.

## Proposed disjoint allocation (NOT YET AUTHORIZED FOR DEPLOYMENT)

- Frozen core predeploys: 0x0420–0x043c, unchanged.
- Existing bridge candidates: 0x043d–0x0444, pending proof that each is available; the conflicting 0x043c bridge candidate must be reconciled separately.
- Names420: 0x0445, reserved only. The predeploy plan, system registry copy and deployment manifest currently still assign Names420 to 0x0435; update these as part of the namespace-wide migration, not independently.
- SmartAccountFactory420: 0x0446, provisional.
- CapabilityRegistry420: 0x0447, provisional.
- ProtocolRegistry: 0x0448, provisional; replace its conflicting existing 0x0434 system/predeploy/deployment allocation only in the same coordinated migration.
- Identity420: 0x0449, provisional; replace its conflicting existing 0x0436 system/predeploy/deployment allocation only in the same coordinated migration.
- Other canonical application anchors: allocate only after collecting and reconciling all system, bridge, router, application, code-hash, constructor/storage-init and generator consumers. Do not preemptively assign 0x044a onward without confirming no other registries claim them.

## Ordered implementation

1. Inventory every literal address and named contract assignment in all canonical/legacy system registries, extended/bridge registries, predeploy plans, deployment manifests, genesis allocation builders, storage initialization, runtime address constants, CI scripts, and application clients. Record each authority, whether frozen, candidate, deployed or registry-resolved; differentiate same contract at multiple addresses from two contracts at one address.
2. Produce a single collision-free allocation table, explicitly recording superseded legacy addresses, planned relocations, owners and any chain migration implications. Resolve 0x043c bridge overlap before freezing any relocated anchor; verify all destinations against all recorded allocations.
3. Apply registry, predeploy and deployment-manifest changes as a single reviewed changeset, including all relevant renamed legacy contract placements, and update Wallet inventory and address-dependent checks in the same changeset. Do not make only the four Wallet edits.
4. Update initialization/storage/code-hash references and deterministic genesis generation, including constructor dependencies. Add a CI check that validates cross-registry consistency and rejects nonidentical contract identities sharing an address. A synthetic local fixture should prove both collision failure and clean-map success.
5. Run Solidity, Wallet Web/Extension/Mobile and Integrated Qualification CI against the NEW commit. Previous green CI for W14.6 is not evidence that W14.7 is qualified.
6. Keep Wallet and .420 transfers fail-closed. A reserved address is not deployed; do not set live-release gates until production EntryPoint binding, actual genesis runtime bytecode/storage manifest, official chain-specific network manifest, chain identity and on-chain code hashes are independently verified.

## Existing audit and candidate ledger

- `scripts/audit-genesis-address-collisions.py` records the current namespace conflict and is expected to fail until the migration is actually complete.
- `contracts/config/wallet-authority-address-reconciliation.json` records the four provisional Wallet assignments and known cross-file blockers.
- `contracts/config/genesis-canonical-addresses.json`, `config/system-addresses.json`, `contracts/config/system-addresses.json`, `config/swap-bridge-extension-addresses.json`, `contracts/config/predeploy/predeploy-plan.json`, `contracts/config/deployment-manifest.json`, `wallet/deployment-inventory.json` must be reconciled together.

Completion criteria: all recorded authoritative address claims and runtime placements agree without conflicting contract identities; the cross-registry audit and all existing CI pass on the same new head; deployment proof and live-testnet release gates remain separately tracked.