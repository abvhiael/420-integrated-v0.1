# 420 Integrated Application Documentation Contract

Every genesis or ecosystem application must fit a predictable documentation model so users and developers do not need to relearn the documentation structure for each app.

## Standard application package

New application documentation belongs under:

`docs/apps/<app-id>/`

The preferred package is:

```text
index.md
getting-started.md
user-guide.md
concepts.md
architecture.md
permissions.md
fees.md
security.md
troubleshooting.md
faq.md

developer/
  index.md
  contracts.md
  api.md
  events.md
  errors.md
  examples.md
```

Not every file is required when a topic genuinely does not apply. A missing applicable topic, however, must not be hidden by collapsing it into an unrelated page.

## Minimum release documentation

Before an application is considered release-ready, it must provide enough documentation to answer:

1. What is this application and why would someone use it?
2. How does a new user start using it?
3. What actions can change state, transfer value, grant permissions, or become irreversible?
4. What does the user sign and what authority is granted?
5. What fees, deposits, stakes, or economic consequences can apply?
6. What security assumptions and risks matter to the user?
7. What common failure modes exist and how are they recovered?
8. Which contracts, services, protocols, and canonical registries does the application depend on?
9. How does a developer integrate with it when public integration is supported?
10. Which network/version/genesis conditions does the documentation describe?

## Architecture separation

`docs/apps/<app-id>/architecture.md` documents application-level composition and behavior. Canonical protocol internals belong under `docs/architecture/protocols/`. Application architecture should link to protocol architecture rather than duplicate it.

## User-first writing

User documentation should be task-oriented. Prefer titles such as `Bridge ETH to 420`, `Revoke a Wallet Permission`, or `Recover an Offline Validator` over titles that only name internal modules.

## Contextual help readiness

Application documentation should use stable headings and predictable paths so future dApp help controls can deep-link directly into the relevant section of 420Docs.

## Generated developer reference

Machine-derived contract, ABI, RPC, SDK, event, and error reference may eventually be generated automatically. Generated pages must clearly identify their source and must not replace explanatory or task-based documentation.