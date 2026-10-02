#!/usr/bin/env python3
"""Verify STAKE-AUDIT-5 Wallet-integrated 420Stake application anchors."""

from __future__ import annotations
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def fail(message: str) -> None:
    print(f"STAKE-AUDIT-5 verifier FAILED: {message}", file=sys.stderr)
    raise SystemExit(1)

def require(path: str, tokens: list[str]) -> str:
    p = ROOT / path
    if not p.is_file():
        fail(f"missing {path}")
    text = p.read_text(encoding="utf-8")
    for token in tokens:
        if token not in text:
            fail(f"{path} missing required token: {token}")
    return text

def main() -> int:
    client = require("wallet/web/core/stake-management.js", [
        "FROZEN_STAKE_ADDRESSES",
        "registrationQuote",
        "sendRegistration",
        "sendTopUp",
        "sendReplaceCredit",
        "sendWithdraw",
        "validatorRewardAccrued(bytes32)",
        "validatorLifecycle(bytes32)",
        "eth_estimateGas",
        "eth_getTransactionReceipt",
        "420 Stake chain changed",
        "canonical deployment address mismatch",
        "Wallet never calls applyExitNotice directly",
    ])
    for forbidden in ("privateKey", "mnemonic", "seedPhrase", "personal_sign", "eth_sign"):
        if forbidden in client:
            fail(f"Stake client contains forbidden signing-secret/legacy-signing pattern: {forbidden}")

    ui = require("wallet/web/stake-management-ui.js", [
        "Validator staking",
        "Simulate & register",
        "Activation readiness",
        "Reward accrued",
        "stake-exit-guidance",
        "role=\"alert\"",
        "aria-live=\"assertive\"",
        "qualified chain-specific canonical Stake deployment",
    ])
    if "applyExitNotice.selector" in ui:
        fail("Wallet UI must not forge consensus-owned exit notice")

    shell = require("wallet/web/index.html", [
        'data-scroll-target="#stake-management-panel"',
        'src="./stake-management-ui.js"',
    ])
    _ = shell

    inventory = json.loads((ROOT / "wallet/deployment-inventory.json").read_text(encoding="utf-8"))
    app = inventory.get("appAuthority", {})
    expected = {
        "stake420": "0x000000000000000000000000000000000000043a",
        "validatorRegistry": "0x0000000000000000000000000000000000000423",
        "rewardController": "0x0000000000000000000000000000000000000420",
    }
    for key, address in expected.items():
        entry = app.get(key)
        if not entry or entry.get("address") != address:
            fail(f"wallet app authority {key} not bound to frozen address")
        if entry.get("deploymentVerified") is not False:
            fail(f"wallet app authority {key} must not overclaim deployment verification")

    runtime = json.loads((ROOT / "wallet/web/runtime-config.json").read_text(encoding="utf-8"))
    dep = runtime.get("deployment", {})
    for key in ("stakeAddress", "validatorRegistryAddress", "rewardControllerAddress"):
        if dep.get(key) is not None:
            fail(f"checked-in runtime must remain fail-closed for {key}")

    require("wallet/web/scripts/generate-runtime-config.mjs", [
        "assertStakeAppAuthority420",
        "stakeAddress: appAuthority.stake420.address",
        "validatorRegistryAddress: appAuthority.validatorRegistry.address",
        "rewardControllerAddress: appAuthority.rewardController.address",
    ])
    require("wallet/web/test/stake-management.test.js", [
        "registration derives exact owned bond",
        "canonical summary exposes lifecycle",
        "top-up and protocol-credit replacement",
        "withdrawal is enabled only",
        "simulation failure prevent transaction broadcast",
    ])
    require("wallet/web/test/stake-management-ui.test.js", [
        "420Stake UI exposes canonical registration",
        "Wallet shell publishes Stake navigation",
        "runtime config remains deliberately unbound",
    ])

    print("STAKE-AUDIT-5 verifier PASS: canonical Wallet Stake surface, fail-closed runtime binding and targeted qualification anchors present")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
