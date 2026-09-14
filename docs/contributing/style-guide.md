# 420 Integrated Documentation Style Guide

Documentation should be technically precise, task-oriented, and readable by the audience it targets.

## Naming and terminology

- Use `420 Integrated` for the ecosystem/project name.
- Use `$420` when referring to the native asset in economic/user contexts and `420` only where protocol/code naming requires it.
- Use canonical product/component names exactly as registered in the project.
- Do not invent aliases for protocols, contracts, roles, or application names unless the alias is explicitly documented.
- Prefer one canonical term for each concept. Add synonyms to the glossary rather than alternating terminology in prose.

## Voice

- Use direct, neutral technical language.
- Prefer active voice and concrete verbs.
- Explain unavoidable jargon on first use for user-facing pages.
- Avoid promotional claims in architecture and reference documentation.
- Distinguish requirements (`must`), recommendations (`should`), and optional behavior (`may`).

## Procedures

Task-based documentation should:

1. state prerequisites before the procedure;
2. describe the expected result;
3. identify irreversible, value-moving, permission-granting, or security-sensitive steps before the user performs them;
4. provide verification steps where practical;
5. link to recovery/troubleshooting guidance for realistic failure modes.

## Code and identifiers

- Use backticks for filenames, paths, commands, contract names, methods, configuration keys, service IDs, error IDs, and exact on-chain identifiers.
- Preserve exact case for code identifiers.
- Never shorten addresses or hashes in a reference field where the exact value is required for use or verification.
- Mark placeholder addresses, keys, IDs, and values unmistakably as examples.

## Network/version language

State whether instructions apply to development, testnet, genesis, mainnet, or multiple environments whenever ambiguity could cause a user to take the wrong action.

## Security language

Warnings should explain the consequence, not merely say `warning`. For example, identify when an action transfers value, exposes recovery material, grants spending authority, changes validator status, or depends on an external attestation.

## Links and duplication

Prefer linking to the canonical explanation rather than copying substantial architectural or protocol text into multiple pages. User guides may summarize a concept briefly, then link to architecture/reference material for detail.

## Status language

Do not describe unfinished or simulated behavior as production-ready. Clearly distinguish implemented, testnet-only, planned, experimental, and genesis-required behavior.