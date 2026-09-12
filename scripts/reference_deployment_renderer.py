#!/usr/bin/env python3
"""Render DOC-10.8 canonical deployment reference from checked-in evidence sources."""
from __future__ import annotations
import hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CATALOGUE = ROOT / "developer-hub/catalogue/local.example.json"
DEPLOYMENT = ROOT / "developer-hub/deployment/request.example.json"
RELEASE = ROOT / "developer-hub/release/release-candidate.example.json"
DEPLOYMENT_CONTROL = ROOT / "developer-hub/src/deployment-control.mjs"
VERIFICATION_CONTROL = ROOT / "developer-hub/src/verification-control.mjs"
OUTPUT = ROOT / "docs/reference/generated/deployments.md"


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def render() -> str:
    catalogue = json.loads(CATALOGUE.read_text(encoding="utf-8"))
    contracts = catalogue.get("contracts", [])
    lines = [
        "---", "title: Generated canonical deployment reference", "audience:", "  - developer",
        "category: reference", "status: generated", "version: current", "---", "",
        "# Generated canonical deployment reference", "",
        "> GENERATED FILE - DO NOT EDIT. Current output fails closed unless deployment evidence satisfies the publication contract.", "",
        "## Evidence sources", "",
        f"- catalogue SHA-256: `{sha256(CATALOGUE)}` — `developer-hub/catalogue/local.example.json`",
        f"- deployment request SHA-256: `{sha256(DEPLOYMENT)}` — `developer-hub/deployment/request.example.json`",
        f"- release candidate SHA-256: `{sha256(RELEASE)}` — `developer-hub/release/release-candidate.example.json`",
        f"- deployment-control SHA-256: `{sha256(DEPLOYMENT_CONTROL)}`",
        f"- verification-control SHA-256: `{sha256(VERIFICATION_CONTROL)}`", "",
        "## Canonical publication contract", "",
        "A row is publishable here only when all of the following are available and mutually consistent:", "",
        "1. environment/chain identity is selected explicitly;",
        "2. a deployment receipt has been confirmed from canonical chain RPC;",
        "3. contract address and runtime code hash are bound to that confirmed receipt/state;",
        "4. build/source evidence is qualified and the relevant artifact/ABI identity is verified;",
        "5. verification evidence reaches the required reproducibility class where verification is claimed;",
        "6. Registry/governance/deployment provenance is approved for the published version;",
        "7. the record is not merely an example, plan, predicted address, manifest hint, or unconfirmed receipt.", "",
        "Deployment-control plans explicitly set `canonicalDeploymentProof: false`; recording a receipt still sets `requiresRpcConfirmation: true`. 420Verify results remain evidence only: they are not audits, official registration, Wallet authority, or canonical protocol state.", "",
        "## Publishable canonical deployments", "",
        "**None currently available from checked-in evidence.**", "",
        "The repository currently contains example-scoped deployment, release and catalogue inputs only. DOC-10 therefore refuses to publish any address as a canonical devnet/testnet/mainnet deployment.", "",
        "## Example catalogue records withheld from canonical publication", "",
        "| Contract | Chain | Address | Version | Deployment block | Declared source | Why withheld |",
        "| --- | --- | --- | --- | ---: | --- | --- |",
    ]
    for c in contracts:
        lines.append(f"| `{c.get('name','')}` | `{catalogue.get('chainId','')}` | `{c.get('address','')}` | `{c.get('version','')}` | {c.get('deploymentBlock','')} | `{c.get('source','')}` | catalogue file is `local.example.json`; declared artifact/interface are not checked in and ABI hash is example-grade, so this is not distributable canonical deployment evidence |")
    lines += ["", "## Status by environment", "", "| Environment | Canonical deployment reference |", "| --- | --- |", "| local | unavailable as canonical publication; only example-scoped records are checked in |", "| devnet | unavailable — no approved canonical deployment records checked in |", "| testnet | unavailable — no approved canonical deployment records checked in |", "| mainnet | unavailable — no approved canonical deployment records checked in |", ""]
    return "\n".join(lines)


def main() -> None:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(render(), encoding="utf-8", newline="\n")
    print(f"wrote {OUTPUT.relative_to(ROOT).as_posix()}")

if __name__ == "__main__": main()
