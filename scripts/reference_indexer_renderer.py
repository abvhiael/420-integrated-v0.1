#!/usr/bin/env python3
"""Deterministically render the DOC-10.5 420Indexer public API reference."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "420-indexer" / "src" / "api-contract.ts"
SURFACE = ROOT / "420-indexer" / "src" / "api-surface.ts"
TRANSPORT = ROOT / "420-indexer" / "src" / "http-transport.ts"
QUERY = ROOT / "420-indexer" / "src" / "query-layer.ts"
OPERATIONAL = ROOT / "420-indexer" / "src" / "operational-api.ts"
OUTPUT = ROOT / "docs" / "reference" / "generated" / "indexer-api.md"


def parse_routes(text: str) -> list[dict[str, str]]:
    pattern = re.compile(
        r"\{ id: '([^']+)', method: '([^']+)', path: '([^']+)', scope: '([^']+)', paged: (true|false), description: '([^']+)' \}"
    )
    routes = [
        {"id": a, "method": b, "path": c, "scope": d, "paged": e, "description": f}
        for a, b, c, d, e, f in pattern.findall(text)
    ]
    if not routes:
        raise ValueError("no Indexer API routes found")
    return routes


def query_params(route_id: str) -> str:
    params = {
        "health": "none",
        "readiness": "chainId",
        "version": "none",
        "status": "chainId",
        "blocks": "chainId, cursor?, limit?, direction?",
        "block": "chainId; path: id",
        "transactions": "chainId, address?, cursor?, limit?, direction?",
        "transaction": "chainId; path: hash",
        "receipt": "chainId; path: hash",
        "logs": "chainId, address?, cursor?, limit?, direction?",
        "address": "chainId; path: address",
        "asset-transfers": "chainId, assetKey?, address?, beforeBlock?, cursor?, limit?, direction?",
        "protocol-events": "chainId, protocol?, objectKey?, cursor?, limit?, direction?",
        "protocol-object": "chainId; path: protocol, key",
        "search": "chainId, q, limit?",
    }
    if route_id not in params:
        raise ValueError(f"missing query parameter reference for route {route_id}")
    return params[route_id]


def validate_sources(contract: str, surface: str, transport: str, query: str, operational: str) -> None:
    required = [
        (contract, "INDEXER_V1_ROUTES_420"),
        (surface, "INDEXER_API_VERSION_420 = 'v1'"),
        (transport, "method_not_allowed"),
        (transport, "invalid_request"),
        (transport, "internal_error"),
        (query, "const LIMIT_DEFAULT = 50"),
        (query, "const LIMIT_MAX = 200"),
        (operational, "authoritative: false"),
    ]
    for text, marker in required:
        if marker not in text:
            raise ValueError(f"required Indexer API source marker missing: {marker}")


def render() -> str:
    contract = CONTRACT.read_text(encoding="utf-8")
    surface = SURFACE.read_text(encoding="utf-8")
    transport = TRANSPORT.read_text(encoding="utf-8")
    query = QUERY.read_text(encoding="utf-8")
    operational = OPERATIONAL.read_text(encoding="utf-8")
    validate_sources(contract, surface, transport, query, operational)
    routes = parse_routes(contract)

    lines = [
        "---",
        "title: Generated 420Indexer API reference",
        "audience:",
        "  - developer",
        "category: reference",
        "status: generated",
        "version: current",
        "---",
        "",
        "# Generated 420Indexer API reference",
        "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate from the checked-in `420-indexer/src` API contracts.",
        "",
        "420Indexer is a read-only, rebuildable projection service. Its API is **non-authoritative**: security-sensitive balance, ownership, registration, settlement, governance, bridge, eligibility and finality decisions must be rechecked against canonical chain state or the owning protocol.",
        "",
        "## Stable routes",
        "",
        "| Route | Method | Scope | Paged | Parameters | Description |",
        "| --- | --- | --- | --- | --- | --- |",
    ]
    for route in routes:
        lines.append(
            f"| `{route['path']}` | `{route['method']}` | `{route['scope']}` | {route['paged']} | `{query_params(route['id'])}` | {route['description']} |"
        )

    lines += [
        "",
        "## Envelopes",
        "",
        "Successful HTTP responses use:",
        "",
        "```json",
        '{ "apiVersion": "v1", "data": {} }',
        "```",
        "",
        "Errors use:",
        "",
        "```json",
        '{ "apiVersion": "v1", "error": { "code": "...", "message": "..." } }',
        "```",
        "",
        "## HTTP error surface",
        "",
        "| Status | Code | Meaning |",
        "| ---: | --- | --- |",
        "| `400` | `invalid_request` | malformed URL, chainId, paging/filter input, path encoding, or required search input |",
        "| `404` | `not_found` | route or requested indexed resource not found |",
        "| `405` | `method_not_allowed` | public transport only supports GET |",
        "| `500` | `internal_error` | generic backend/projection failure; internal exception text is not exposed |",
        "",
        "`/ready` is special: when readiness is false it returns HTTP `503` **with the normal success envelope containing readiness data**, not an error envelope.",
        "",
        "## Pagination and cursors",
        "",
        "- Paged routes use opaque base64url keyset cursors, not page numbers or SQL offsets.",
        "- Default `limit`: `50`.",
        "- Maximum `limit`: `200`.",
        "- `direction`: `asc` or `desc`; default is `desc`.",
        "- Page responses use `{ items, nextCursor }`.",
        "- Cursor shapes are route-specific and intentionally opaque to clients.",
        "",
        "## Route-specific filters",
        "",
        "- transactions: optional `address` filter matches sender or recipient.",
        "- logs: optional `address` filter.",
        "- asset transfers: optional `assetKey`, `address`, and unsigned `beforeBlock`.",
        "- protocol events: optional `protocol` and `objectKey`.",
        "- search: required non-empty `q`; optional `limit` uses the same `1..200` validation.",
        "- all chain-scoped routes require decimal unsigned `chainId`.",
        "",
        "## Health, readiness and status",
        "",
        "`GET /health` reports process liveness only: `{ status: \"ok\", apiVersion: \"v1\" }`.",
        "",
        "`GET /ready?chainId=...` checks database reachability plus presence of an indexed head and, when runtime state is available, runtime freshness/readiness. Its DTO includes `ready`, `databaseReady`, `chainId`, `indexedHead`, and optional runtime status.",
        "",
        "`GET /v1/status?chainId=...` exposes `indexedHead`, head hash/timestamp, configured finality mode/confirmations, `safeHead`, optional lag/runtime status, and always sets `authoritative: false`.",
        "",
        "## Authority boundary",
        "",
        "Indexer output can drive lists, history, search, analytics, transfer journals and protocol projections. It must not be treated as canonical protocol authority. Consumers should preserve chain/finality provenance, tolerate non-finalized reorgs, and recheck canonical state before security-sensitive actions.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
