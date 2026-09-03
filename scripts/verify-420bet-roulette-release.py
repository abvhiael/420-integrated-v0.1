#!/usr/bin/env python3
import copy
import json
import re
import sys
from pathlib import Path

SCHEMA = "420bet-roulette-v1-deployment-v1"
ZERO_ADDRESS = "0x" + "00" * 20
ZERO_BYTES32 = "0x" + "00" * 32
REQUIRED_CONTRACTS = (
    "roulette",
    "rouletteView",
    "wagerRouter",
    "randomnessRouter",
    "settlementEngine",
    "betRegistry",
    "accessPolicy",
    "vault",
    "betAuthorization",
)
REQUIRED_IDS = ("gameId", "gameVersionId", "rulesetId", "operatorId")
ADDRESS_RE = re.compile(r"^0x[0-9a-fA-F]{40}$")
BYTES32_RE = re.compile(r"^0x[0-9a-fA-F]{64}$")
SHA_RE = re.compile(r"^[0-9a-fA-F]{40}$")


def fail(message: str) -> None:
    raise ValueError(f"RouletteV1 deployment manifest: {message}")


def validate(manifest: dict) -> None:
    if manifest.get("schema") != SCHEMA:
        fail("unexpected schema")
    if manifest.get("status") != "PROMOTED":
        fail("status must be PROMOTED")

    chain = manifest.get("chain") or {}
    chain_id = chain.get("id")
    if not isinstance(chain_id, int) or isinstance(chain_id, bool) or chain_id <= 0:
        fail("invalid chain.id")
    if not chain.get("name"):
        fail("chain.name is required")
    rpc = chain.get("rpcUrl") or ""
    if not re.match(r"^https?://", rpc):
        fail("chain.rpcUrl must be a live http(s) URL")
    if re.search(r"REPLACE_WITH|example\.invalid|\.example(?:/|$)", rpc, re.I):
        fail("placeholder rpcUrl is not allowed")
    native = chain.get("nativeCurrency") or {}
    if not native.get("name") or not native.get("symbol"):
        fail("native currency metadata is required")
    decimals = native.get("decimals")
    if not isinstance(decimals, int) or isinstance(decimals, bool) or decimals < 0:
        fail("native currency decimals are required")

    contracts = manifest.get("contracts") or {}
    for key in REQUIRED_CONTRACTS:
        value = contracts.get(key) or ""
        if not ADDRESS_RE.match(value) or value.lower() == ZERO_ADDRESS:
            fail(f"contracts.{key} must be a nonzero address")
    asset = contracts.get("asset") or ""
    if not ADDRESS_RE.match(asset):
        fail("contracts.asset must be an address; zero means native 420")

    ids = manifest.get("ids") or {}
    for key in REQUIRED_IDS:
        value = ids.get(key) or ""
        if not BYTES32_RE.match(value) or value.lower() == ZERO_BYTES32:
            fail(f"ids.{key} must be a nonzero bytes32")

    promotion = manifest.get("promotion") or {}
    deployer = promotion.get("deployer") or ""
    if not ADDRESS_RE.match(deployer) or deployer.lower() == ZERO_ADDRESS:
        fail("promotion.deployer must be a nonzero address")
    source_commit = promotion.get("sourceCommit") or ""
    if not SHA_RE.match(source_commit) or set(source_commit) == {"0"}:
        fail("promotion.sourceCommit must be a nonzero 40-character commit SHA")
    deployed_at = promotion.get("deployedAt") or ""
    if not re.match(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$", deployed_at):
        fail("promotion.deployedAt must be UTC ISO-8601")


def valid_fixture() -> dict:
    return {
        "schema": SCHEMA,
        "status": "PROMOTED",
        "chain": {
            "id": 42001,
            "name": "420 Integrated Testnet",
            "rpcUrl": "https://rpc.testnet.420integrated.net",
            "nativeCurrency": {"name": "420", "symbol": "420", "decimals": 18},
        },
        "contracts": {
            "roulette": "0x1111111111111111111111111111111111111111",
            "rouletteView": "0x2222222222222222222222222222222222222222",
            "wagerRouter": "0x3333333333333333333333333333333333333333",
            "randomnessRouter": "0x4444444444444444444444444444444444444444",
            "settlementEngine": "0x5555555555555555555555555555555555555555",
            "betRegistry": "0x6666666666666666666666666666666666666666",
            "accessPolicy": "0x7777777777777777777777777777777777777777",
            "vault": "0x8888888888888888888888888888888888888888",
            "betAuthorization": "0x9999999999999999999999999999999999999999",
            "asset": ZERO_ADDRESS,
        },
        "ids": {
            "gameId": "0x" + "11" * 32,
            "gameVersionId": "0x" + "22" * 32,
            "rulesetId": "0x" + "33" * 32,
            "operatorId": "0x" + "44" * 32,
        },
        "promotion": {
            "deployer": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "sourceCommit": "1234567890abcdef1234567890abcdef12345678",
            "deployedAt": "2026-09-02T12:00:00Z",
        },
    }


def expect_reject(mutator, label: str) -> None:
    manifest = valid_fixture()
    mutator(manifest)
    try:
        validate(manifest)
    except ValueError:
        return
    raise AssertionError(f"expected rejection: {label}")


def self_test() -> None:
    validate(valid_fixture())
    expect_reject(lambda m: m.__setitem__("status", "DEPLOYED_AWAITING_CAPABILITIES"), "unpromoted")
    expect_reject(lambda m: m["chain"].__setitem__("rpcUrl", "https://rpc.example.invalid"), "placeholder rpc")
    expect_reject(lambda m: m["contracts"].__setitem__("roulette", ZERO_ADDRESS), "zero roulette")
    expect_reject(lambda m: m["contracts"].pop("settlementEngine"), "missing settlement engine")
    expect_reject(lambda m: m["ids"].__setitem__("rulesetId", ZERO_BYTES32), "zero ruleset")
    expect_reject(lambda m: m["promotion"].__setitem__("sourceCommit", "0" * 40), "zero source commit")

    root = Path(__file__).resolve().parents[1]
    example = root / "testnet/apps/420bet/roulette-v1.deployment.example.json"
    data = json.loads(example.read_text())
    if data.get("schema") != SCHEMA:
        raise AssertionError("example manifest schema drift")
    for key in REQUIRED_CONTRACTS + ("asset",):
        if key not in (data.get("contracts") or {}):
            raise AssertionError(f"example missing contracts.{key}")
    for key in REQUIRED_IDS:
        if key not in (data.get("ids") or {}):
            raise AssertionError(f"example missing ids.{key}")

    try:
        validate(copy.deepcopy(data))
    except ValueError:
        pass
    else:
        raise AssertionError("example manifest must remain non-promotable placeholder evidence")

    print("RouletteV1 release manifest validator self-test: PASS")


def main() -> None:
    if len(sys.argv) == 1:
        self_test()
        return
    if len(sys.argv) != 2:
        print(f"usage: {sys.argv[0]} [manifest.json]", file=sys.stderr)
        raise SystemExit(2)
    path = Path(sys.argv[1])
    manifest = json.loads(path.read_text())
    validate(manifest)
    print(f"RouletteV1 deployment manifest: PASS ({path})")


if __name__ == "__main__":
    main()
