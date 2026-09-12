#!/usr/bin/env python3
"""Deterministically render the DOC-10.4 public 420RPC reference from implementation source."""

from __future__ import annotations

import hashlib
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
METHODS = ROOT / "420-rpc" / "src" / "methods.ts"
POLICY = ROOT / "420-rpc" / "src" / "request-policy.ts"
OUTPUT = ROOT / "docs" / "reference" / "generated" / "rpc.md"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def parse_methods(text: str) -> list[dict[str, str]]:
    pattern = re.compile(
        r"\{ method: '([^']+)', profile: '([^']+)', transport: '([^']+)', "
        r"requiredCapabilities: \[([^\]]*)\], mutatesChain: (true|false), "
        r"requiresUserSignature: (true|false) \}"
    )
    result = []
    for match in pattern.finditer(text):
        method, profile, transport, caps, mutates, signature = match.groups()
        capabilities = ", ".join(re.findall(r"'([^']+)'", caps)) or "none"
        result.append({
            "method": method,
            "profile": profile,
            "transport": transport,
            "capabilities": capabilities,
            "mutates": mutates,
            "signature": signature,
        })
    if not result:
        raise ValueError("no 420RPC method definitions found")
    return result


def parse_forbidden(text: str) -> tuple[list[str], list[str]]:
    prefix_match = re.search(r"FORBIDDEN_PREFIXES = \[([^\]]+)\]", text)
    explicit_match = re.search(r"EXPLICITLY_FORBIDDEN = new Set\(\[([^\]]+)\]\)", text)
    if not prefix_match or not explicit_match:
        raise ValueError("420RPC forbidden-surface definitions not found")
    prefixes = re.findall(r"'([^']+)'", prefix_match.group(1))
    explicit = re.findall(r"'([^']+)'", explicit_match.group(1))
    return prefixes, explicit


def parse_policy(text: str) -> tuple[bool, bool, list[str], list[str]]:
    allow = re.search(r"allowNotifications:\s*(true|false)", text)
    positional = re.search(r"requireArrayParams:\s*(true|false)", text)
    tags = re.search(r"BLOCK_TAGS = new Set\(\[([^\]]+)\]\)", text)
    subs = re.search(
        r"kind !== 'newHeads' && kind !== 'logs' && kind !== 'newPendingTransactions' && kind !== 'syncing'",
        text,
    )
    if not allow or not positional or not tags or not subs:
        raise ValueError("420RPC request-policy constants not found")
    return (
        allow.group(1) == "true",
        positional.group(1) == "true",
        re.findall(r"'([^']+)'", tags.group(1)),
        ["newHeads", "logs", "newPendingTransactions", "syncing"],
    )


def parameter_rule(method: str) -> str:
    rules = {
        "web3_clientVersion": "[]",
        "net_version": "[]",
        "eth_chainId": "[]",
        "eth_syncing": "[]",
        "eth_blockNumber": "[]",
        "eth_gasPrice": "[]",
        "eth_maxPriorityFeePerGas": "[]",
        "eth_getBalance": "[address, block]",
        "eth_getCode": "[address, block]",
        "eth_getTransactionCount": "[address, block]",
        "eth_getStorageAt": "[address, position, block]",
        "eth_getBlockByHash": "[hash, fullTransactions]",
        "eth_getBlockByNumber": "[block, fullTransactions]",
        "eth_getBlockTransactionCountByHash": "[hash]",
        "eth_getTransactionByHash": "[hash]",
        "eth_getTransactionReceipt": "[hash]",
        "eth_getBlockTransactionCountByNumber": "[block]",
        "eth_getTransactionByBlockHashAndIndex": "[hash, index]",
        "eth_getTransactionByBlockNumberAndIndex": "[block, index]",
        "eth_getLogs": "[filter]",
        "eth_call": "[transaction, block] (+ optional state override)",
        "eth_estimateGas": "[transaction] (+ optional block)",
        "eth_feeHistory": "[blockCount, newestBlock, rewardPercentiles]",
        "eth_sendRawTransaction": "[signedTransactionBytes]",
        "eth_subscribe": "[subscriptionType] (+ optional logs filter)",
        "eth_unsubscribe": "[subscriptionId]",
    }
    if method not in rules:
        raise ValueError(f"missing parameter rule for supported RPC method: {method}")
    return rules[method]


def render() -> str:
    method_text = METHODS.read_text(encoding="utf-8")
    policy_text = POLICY.read_text(encoding="utf-8")
    methods = parse_methods(method_text)
    prefixes, explicit = parse_forbidden(method_text)
    allow_notifications, positional, block_tags, subscriptions = parse_policy(policy_text)

    lines = [
        "---",
        "title: Generated public RPC reference",
        "audience:",
        "  - developer",
        "category: reference",
        "status: generated",
        "version: current",
        "---",
        "",
        "# Generated public RPC reference",
        "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate from `420-rpc/src/methods.ts` and `420-rpc/src/request-policy.ts`.",
        "",
        f"Method source SHA-256: `{sha256(METHODS)}`  ",
        f"Request-policy source SHA-256: `{sha256(POLICY)}`",
        "",
        "420RPC is a public ingress/policy layer over compatible execution RPC providers. It does not become consensus, execution, finality, account or signing authority.",
        "",
        "## Public compatibility surface",
        "",
        "| Method | Profile | Transport | Parameters | Required upstream capability | Mutates chain | Requires user signature |",
        "| --- | --- | --- | --- | --- | --- | --- |",
    ]
    for item in methods:
        lines.append(
            f"| `{item['method']}` | `{item['profile']}` | `{item['transport']}` | `{parameter_rule(item['method'])}` | `{item['capabilities']}` | {item['mutates']} | {item['signature']} |"
        )

    lines += [
        "",
        "## Request-envelope policy",
        "",
        f"- JSON-RPC notifications allowed: **{'yes' if allow_notifications else 'no'}**",
        f"- Positional array parameters required: **{'yes' if positional else 'no'}**",
        "- Invalid request envelope: `-32600`",
        "- Method outside the public compatibility surface: `-32601`",
        "- Invalid method parameters: `-32602`",
        f"- Accepted block selectors: {', '.join(f'`{tag}`' for tag in block_tags)} plus canonical hex quantities.",
        f"- Supported `eth_subscribe` kinds: {', '.join(f'`{kind}`' for kind in subscriptions)}.",
        "",
        "## Deliberately excluded public surface",
        "",
        "420RPC fails closed instead of forwarding arbitrary upstream methods.",
        "",
        f"- Forbidden namespaces/prefixes: {', '.join(f'`{prefix}`' for prefix in prefixes)}",
        f"- Explicitly forbidden account/signing methods: {', '.join(f'`{method}`' for method in explicit)}",
        "- Private Engine API is not part of this public reference.",
        "- Node-managed accounts, node-side signing, admin/debug/miner/txpool access are not public 420RPC capabilities.",
        "",
        "## Result-shape boundary",
        "",
        "The current 420RPC implementation owns admission, compatibility, routing and policy, but does not redeclare independent result schemas for canonical Ethereum JSON-RPC methods. Successful result shapes therefore remain those of the compatible execution upstream. This generated reference does not invent schemas that are not encoded in 420RPC source.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
