# DOC-15.5 — COMPLETE

DOC-15.5 establishes Ask 420 network and version context.

Deliverables:

- `docs/assistant/network-version-context.md`
- `docs/assistant/network-version-policy.json`
- `scripts/validate-doc-assistant-network-version.py`

Result:

- development/current resolves only to development;
- genesis/current resolves to the immutable Genesis release;
- genesis/genesis is the supported historical Genesis route;
- testnet/current and mainnet/current remain unavailable until DOC-13 publishes those tracks;
- cross-environment and implicit cross-release fallback are prohibited;
- development generated reference cannot be reused as Genesis authority;
- documentation context never proves live runtime state.

DOC-15.9 will wire the validator into unified 420Docs qualification.
