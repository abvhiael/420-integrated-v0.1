# AI-RECOVERY-5 — ai.420integrated.org web client

Status: **IMPLEMENTED — QUALIFICATION IN PROGRESS**

## Scope

AI-RECOVERY-5 adds the first user-facing 420AI web application at `ai/web/`, intended to be deployed at `ai.420integrated.org`.

The client is built around the authority boundaries recovered in AI-RECOVERY-1 through AI-RECOVERY-4:

- canonical AI/Compute contracts own protocol state;
- the AI Read API is derived and explicitly non-authoritative;
- private prompts/payloads remain off-chain;
- the browser never stores provider or wallet signing secrets;
- value-changing and lifecycle-changing writes remain behind Wallet/canonical transaction flows.

## Delivered

The web client includes:

- responsive 420AI application shell;
- AI API readiness/freshness display;
- wallet connection and chain identity check;
- model discovery;
- provider discovery;
- job discovery, including connected-requester filtering;
- result/provider/funding lifecycle presentation;
- bounded AI request drafting and review;
- explicit prompt/payload commitment field rather than plaintext on-chain payload;
- provider/operator observational console;
- fail-closed runtime configuration;
- fixed Genesis AI addresses for the frozen physical compatibility contracts;
- ProtocolRegistry discovery anchor;
- unit tests and static security qualification.

## Request submission boundary

`AIJobManager.createRequest()` is requester-authorized and must preserve the connected account as `msg.sender`.

The UI therefore constructs and validates a reviewable canonical request intent containing:

- job ID;
- model version ID;
- workload class;
- request commitment;
- privacy policy;
- verification profile;
- maximum spend;
- deadline.

AI-RECOVERY-5 does **not** silently invent a browser-side signing path. `features.writes` is checked in as `false`; submission remains disabled until the Wallet transaction adapter for AI writes is separately qualified.

Funding is not represented as a direct browser mutation because canonical funding confirmation belongs to AIJobEscrow. Compute binding likewise remains subject to requester and canonical ComputeMarket constraints.

## Deployment

The folder `ai/web/` is a static deployment root suitable for Cloudflare Pages. Runtime configuration is externalized through `runtime-config.json`.

For a deployed environment, configure:

- `network.chainId`;
- `services.ai` to the qualified HTTPS AI Read API;
- optional Explorer endpoint;
- keep `features.writes=false` until the transaction adapter qualification phase.

## Follow-on

The remaining path to a fully transactional production AI client is now concentrated in AI-RECOVERY-6:

- qualified Wallet transaction adapter;
- escrow/Vault funding flow;
- Compute request creation/binding;
- payload transport;
- model runtime/provider adapters;
- verification and settlement adapters.

The UI should only enable transaction controls after those adapters pass their own qualification gates.
