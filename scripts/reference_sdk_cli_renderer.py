#!/usr/bin/env python3
"""Deterministically render DOC-10.6 SDK and primary CLI reference from implementation source."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SDK_INDEX = ROOT / "packages" / "420-sdk" / "src" / "index.ts"
SDK_WALLET = ROOT / "packages" / "420-sdk" / "src" / "wallet.ts"
SDK_PACKAGE = ROOT / "packages" / "420-sdk" / "package.json"
CLI_PACKAGE = ROOT / "packages" / "420-cli" / "package.json"
CLI_MAIN = ROOT / "packages" / "420-cli" / "bin" / "420.mjs"
OUTPUT = ROOT / "docs" / "reference" / "generated" / "sdk-cli.md"


def exported_symbols(text: str) -> list[tuple[str, str]]:
    pattern = re.compile(r"^export\s+(interface|class|function|type|const)\s+([A-Za-z_][A-Za-z0-9_]*)", re.M)
    return [(kind, name) for kind, name in pattern.findall(text)]


def help_commands(text: str) -> list[str]:
    match = re.search(r"function help\(\)\{process\.stdout\.write\(`420 CLI \$\{VERSION\}\\n\\nUsage:\\n(.*?)`\);\}", text, re.S)
    if not match:
        raise ValueError("420 CLI help block not found")
    commands = []
    for raw in match.group(1).split("\\n"):
        line = raw.strip()
        if line.startswith("420 "):
            commands.append(line)
    if not commands:
        raise ValueError("no primary 420 CLI commands found")
    return commands


def render() -> str:
    sdk_index = SDK_INDEX.read_text(encoding="utf-8")
    sdk_wallet = SDK_WALLET.read_text(encoding="utf-8")
    cli_main = CLI_MAIN.read_text(encoding="utf-8")
    sdk_pkg = json.loads(SDK_PACKAGE.read_text(encoding="utf-8"))
    cli_pkg = json.loads(CLI_PACKAGE.read_text(encoding="utf-8"))

    sdk_symbols = exported_symbols(sdk_index) + exported_symbols(sdk_wallet)
    commands = help_commands(cli_main)
    binaries = cli_pkg.get("bin", {})

    lines = [
        "---",
        "title: Generated SDK and CLI reference",
        "audience:",
        "  - developer",
        "category: reference",
        "status: generated",
        "version: current",
        "---",
        "",
        "# Generated SDK and CLI reference",
        "",
        "> GENERATED FILE - DO NOT EDIT. Regenerate from the checked-in `@420/sdk` and `@420/cli` implementation sources.",
        "",
        f"SDK package: `{sdk_pkg.get('name')}` `{sdk_pkg.get('version')}`  ",
        f"CLI package: `{cli_pkg.get('name')}` `{cli_pkg.get('version')}`  ",
        f"Node engine: SDK `{sdk_pkg.get('engines', {}).get('node')}`, CLI `{cli_pkg.get('engines', {}).get('node')}`",
        "",
        "The SDK and CLI are convenience/integration layers. They do not become consensus, execution, Registry, Wallet, governance, settlement or finality authority.",
        "",
        "## SDK exports",
        "",
        "| Kind | Symbol | Source |",
        "| --- | --- | --- |",
    ]
    index_names = {name for _kind, name in exported_symbols(sdk_index)}
    for kind, name in sdk_symbols:
        source = "packages/420-sdk/src/index.ts" if name in index_names else "packages/420-sdk/src/wallet.ts"
        lines.append(f"| `{kind}` | `{name}` | `{source}` |")

    lines += [
        "",
        "## SDK configuration and authority boundaries",
        "",
        "- `createSdk420` requires discovered network metadata, a verified contract catalogue and a JSON-RPC transport.",
        "- Network and contract-catalogue chain identity must match; a mismatched chain fails closed with `SdkConfigurationError420`.",
        "- The selected SDK RPC endpoint must be declared by the selected network discovery record.",
        "- `createWalletSdk420` requires canonical `SmartAccountFactory420` and `CapabilityRegistry420` catalogue entries.",
        "- Wallet connection checks the connected wallet chain against the SDK network.",
        "- Smart Account discovery rejects a non-canonical factory or capability registry when those values are supplied by the runtime adapter.",
        "- Session preparation, submission and confirmation are delegated to the Wallet provider/runtime adapter. The SDK surface accepts no raw private key, seed phrase or mnemonic.",
        "",
        "## Primary `420` CLI commands",
        "",
        "The following command forms are extracted from the primary CLI help contract:",
        "",
    ]
    lines.extend(f"- `{command}`" for command in commands)

    lines += [
        "",
        "## CLI runtime options and defaults",
        "",
        "- `--manifest PATH` selects the network manifest where supported.",
        "- `--catalogue PATH` selects the contract catalogue where supported.",
        "- `--rpc URL` may override the RPC endpoint only where the command supports it; SDK validation still requires the endpoint to belong to the selected network discovery record.",
        "- Without overrides, the primary CLI uses `developer-hub/manifests/local.example.json` and `developer-hub/catalogue/local.example.json`; these defaults are local-example scope, not testnet/mainnet identity.",
        "- CLI output is structured JSON; failures use the `420_CLI_ERROR=` prefix and non-zero exit codes.",
        "",
        "## Installed CLI binaries",
        "",
        "| Binary | Entry point |",
        "| --- | --- |",
    ]
    for name, target in sorted(binaries.items()):
        lines.append(f"| `{name}` | `{target}` |")

    lines += [
        "",
        "## Secret and signer boundary",
        "",
        "The primary `420` CLI performs discovery, reads, planning, verification views, debugging and service requests. It does not expose a command-line option for a private key, seed phrase or mnemonic, and its SDK dependency does not create autonomous signer authority. State-changing user authorization remains outside this convenience layer and must stay with the qualified Wallet/external signer boundary.",
        "",
    ]
    return "\n".join(lines)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT).as_posix()}")


if __name__ == "__main__":
    main()
