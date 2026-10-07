# 420Mail MAIL-2.32 Qualification

## Step
**MAIL-2.32 — Connector Isolation**

## Completion
- Status: **COMPLETE**
- Level 1: **PASS — app-scoped step qualification**
- Level 2: **PASS — retained app integration revalidation for shared ConnectorService change**
- Product/security milestone: **IN PROGRESS; not closed**
- Qualified feature SHA: `0a8ac9171d03b460086c18402176e652fba10226`
- Exact tested PR merge-candidate SHA: `77c4ffe15009ed8f20a302be17799e67440be2a9`
- Tested/current `main` parent: `78284d67ddeb598025f93d26f8847ea891872444`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical definition
The roadmap defines MAIL-2.32 as **Connector Isolation** inside the Product/security milestone. Repository inspection identified one material isolation weakness in the provider-neutral registry: provider descriptors were re-read from mutable adapters after registration, allowing post-admission provider/capability drift. Adapter panics also escaped the connector execution boundary.

## Implementation
### Immutable connector admission
`ConnectorRegistry` now stores a registration record containing:
- the adapter;
- an immutable registration-time descriptor snapshot.

After admission, a connector cannot change the registry's provider identity or capability authority by mutating later `Descriptor()` output.

`Descriptors()` returns defensive copies so caller mutation cannot modify registry authority.

### Adapter failure containment
All adapter execution paths are now invoked through panic-containment wrappers:
- link;
- unlink;
- pull;
- push;
- webhook verification.

A connector panic becomes `ErrConnectorIsolated` instead of escaping through Mail process execution.

Ordinary provider errors remain observable and are not redirected to another provider.

### Webhook metadata isolation
Webhook header maps are copied before being passed to an adapter. Adapter mutation therefore cannot alter caller-owned request metadata.

### Existing result binding retained
Existing validation continues to require provider, identity, connection, verification, item, and accepted-result bindings as applicable.

No connector capability was added or broadened.

## Negative/adversarial coverage
Added tests proving:
- post-registration descriptor/provider mutation does not alter admitted authority;
- post-registration capability escalation is rejected;
- descriptor slices returned to callers cannot mutate registry state;
- adapter pull/push/webhook panics are contained;
- adapter webhook-header mutation cannot modify caller-owned maps;
- existing unsupported-capability fail-closed behavior remains intact.

## Qualification history
### Initial formatting-only failure
420Mail Audit Qualification run **37531703319** (#408), job **112502422080**:
- Exact head — PASS
- Go format — FAIL
- later gates — correctly SKIPPED

Diagnosis: new connector-isolation tests had ordinary gofmt drift only. No implementation semantics or assertions were weakened.

Formatting repair SHA:
`0a8ac9171d03b460086c18402176e652fba10226`

### Final exact-head qualification
Workflow: **420Mail Audit Qualification**

- Run: **37531840160** (#409)
- Job: **112502888009**
- Exact checkout:
  `HEAD is now at 77c4ffe Merge 0a8ac9171d03b460086c18402176e652fba10226 into 78284d67ddeb598025f93d26f8847ea891872444`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output: `MAIL-2.32 connector isolation: qualified by app-scoped checks`

## Level 2 shared-dependency revalidation
MAIL-2.32 changes `ConnectorService`, a shared dependency across multiple connector/provider paths.

Run #409 already executes the full retained Mail package, race suite, vet, and cumulative verifier on the exact merge candidate, so it also provides the required broader app-integration revalidation for the shared dependency.

A duplicate identical run on the same SHA was not created solely to relabel the same coverage.

This **does not** close the Product/security milestone, which remains defined through MAIL-2.35.

## Security and isolation conclusions
- provider/capability authority is frozen at registration;
- unsupported capability requests fail before adapter execution;
- provider failures do not fall back to another connector;
- adapter panics are contained;
- caller-owned webhook metadata cannot be mutated by adapters;
- result provider/identity/connection bindings remain enforced;
- raw provider credentials are not persisted by Mail metadata;
- cross-provider authority escalation is not introduced;
- no public indexing or on-chain message-body storage was added.

## Level 3
**NOT RUN / NOT DUE.**

Repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/global, and complete app-phase closeout qualification remain deferred.

## Blockers
No repository-side blocker remains for MAIL-2.32.

Live provider/process sandboxing, deployed adapter isolation, production provider outage behavior, testnet deployment, and later security/operations qualification remain future gates.

## Evidence inheritance
This evidence file and roadmap/PR bookkeeping are documentation-only and inherit qualification from exact tested merge-candidate SHA `77c4ffe15009ed8f20a302be17799e67440be2a9` without recursive qualification.

## Next canonical step
**MAIL-2.33 — Encryption & Leakage Controls**
