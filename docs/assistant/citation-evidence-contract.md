---
title: Ask 420 citation and evidence contract
audience:
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 citation and evidence contract

DOC-15.4 defines how Ask 420 proves the documentation basis for an answer. Citations are evidence pointers, not authority upgrades: the cited source must already be eligible under the DOC-15 source registry and the active DOC-13 environment/version.

## Citation unit

A citation payload identifies the exact documentation evidence used for a claim. The minimum fields are:

- `source_id` — the registered DOC-15 source collection;
- `document` — repository-relative documentation path;
- `environment` — documentation environment used for the answer;
- `release` — immutable release identifier when the answer is historical;
- `section` — heading or stable anchor when available;
- `evidence_class` — `canonical`, `generated`, `historical` or `compatibility`;
- `provenance` — required for generated evidence;
- `claim_scope` — concise description of the claim supported by this citation.

The rendered user-facing citation may be shorter, but the evidence record used to assemble the answer must preserve enough information to trace the claim to its source.

## Minimum evidence rules

Every concrete ecosystem claim requires at least one eligible citation. Claims that combine multiple authority layers require the smallest set of citations necessary to support the whole statement.

Examples:

- a Wallet task instruction should cite the canonical Wallet/user documentation that owns the task;
- a contract method, RPC surface, event or generated interface claim should cite generated reference plus its provenance when that generated source is eligible;
- an exact recovery procedure should cite the owning DOC-11 troubleshooting entry;
- a historical Genesis claim must cite an immutable Genesis-eligible source rather than current development material;
- a contextual `CTX-*` mapping may support navigation but cannot substantiate the underlying behavioral claim by itself.

If a claim cannot be supported by an eligible citation, the claim must be removed or the answer must become unsupported/unavailable.

## Generated-reference provenance

Generated DOC-10 reference is authoritative only within its governed provenance and environment scope. A generated citation therefore requires provenance sufficient to identify the governed generator/source state. Where the generated page exposes source manifests, hashes, registries or publication boundaries, Ask 420 should preserve them in the internal citation record.

Generated evidence cannot be used to imply:

- a deployment exists when deployment authority is not published;
- a network is live when network authority is not published;
- development reference is Genesis/testnet/mainnet reference;
- a catalogue/example value is canonical solely because it appears in generated output.

When generated reference and canonical prose differ, Ask 420 must preserve the documented authority boundary rather than averaging or scoring the sources.

## Canonical versus derived evidence

Evidence class is not a numeric confidence score. A canonical task page, a generated interface page and an immutable historical page can each be authoritative within different scopes.

Compatibility/navigation sources may be cited for routing, identifiers or link resolution, but they cannot make a substantive claim authoritative when the owning canonical/generated/historical evidence is absent.

Derived operational surfaces such as Explorer, Indexer, Search, Analytics or Status may be discussed through their canonical documentation, but an assistant answer must not treat their live output as canonical chain state unless the owning runtime authority separately proves it.

## Multi-source claims

Ask 420 should split compound claims when different clauses depend on different evidence. If a single sentence combines protocol semantics, generated interface details and troubleshooting behavior, each relevant evidence layer must be cited or the sentence should be decomposed.

Source disagreement is not resolved by majority vote or model preference. The assistant must apply the authority boundaries documented by the source registry and owning documentation. If the conflict cannot be resolved, the result is unsupported rather than a blended answer.

## Coverage states

Ask 420 uses discrete evidence-coverage states rather than synthetic confidence percentages:

- `supported` — every material claim has eligible evidence and required citations;
- `partially-supported` — some non-critical parts are supported, but at least one requested claim lacks sufficient evidence; unsupported portions must be explicitly withheld;
- `needs-context` — evidence may exist, but environment/version/subject context is insufficient to select it safely;
- `unsupported` — the governed corpus cannot substantiate the requested claim;
- `unavailable` — the relevant documentation track/source is not published or retrievable.

These states describe evidence coverage, not probability that the model is correct.

## Citation placement

Citations should appear immediately after the claim or paragraph they support. A single end-of-answer source list is insufficient when it obscures which source supports which claim.

For task and troubleshooting guidance, each safety-sensitive step or grouped set of steps should remain traceable to the owning source. For reference answers, cite the generated/canonical source adjacent to the interface detail.

## Unsupported evidence patterns

Ask 420 must reject as authoritative evidence:

- uncited model recollection;
- repository files outside the governed DOC-15 source registry;
- compatibility/navigation metadata used as substantive proof;
- development-only generated reference used for Genesis/testnet/mainnet claims;
- unpublished testnet/mainnet documentation;
- stale or missing generated provenance;
- a citation that points to a page but not to evidence that actually supports the claim.

## DOC-15.4 result

Ask 420 now has a claim-to-evidence model: concrete ecosystem claims require adjacent, traceable citations from eligible sources; generated evidence carries provenance; navigation metadata cannot substitute for substantive authority; and answer quality is expressed through discrete evidence-coverage states rather than invented confidence scores.
