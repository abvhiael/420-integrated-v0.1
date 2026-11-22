#!/usr/bin/env python3
"""Prepare one Genesis-bound FoundingWalletClaims420 deployment from authenticated founders.

Fails closed before 3 real wallet signatures + frozen V4. Emits constructor binding
metadata only; NEVER deploys, signs, creates keys, mints, or grants Treasury authority.
The actual live deploy must be broadcast by an external authorized signer.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "scripts/verify-founder-wallet-reservations.py"
spec = importlib.util.spec_from_file_location("founder_claim_deployment_verifier", MODULE)
verifier = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verifier)

CLAIMS = "contracts/src/governance/FoundingWalletClaims420.sol"
CANONICAL = "contracts/config/founder-wallet-reservations.json"
INTEGRATION = "contracts/config/founding-genesis-integration-v1.json"


def manifest(root=ROOT, rpc_url=None):
    root = Path(root)
    if verifier.validate(strict=True, root=root, rpc_url=rpc_url) != 3:
        raise ValueError("three verified founder wallets required")
    reservation = verifier.load(root, CANONICAL)
    integration = verifier.load(root, INTEGRATION)
    claim = reservation["claim_contract"]
    if claim.get("address") is not None or claim.get("deployment") != "REGISTRY_RESOLVED_NOT_DEPLOYED":
        raise ValueError("refuse to redeploy already bound founder claims")
    source = (root / CLAIMS).read_bytes()
    plan = reservation["planned_genesis_hash"]
    founders = reservation["founders"]
    addresses = [f["wallet_address"] for f in founders]
    if any(f["claim_tx"] is not None or f["ownership_status"] != "PREGENESIS_SIGNATURE_VERIFIED"
           for f in founders):
        raise ValueError("claims already recorded or founder proof missing")
    if integration["founderWallets"].get("claimRegistryAddress"):
        raise ValueError("claim deployment address already bound in Genesis integration")
    return {
        "schema": "420-founder-wallet-claims-deployment-intent-v1",
        "status": "VERIFIED_CONSTRUCTOR_INPUTS_NOT_BROADCAST",
        "deploymentMode": "REGISTRY_RESOLVED_NO_FROZEN_SYSTEM_ADDRESS",
        "source": CLAIMS,
        "sourceGitBlobSha1": verifier.sha1_blob(source),
        "contract": "FoundingWalletClaims420",
        "network": reservation["target_network"],
        "chainId": reservation["modeled_chain_id"],
        "genesisPlanCommitment": plan,
        "constructorTypes": ["address", "address", "address", "bytes32"],
        "constructorArgs": addresses + [plan],
        "founders": [{"role": f["role"], "address": f["wallet_address"],
                      "signatureMethod": f["pre_genesis_proof"]["method"]}
                     for f in founders],
        "deployedAddress": None,
        "runtimeCodeHash": None,
        "onChainClaims": 0,
        "authorizedToWithdrawTreasuryAssets": False,
    }


if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("--root", type=Path, default=ROOT)
    p.add_argument("--rpc-url", help="for deployed code-bound EIP-1271 proof verification")
    p.add_argument("--output", type=Path, help="write public constructor plan for external deployer")
    options = p.parse_args()
    try:
        model = manifest(options.root, options.rpc_url)
        output = json.dumps(model, indent=2) + "\n"
        if options.output:
            if options.output.exists():
                p.exit(1, "refusing to overwrite an existing deployment plan\n")
            options.output.write_text(output, encoding="utf-8")
        else:
            print(output, end="")
    except (ValueError, KeyError, AssertionError, TypeError, OSError, ImportError) as exc:
        p.exit(1, "founding claims deployment: FAIL-CLOSED: " + str(exc) + "\n")
