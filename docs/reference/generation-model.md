---
title: Generated reference model
audience:
  - developer
category: reference
status: development
version: current
---

# Generated reference model

DOC-10 treats generated documentation as a reproducible build product. The reference tree is derived from implementation sources and verified metadata; it is not a second hand-maintained specification.

## Authority model

Generated output never gains authority by being published in 420Docs.

Source precedence remains:

1. canonical chain identity, execution and consensus state;
2. owning protocol contracts and governed protocol configuration;
3. approved Registry/deployment/manifests for discovery and environment identity;
4. verified build artifacts and interfaces for ABI/NatSpec reference;
5. stable service/API/SDK/CLI source contracts;
6. generated reference output.

If source data conflicts, generation fails closed rather than choosing a winner heuristically.

## Source classes

| Reference family | Primary machine source | Required provenance |
| --- | --- | --- |
| Contract/ABI/NatSpec | verified build artifact + Solidity source/interface + Developer Hub catalogue | contract name, protocol, version, chain/environment, artifact path/hash, ABI hash |
| Events/errors | verified contract ABI/artifact | contract/version plus full signature; topic/selector when derivable |
| RPC | supported execution/420RPC method definitions and qualification fixtures | implementation component/version and public/private classification |
| 420Indexer API | `420-indexer/src/api-contract.ts`, `api-surface.ts`, related stable source | API version/source path and authoritative=false semantics |
| SDK | exported TypeScript source in `packages/420-sdk/src` | package/version/source file/export identity |
| CLI | canonical CLI command definitions | package/version/command/options source |
| Network/chain registry | Developer Hub network manifests + chain/genesis configuration | environment, chain ID, manifest provenance and source path |
| Deployments | approved deployment records/catalogues/Registry-derived manifests | environment, contract identity, address, block/version, provenance, verification state |

## Output layout

Generated Markdown belongs below `docs/reference/generated/` and is grouped by source family:

```text
docs/reference/generated/
├── contracts/
├── events/
├── errors/
├── rpc/
├── api/
├── sdk/
├── cli/
├── networks/
└── deployments/
```

Human-authored pages such as this generation model remain outside `generated/`.

## Generated-file marker

Every generated Markdown page must contain a visible marker near the top stating that it is generated and must not be edited directly. The marker must also identify the generator version/schema and source provenance sufficient to reproduce the page.

At minimum, generated metadata records:

- generator schema version;
- reference family;
- source path(s);
- source identity/hash when available;
- environment/chain scope where applicable;
- generated output identity/hash where qualification requires it.

Timestamps are excluded from deterministic output unless a source itself requires a timestamp. Regenerating unchanged sources must produce byte-identical output.

## Fail-closed rules

Generation fails when any required condition is not satisfied, including:

- duplicate canonical contract identities or addresses;
- unverified contract catalogue entries being requested for distributable ABI reference;
- missing or malformed ABI/artifact/interface metadata;
- source and catalogue ABI hashes disagreeing;
- ambiguous API/SDK/CLI export identities;
- network or deployment data missing explicit environment/chain identity;
- public reference attempting to include private Engine/admin/signer endpoints or secrets;
- generated output would require inventing a testnet/mainnet value not present in an approved source.

## Environment isolation

Local, devnet, testnet and mainnet reference data remain separate. A local manifest may document the local environment only; it must never be renamed, copied or promoted into public testnet/mainnet reference output.

Chain ID is not sufficient by itself to prove environment identity. Generated network/deployment pages preserve manifest/deployment provenance and other identity evidence.

## Deterministic generation

The DOC-10 generator must:

1. load source files using a stable ordering;
2. validate source schemas before rendering;
3. normalize only representation, never meaning;
4. sort generated collections deterministically;
5. avoid wall-clock timestamps and machine-local paths;
6. render Markdown/metadata with stable formatting;
7. support a check mode that detects stale committed output without rewriting it.

Generator-specific stale-output checks belong to DOC-10.9. Broader site/document quality checks remain DOC-12.

## Cross-link rule

DOC-8 and DOC-9 remain the task-oriented entry points. Generated pages are targets for exact signatures, fields, routes, commands, errors, events, addresses and versions. Generated reference must not duplicate the explanatory workflows already maintained by the human-authored documentation.
