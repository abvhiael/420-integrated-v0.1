---
title: Ask 420 privacy and data boundaries
audience:
  - user
  - developer
  - operator
category: concepts
status: current
version: current
---

# Ask 420 privacy and data boundaries

DOC-15.7 defines the minimum data Ask 420 may accept, retain or forward while answering documentation questions.

## Minimum-input rule

Ask 420 should request only the information needed to resolve documentation intent and source context. Preferred inputs are:

- user question text;
- documentation environment and release, when relevant;
- stable `CTX-*` or `TRB-*` identifier, when available;
- application/service name and public version/build identifier;
- public transaction, block, contract or protocol-object identifiers when needed for troubleshooting context;
- sanitized error text or logs with secrets removed.

If a useful documentation answer can be produced without additional data, Ask 420 must not ask for more.

## Prohibited secrets and private payloads

Ask 420 must not require, solicit or depend on disclosure of:

- seed phrases or private keys;
- passkey private material or recovery secrets;
- validator signing keys, remote-signer credentials or Engine JWTs;
- bearer tokens, API secrets, authentication cookies or authorization headers;
- encrypted or private Messenger content;
- private Identity profile/credential payloads unrelated to the documentation question;
- private Attention targeting or consent payloads unrelated to the question;
- private 420AI prompts, datasets or model outputs unless the user explicitly chooses to discuss that content and the task cannot be answered from documentation alone.

If the user includes sensitive material unnecessarily, the assistant should avoid repeating it and steer the troubleshooting flow toward sanitized evidence.

## Session context

Permitted session context should be limited to documentation-relevant state such as:

- active environment/release;
- audience or client surface;
- selected application/protocol;
- intent class;
- stable contextual/troubleshooting identifiers;
- public correlation identifiers where required.

Session context must not become an ambient authorization channel. Possessing context about a Wallet, account, identity, message or AI job does not grant Ask 420 permission to act on it.

## Telemetry minimization

Assistant telemetry should record only operationally useful metadata necessary to improve documentation quality, reliability and coverage. Suitable fields include:

- intent class;
- resolved environment/release;
- source collection IDs;
- citation count;
- answer coverage state;
- stable `CTX-*` / `TRB-*` IDs when supplied;
- coarse client surface;
- latency/error class.

Raw question text, private payloads and user identifiers should not be required for aggregate assistant telemetry. Any implementation that stores richer content must define an explicit purpose, bounded retention and access policy outside this documentation contract.

## Retention boundary

DOC-15 does not establish a default right to retain user prompts or private context. Implementations should prefer ephemeral processing and aggregate/minimized telemetry. Retention, when introduced, must be explicit, purpose-limited and separable from the assistant's ability to answer a documentation question.

## Wallet and Smart Account boundary

Ask 420 may explain Wallet, Smart Account, permissions, signing and recovery documentation, but it must never request signing secrets or treat account context as authorization. It cannot approve, sign, submit, cancel or recover transactions/accounts merely because documentation context is available.

## Identity boundary

Ask 420 may explain Identity and credential behavior from canonical docs. It should not require unrelated private profile data, private claims or credential contents to explain the system. Public identifiers may be used only when materially necessary.

## Messenger boundary

Ask 420 must not require private message content to explain Messenger documentation or diagnose generic delivery behavior. Troubleshooting should prefer public identifiers, delivery state, sanitized errors and service health information.

## Attention boundary

Ask 420 may explain consent, sponsor, proof and reward flows but must not treat private targeting data, private engagement payloads or user profiling as normal documentation inputs.

## 420AI boundary

Ask 420 may send a bounded evidence package to a 420AI inference provider, but provider/model execution must receive only the minimum retrieved context and question data necessary for synthesis. Retrieval authority stays outside the model. Private application payloads must not be automatically added to inference context.

## Fail-closed behavior

If a documentation-support flow appears to require a prohibited secret or unrelated private payload, Ask 420 must stop that data request and switch to sanitized diagnostics, a canonical documentation link, or an unsupported/escalation result.

## DOC-15.7 result

Ask 420 now has an explicit minimum-data contract: documentation-relevant context is allowed, secrets and unrelated private application payloads are excluded, telemetry is minimized, retention is not assumed, and application-specific privacy boundaries remain intact.
