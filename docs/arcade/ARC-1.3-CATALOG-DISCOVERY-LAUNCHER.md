# ARC-1.3 — Game catalog, discovery interface and launcher

This implementation extends the qualified ARC-1.2 shell with **functional search**, canonical-category filtering, result counts, empty-state and clear-filter controls, and keyboard-accessible links to all eleven approved game details. Categories are deterministic per frozen canonical slug, with seven action and one each puzzle, creative, companion and exploration. The catalog is read-only and derives from `config/arcade-game-identities.json`; no remote or user-supplied catalog is authoritative.

A game detail includes category, explanatory disabled Launch button and explicit `Game runtime not installed` reason. It does **not** falsely invoke a playable game, ask for a wallet, claim verified results or register a game. Launch enabling is gated on future independently qualified bundles and adapters, not invented in ARC-1.3.

Security boundaries: strict eleven-game identifier validation, game-scoped allowlisted hash routes, no dynamic/remote executable content, no SDK custody, no cross-game state mutation, no remote score authority. Discovery accepts no unknown category. Search is normalized, limited and treated as plain React text.

**Step qualification:** pinned npm install, syntax/security lint, TypeScript, retained ARC-1.1/1.2 regression, category/search/forged-ID/disabled-launch tests, and Vite production build. Real game execution, production accessibility audits and testnet proofs are later canonical steps, not claimed as passed here.
