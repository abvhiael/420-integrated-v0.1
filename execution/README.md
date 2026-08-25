# Execution Layer

Target base: current stable upstream Go-Ethereum, pinned to an explicit release/commit before development begins.

Principle: minimize the 420-specific patch set.

Expected custom integration points:

- chain identity / genesis configuration;
- protocol system-call hooks if required;
- native issuance application after consensus authorization;
- deterministic routing of Security / Attention / Development allocations;
- 420-specific RPC metadata where useful.

Do not fork old PUFFScoin execution code forward wholesale. Historical source is a design/archaeology input.
