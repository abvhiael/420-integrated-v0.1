# REG-AUDIT-4 — reconcile the Genesis address namespace

**Canonical roadmap source:** `docs/audit/420REGISTRY-COMPLETE-AUDIT-20260928.md`  
**Status:** COMPLETE

## Original definition

Use the existing global address-reconciliation work; do not solve Registry in isolation.

- approve one collision-free namespace-wide map;
- update mirrors, predeploy plan, deployment manifest, resident configuration and examples atomically;
- preserve explicit supersession history;
- run collision and frozen-range checks.

**Exit:** one canonical Registry address, with no contradictory authoritative assignment.

## Repository-grounded decision

The active repository authority preserves the frozen Step 6.2 predeploy map. ProtocolRegistry remains:

`0x0000000000000000000000000000000000000434`

The older W14.7 migration proposal that moved ProtocolRegistry to `0x0448` is historical only. REG-AUDIT-4 explicitly supersedes that proposal without deleting its provenance.

The complete namespace authority is:

- `contracts/config/genesis-address-namespace.json`

It binds the frozen system allocation, canonical discovery anchors, bridge candidates, Wallet candidates/resident references, retired claims and registry-resolved services into one collision-auditable record.

## Gap analysis

Already satisfied on baseline `bec56b384e9f40afc931788d53a3f67a4bb4e94e`:

- both system maps assigned ProtocolRegistry to `0x0434`;
- predeploy plan and deployment manifest assigned ProtocolRegistry to `0x0434`;
- canonical discovery anchors assigned ProtocolRegistry to `0x0434`;
- Wallet resident configuration referenced ProtocolRegistry at `0x0434`;
- the active bridge map had already retired the `0x043c` BridgeAssetRegistry collision and the fixed GatewayRouter proposal.

Gaps remediated by this step:

- no single namespace-wide authority record existed;
- historical migration records still described `0x0448` as an unresolved Registry relocation candidate;
- Developer Hub local examples still used `0x0420`;
- generated references repeated the stale local-example address;
- the legacy collision auditor was intentionally expected to fail instead of verifying the reconciled real data;
- CI did not directly gate REG-AUDIT-4 authority, supersession, frozen-range and example consistency.

## Implementation

### Namespace authority and mirrors

- added `contracts/config/genesis-address-namespace.json`;
- bound both system-address mirrors to it;
- bound predeploy and deployment manifests to it;
- bound canonical discovery, bridge candidates and Wallet inventory to it;
- retained live deployment/code-hash gates as false where later roadmap steps own them.

### Supersession history

The following remain in-repository for audit provenance but are explicitly non-authoritative:

- `contracts/config/wallet-authority-address-reconciliation.json`
- `contracts/config/w14-7-address-migration-candidates.json`
- `contracts/config/w14-7-4-global-address-reconciliation.json`
- `config/extended-system-addresses.json`
- `docs/W14-7-4-GLOBAL-ADDRESS-RECONCILIATION.md`

Historical `0x0422` and `0x0448` ProtocolRegistry claims are retired; neither is an active Registry assignment.

### Resident configuration and examples

- `wallet/deployment-inventory.json` consumes the namespace authority while remaining fail-closed for live testnet deployment;
- Developer Hub catalogue and manifest local examples now use Registry `0x0434`;
- generated Registry address references are aligned to `0x0434`.

### Executable qualification

- `scripts/verify-reg-audit-4-genesis-address-namespace.py`
- `scripts/test-reg-audit-4-genesis-address-namespace.py`
- `scripts/audit-genesis-address-collisions.py`
- `.github/workflows/registry-reg-audit-4.yml`
- retained `.github/workflows/genesis-address-authority.yml`

Adversarial coverage includes:

- attempted Registry relocation to retired `0x0448`;
- system-mirror drift;
- predeploy/deployment drift;
- bridge collision with Registry;
- Wallet resident drift;
- stale `0x0420` examples;
- promotion of superseded historical proposals;
- fixed address outside the reserved range;
- registry-resolved services attempting to claim fixed addresses.

Accounting/custody, replay and expiry are not applicable to this namespace-only step. Runtime bytecode/code-hash and live deployment proof remain later roadmap gates.

## Exact-head evidence

- Qualified SHA: `9baaa5c6e89cf08bf152d36c83477890a41ae727`
- Main/base SHA: `76e7f5732247efc091c8842efaecce2b11c6fc61`
- PR: #402
- REG-AUDIT-4 workflow: PASS — `36646631416`
- Genesis Address Authority workflow: PASS — `36646631542`
- Docs qualification: PASS — `36646631558`
- Integrated qualification: PASS — `36646631449`

The reconciled implementation head above is the qualification anchor and was zero-behind current `main`. The evidence-recording head is requalified separately; those final run IDs are retained in PR metadata so the repository does not create an infinite evidence-only commit loop.

## Remaining blockers outside REG-AUDIT-4

Overall Registry remains NO-GO. REG-AUDIT-4 does not establish a compiled final Registry artifact, runtime code hash, Genesis storage image, live deployment, production-equivalent testnet receipt or final Genesis acceptance.

## Next canonical roadmap step

**REG-AUDIT-5 — generate final Registry artifact and predeploy state**
