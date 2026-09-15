---
title: Ask 420 420AI integration contract
audience:
  - developer
  - operator
category: architecture
status: current
version: current
---

# Ask 420 420AI integration contract

DOC-15.8 defines how Ask 420 may use 420AI for provider-neutral inference without transferring documentation, retrieval, protocol or runtime authority to a model, provider, worker or matcher.

## Authority split

Ask 420 owns the documentation-assistant workflow:

1. resolve the documentation environment/version;
2. classify the query intent;
3. select eligible retrieval sources;
4. retrieve bounded evidence;
5. construct an inference package;
6. submit a bounded inference job through 420AI;
7. validate the returned answer against the package and citation rules;
8. return the answer or fail closed.

420AI owns AI request semantics and the AI-level job lifecycle. 420 ComputeMarket owns provider/resource matching, accepted compute terms, receipts, verification and settlement. Off-chain providers/workers execute inference. None of these layers may redefine which documentation sources are authoritative.

## Provider-neutral execution

Ask 420 must not depend on one privileged model or provider. Any eligible 420AI provider may execute the job if the accepted request satisfies the required workload, privacy, deadline, verification and spending constraints.

Provider choice affects execution availability and performance, not documentation authority. A provider cannot:

- add sources that were excluded by the Ask 420 source registry;
- switch documentation environment or release;
- silently substitute current documentation for an immutable historical request;
- weaken citation requirements;
- promote compatibility/navigation material into substantive authority;
- infer live chain/protocol state from static documentation;
- authorize a transaction, retry, signing action, recovery action or governance outcome.

## Bounded context package

Retrieval happens before inference. The model receives only a bounded package derived from already-eligible sources.

The package contains:

- request ID;
- resolved environment and release token;
- classified intent;
- user question or a minimized normalized form;
- bounded evidence excerpts or structured facts;
- source identifiers and citation locators;
- source class and provenance metadata where applicable;
- exact `TRB-*` or `CTX-*` identifier when one legitimately routed the request;
- answer-state constraints such as supported, needs-context, unsupported or unavailable;
- explicit prohibited claims relevant to the request.

The package must not contain unrelated repository content or private application state merely because it is available to the caller.

## Citation payload

Each evidence item supplied to inference must remain attributable to its source. At minimum the citation payload carries:

- source collection ID;
- repository-relative document path;
- environment;
- release/token when applicable;
- source class;
- locator or stable anchor when available;
- generated-reference provenance when the source class is generated.

The model may format citations for the user, but it may not invent or rewrite their source identity.

## Result contract

A model result is a candidate answer, not an authoritative result. Before publication Ask 420 validates that:

- every concrete ecosystem claim is supported by the bounded evidence;
- required citations refer to evidence actually supplied;
- the answer remains inside the resolved environment/release;
- generated-reference claims preserve their provenance boundary;
- troubleshooting statements preserve the owning DOC-11 retry/escalation semantics;
- the answer does not claim live runtime truth that the evidence cannot establish;
- the answer state is consistent with the retrieval result.

A response that fails validation is rejected rather than repaired by silently broadening the source set.

## Model freedom inside the boundary

Within the validated evidence package a model may summarize, explain, compare, reorder, simplify and synthesize material for the requested audience. It may combine multiple eligible sources where the relationship is supported.

It may not fill factual gaps with model memory, provider-local knowledge, web content, unpublished documentation or hidden repository material.

## Job lifecycle and failure behavior

Ask 420 maps its inference execution onto the bounded 420AI lifecycle. Provider or worker failures remain compute failures, not documentation failures.

If a provider is unavailable, times out, rejects the job, fails verification or returns an invalid result, the execution layer may use an approved retry/reroute path if the original request constraints remain unchanged. A reroute must not broaden privacy, provider, deadline, verification, source or environment constraints.

If no eligible provider/model can complete the request within policy, Ask 420 returns `unavailable` rather than falling back to an ungrounded model response.

## Timeout semantics

A timeout does not prove that an inference job never executed. Compute-job reconciliation follows 420AI/ComputeMarket state and receipt rules. Ask 420 must not duplicate settlement or resubmit in a way that can create duplicate paid work unless the underlying job policy explicitly establishes retry/idempotency safety.

User-facing documentation behavior remains simple: if no validated answer is available, return an unavailable state and preserve any existing job/settlement reconciliation separately.

## Privacy boundary

DOC-15.7 remains authoritative for prompt/context minimization. The inference package contains only the minimum documentation-relevant context needed to answer. Provider execution does not create permission to disclose Wallet secrets, Identity private data, Messenger content, Attention private data or unrelated AI payloads.

## Failure isolation

Ask 420/420AI failure must not affect consensus, execution, Wallet signing, Registry authority, governance, bridge safety or documentation publication. The assistant degrades independently.

## DOC-15.8 result

Ask 420 now has a provider-neutral 420AI execution boundary: retrieval and authority are fixed before inference; inference receives a bounded, attributable evidence package; candidate answers are validated before publication; and provider/model failure degrades to unavailable rather than bypassing grounding, privacy, citation or version rules.
