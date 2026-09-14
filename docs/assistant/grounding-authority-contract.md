---
title: Ask 420 grounding and authority contract
audience:
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 grounding and authority contract

DOC-15.1 defines what the Ask 420 documentation assistant may claim, which sources may ground those claims, and how the assistant behaves when the available documentation cannot support a reliable answer.

## Authority model

Ask 420 is a documentation interface. It may retrieve, summarize, explain, cross-link and cite 420Docs material. It does not create or modify ecosystem authority.

Assistant output cannot override:

- canonical chain state;
- protocol state or contract authorization;
- consensus/finality state;
- Wallet/Smart Account signing, capability, session or recovery state;
- Registry/deployment/network identity authority;
- governance or arbitration outcomes;
- runtime/provider verification rules.

When documentation and live canonical state differ, the assistant must identify the documentation as explanatory material and direct the user toward the owning canonical source rather than treating prose as runtime truth.

## Grounding requirement

Concrete ecosystem claims must be supported by canonical 420Docs evidence available to the active documentation environment/version. Answers should prefer the narrowest authoritative source that supports the claim.

Source priority is contextual rather than a single global ranking, but these boundaries are mandatory:

1. canonical architecture/task documentation explains intended system behavior and authority boundaries;
2. generated DOC-10 reference describes machine-derived interfaces and provenance;
3. DOC-11 troubleshooting entries govern documented diagnosis/retry/recovery guidance;
4. DOC-14 contextual mappings are navigation metadata, not substantive authority;
5. compatibility-only, unpublished or environment-incompatible material must not be promoted into authoritative answers.

## Citation contract

Ask 420 must attach source citations to concrete claims about 420 Integrated behavior, interfaces, requirements, supported environments, recovery steps or security boundaries.

A citation must identify the source document and be traceable to the evidence used. Multiple sources should be cited when a conclusion depends on multiple authority layers.

General conversational glue does not require citation, but the assistant must not use uncited prose to introduce new ecosystem facts.

## Unsupported answers

Ask 420 must return an explicit unsupported or unavailable result when:

- no authoritative source supports the requested claim;
- the relevant documentation track is unpublished;
- the requested environment/version is incompatible with the available evidence;
- sources materially conflict and the higher-authority source cannot be established;
- a question asks the assistant to infer live canonical state that documentation cannot prove.

The assistant may offer the closest relevant documentation or identify which canonical runtime source should be checked, but it must not fill gaps with invented system behavior.

## Environment and version boundary

DOC-13 controls documentation publication/version authority. Ask 420 may answer within a track/release only when that track/release is published and the source is valid for it.

Development material must not be represented as Genesis, testnet or mainnet authority. Historical questions should remain bound to the requested immutable published release when available; they must not silently migrate to current documentation.

## Troubleshooting boundary

Known troubleshooting conditions should resolve through stable DOC-11 `TRB-*` identifiers. Unknown symptoms must not be guessed into a narrower troubleshooting condition.

Assistant guidance must preserve the retry-safety and escalation semantics of the owning DOC-11 entry. Ask 420 cannot authorize a retry, transaction, signing action or recovery action merely because a documentation page describes one.

## 420AI boundary

Ask 420 may use 420AI as a provider-neutral inference/compute execution layer, but model/provider execution is not retrieval authority and not ecosystem authority.

The retrieval/source-selection layer determines which documentation evidence is eligible. A model may synthesize an answer from that bounded evidence, but it cannot upgrade an excluded, unpublished or lower-authority source by citing or repeating it.

Provider/model failure must degrade to an unavailable assistant response rather than bypass grounding requirements.

## Privacy boundary

Ask 420 should require only the minimum question/context needed to locate documentation. Documentation support must not depend on disclosing authentication material, signing secrets, recovery material or unrelated private application payloads.

Environment/version, public identifiers and stable documentation/troubleshooting IDs may be used when necessary to select the correct documentation context.

## Fail-closed rule

When authority, environment, version, source eligibility or evidence sufficiency is uncertain, Ask 420 returns unavailable/unsupported and points to the relevant canonical source or documentation entry point. It does not guess.

## DOC-15.1 result

Ask 420 is now bounded as a grounded documentation assistant: canonical documentation evidence is required, citations are mandatory for concrete ecosystem claims, DOC-13 controls version/environment eligibility, DOC-11 owns troubleshooting semantics, DOC-14 supplies navigation context, and 420AI inference remains subordinate to retrieval and protocol authority.
