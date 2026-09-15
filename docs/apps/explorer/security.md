# Explorer security

Treat Explorer as an observation tool, not a signing authority.

- Verify the Explorer destination through qualified discovery.
- Check chain/network identity and indexed/finalized heights.
- Never enter a seed phrase, private key, recovery secret or passkey private material.
- Do not treat human-readable labels as proof of ownership or legitimacy.
- Prefer raw address/hash visibility beside labels.
- Treat pre-finality activity as reorg-sensitive.
- If the service reports stale, degraded, wrong-chain or inconsistent state, fail closed for decisions that depend on current data.

Explorer cannot prove that a recipient, token, contract or external claim is safe merely because it can display it.
