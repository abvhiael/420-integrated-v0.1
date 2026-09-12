---
title: Provider-backed integration model
audience:
  - developer
category: developer
status: development
version: current
---

# Provider-backed integration model

Storage/Resource, 420AI/Compute and 420 Bridge all combine canonical protocol state with replaceable off-chain execution. They share one integration rule: **a provider supplies service or evidence but never becomes the authority that owns authorization, settlement, finality, identity, custody or protocol state.**

## Common sequence

A safe provider-backed integration follows the same broad order:

1. select and verify the 420 network/environment;
2. discover the canonical protocol/service contracts and versions;
3. read the protocol-owned request, route, offer, agreement or job constraints;
4. obtain Wallet authorization for any state-changing or value-changing action;
5. submit the canonical request/commitment/transfer intent;
6. allow replaceable infrastructure to perform the off-chain work;
7. collect provider receipts, commitments, attestations or proofs;
8. submit/consume that evidence only through the protocol's bound verifier/adapter;
9. recheck canonical lifecycle, replay/risk/authorization state;
10. treat settlement/completion as true only after the owning protocol records it canonically and the required finality policy is met.

## Evidence does not collapse authority

Different systems produce different evidence:

| Domain | Evidence | What it can establish | What it cannot establish by itself |
| --- | --- | --- | --- |
| Storage | commitment/proof receipt | verifier accepted one bound storage challenge | universal availability, arbitrary payment release |
| AI/Compute | execution receipt/result commitment | provider committed to job-specific execution/output evidence | factual truth, subjective quality, settlement eligibility without bound verification |
| Bridge | external-chain proof/attestation | foreign-chain fact under the configured verifier/finality policy | route eligibility, risk clearance, replay safety, destination completion |

Applications must not substitute one evidence class for another or use a provider's local success response as canonical completion.

## Private payload boundary

Provider-backed protocols intentionally keep large/private payloads off-chain. Applications should assume that canonical state stores commitments, hashes, references, policy identifiers and lifecycle state—not plaintext payloads.

Never place these in public chain state merely for convenience:

- encryption/decryption keys;
- plaintext storage objects or private metadata;
- AI prompts, private documents, datasets or generated private outputs;
- provider API credentials;
- bridge signing secrets or unrelated foreign-chain private data.

A commitment proves the bytes/policy object that was committed. It does not grant permission to disclose the underlying payload.

## Provider neutrality

Do not hard-code provider identity where the canonical protocol supports qualified provider selection or replacement. A healthy integration binds economically/security-relevant terms canonically, while endpoint selection and worker routing remain replaceable operational concerns.

Provider replacement must not rewrite historical evidence. Existing commitments, accepted receipts, matches, bridge transfers, proofs and settlement history remain attached to the identities under which they were created.

## Failure rule

When provider evidence and canonical state disagree, fail closed and recover from canonical state outward. Never repair the disagreement by promoting provider-local metadata, queue state, a dashboard label or an Indexer projection into protocol truth.

## Related guides

- [Storage and Resource integration](storage-and-resource-integration.md)
- [420AI and Compute integration](ai-and-compute-integration.md)
- [420 Bridge integration](bridge-integration.md)
- [Source of truth and finality](source-of-truth.md)
- [Errors, retries and idempotency](errors-retries-and-idempotency.md)
