# 420 Consensus

This directory will contain the 420-specific consensus implementation.

Initial requirements:

- 15 active validators.
- 5-of-15 rotation every 42 consensus epochs.
- 420 blocks per consensus epoch.
- Three rotations per active term.
- Bonded candidate eligibility.
- Mandatory cooldown.
- Verifiable random candidate selection.
- Deterministic proposer schedule/selection.
- Participation accounting.
- Slashing evidence.
- Engine API integration with the execution client.

We intentionally do not implement this by resurrecting Clique.
