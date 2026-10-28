#!/usr/bin/env python3
"""Fail-closed 420Bet 5D.6 manifest and optional live-chain read-only verifier."""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

ADDR = re.compile(r"0x[0-9a-fA-F]{40}\Z")
HASH = re.compile(r"0x[0-9a-fA-F]{64}\Z")
COMPONENTS = ("vault", "oracle_gate", "oracle_router", "feed_registry",
              "provider_registry", "risk_policy", "certification")
REQUIRED_GOVERNANCE = ("independent_organizations_verified", "source_rights_verified",
    "key_custody_verified", "adjudicator_separation_verified", "revocation_drill_passed")


def require(ok, reason, errors):
    if not ok:
        errors.append(reason)


def cast(*args):
    p = subprocess.run(["cast", *args], capture_output=True, text=True, check=False, timeout=30)
    if p.returncode:
        raise RuntimeError(f"cast failed ({' '.join(args[:3])}): {p.stderr.strip()}")
    return p.stdout.strip()


def check(manifest, production=False, rpc=None):
    errors = []
    require(manifest.get("schema") == "420.bet.sports.5d6.deployment.v1", "schema", errors)
    policy = manifest.get("policy", {})
    require(policy.get("oracle_only_funding") is True, "oracle-only fuse required", errors)
    require(policy.get("aggregation_mode") == "AGGREGATION_QUORUM_EQUAL", "result quorum mode", errors)
    require(type(policy.get("minimum_sources")) is int and
        2 <= policy["minimum_sources"] <= 16, "minimum oracle quorum 2..16", errors)
    require(type(policy.get("minimum_confidence_bps")) is int and
        9000 <= policy["minimum_confidence_bps"] <= 10000, "confidence basis points", errors)
    require(type(policy.get("max_age_seconds")) is int and
        0 < policy["max_age_seconds"] <= 7200, "bounded max-age", errors)
    require(policy.get("risk_policy_halted") is False, "halted policy", errors)

    artifacts = manifest.get("artifacts", {})
    for name in COMPONENTS:
        item = artifacts.get(name, {})
        addr, digest = item.get("address"), item.get("code_hash")
        if production or addr is not None or digest is not None:
            require(isinstance(addr, str) and ADDR.fullmatch(addr) is not None and
                    int(addr, 16) != 0, f"{name}: address", errors)
            require(isinstance(digest, str) and HASH.fullmatch(digest) is not None and
                    int(digest, 16) != 0, f"{name}: code_hash", errors)
    if production:
        require(manifest.get("status") == "READY_FOR_TESTNET_ACCEPTANCE",
                "release status must be READY_FOR_TESTNET_ACCEPTANCE", errors)
        require(isinstance(manifest.get("chain_id"), int) and manifest["chain_id"] > 0,
                "chain_id", errors)
        gov = manifest.get("reporter_governance", {})
        for field in REQUIRED_GOVERNANCE:
            require(gov.get(field) is True, "missing independent evidence: " + field, errors)
        att = manifest.get("attestation", {})
        for name in ("exact_implementation_sha", "source_commit_hash", "approved_by",
                     "independent_review_hash"):
            require(bool(att.get(name)), "missing attestation: " + name, errors)
        require(att.get("live_chain_verified") is True and att.get("external_acceptance") is True,
                "live/external acceptance not documented", errors)
        require(bool(manifest.get("markets")), "no markets configured", errors)
    for i, m in enumerate(manifest.get("markets", [])):
        pre = f"market[{i}]"
        for field in ("market_id", "feed_id", "risk_group_id"):
            value = m.get(field)
            require(isinstance(value, str) and HASH.fullmatch(value) is not None
                    and int(value, 16) != 0, f"{pre}: {field}", errors)
        require(isinstance(m.get("risk_group_limit"), int) and m["risk_group_limit"] > 0,
                f"{pre}: positive risk group limit", errors)
        require(m.get("oracle_gate_bound") is True, f"{pre}: Oracle binding", errors)
        require(m.get("risk_group_bound") is True, f"{pre}: risk group binding", errors)
        require(m.get("direct_resolver_grants_revoked") is True,
                f"{pre}: legacy grants not revoked", errors)
    if rpc:
        for name in COMPONENTS:
            item = artifacts.get(name, {})
            addr, digest = item.get("address"), item.get("code_hash")
            if not isinstance(addr, str) or not ADDR.fullmatch(addr):
                errors.append(f"live: {name} not configured")
                continue
            try:
                actual = cast("codehash", addr, "--rpc-url", rpc).split()[0]
                require(actual.lower() == str(digest).lower(), f"live: {name} codehash mismatch", errors)
            except (RuntimeError, subprocess.TimeoutExpired, FileNotFoundError) as e:
                errors.append(f"live: {name}: {e}")
        vault = artifacts.get("vault", {}).get("address")
        gate = artifacts.get("oracle_gate", {}).get("address")
        if vault and gate and ADDR.fullmatch(vault) and ADDR.fullmatch(gate):
            try:
                fuse = cast("call", vault, "oracleOnlyFunding()(bool)", "--rpc-url", rpc)
                require(fuse.lower().startswith("true"), "live: oracle-only fuse OFF", errors)
                linked = cast("call", gate, "vault()(address)", "--rpc-url", rpc)
                require(linked.lower() == vault.lower(), "live: gate points to wrong vault", errors)
                gate_quorum = int(cast("call", gate, "minAgreeingSources()(uint16)", "--rpc-url", rpc).split()[0], 0)
                gate_confidence = int(cast("call", gate, "minConfidenceBps()(uint16)", "--rpc-url", rpc).split()[0], 0)
                gate_age = int(cast("call", gate, "maxAge()(uint64)", "--rpc-url", rpc).split()[0], 0)
                require(gate_quorum >= policy["minimum_sources"], "live: weak gate quorum", errors)
                require(gate_confidence >= policy["minimum_confidence_bps"], "live: weak gate confidence", errors)
                require(0 < gate_age <= policy["max_age_seconds"], "live: weak gate freshness", errors)
                oracle = artifacts["oracle_router"]["address"]
                certification = artifacts["certification"]["address"]
                require(cast("call", gate, "oracle()(address)", "--rpc-url", rpc).lower() ==
                        oracle.lower(), "live: gate Oracle mismatch", errors)
                require(cast("call", gate, "certification()(address)", "--rpc-url", rpc).lower() ==
                        certification.lower(), "live: certifier mismatch", errors)
                for i, m in enumerate(manifest.get("markets", [])):
                    market_id = m.get("market_id")
                    if not isinstance(market_id, str) or not HASH.fullmatch(market_id):
                        continue
                    actual = cast("call", vault, "marketOracleGate(bytes32)(address)",
                                  market_id, "--rpc-url", rpc)
                    require(actual.lower() == gate.lower(), f"live: market[{i}] gate mismatch", errors)
                    group = cast("call", vault, "marketRiskGroup(bytes32)(bytes32)",
                                 market_id, "--rpc-url", rpc)
                    require(group.lower() == m["risk_group_id"].lower(),
                            f"live: market[{i}] risk group mismatch", errors)
                    expected_feed = cast("call", gate, "feedFor(bytes32)(bytes32)",
                                         market_id, "--rpc-url", rpc)
                    require(expected_feed.lower() == m["feed_id"].lower(),
                            f"live: market[{i}] oracle feed mismatch", errors)
                    feeds = artifacts["feed_registry"]["address"]
                    active = cast("call", feeds, "feedActive(bytes32)(bool)", m["feed_id"],
                                  "--rpc-url", rpc)
                    require(active.lower().startswith("true"), f"live: market[{i}] feed inactive", errors)
                    source_count = int(cast("call", feeds, "minSourcesOf(bytes32)(uint8)",
                                            m["feed_id"], "--rpc-url", rpc), 0)
                    require(source_count >= policy["minimum_sources"],
                            f"live: market[{i}] insufficient source configuration", errors)
                    heartbeat = int(cast("call", feeds, "heartbeatOf(bytes32)(uint32)",
                                         m["feed_id"], "--rpc-url", rpc), 0)
                    require(heartbeat <= policy["max_age_seconds"] and heartbeat > 0,
                            f"live: market[{i}] heartbeat too permissive", errors)
                    expected_mode = cast("keccak",
                        "0x" + b"420/ORACLE/AGGREGATION/QUORUM_EQUAL/V1".hex())
                    expected_type = cast("keccak",
                        "0x" + b"420/ORACLE/FEED/OUTCOME/V1".hex())
                    mode = cast("call", feeds, "aggregationModeOf(bytes32)(bytes32)",
                                m["feed_id"], "--rpc-url", rpc)
                    kind = cast("call", feeds, "feedTypeOf(bytes32)(bytes32)",
                                m["feed_id"], "--rpc-url", rpc)
                    require(mode.lower() == expected_mode.lower() and
                            kind.lower() == expected_type.lower(),
                            f"live: market[{i}] oracle result feed type/mode", errors)
                    active_sources = 0
                    total_sources = int(cast("call", feeds, "sourceCount(bytes32)(uint256)",
                                             m["feed_id"], "--rpc-url", rpc).split()[0], 0)
                    for j in range(min(total_sources, 16)):
                        provider_id = cast("call", feeds, "sourceAt(bytes32,uint256)(bytes32)",
                                           m["feed_id"], str(j), "--rpc-url", rpc)
                        active = cast("call", feeds, "sourceActive(bytes32,bytes32)(bool)",
                                      m["feed_id"], provider_id, "--rpc-url", rpc)
                        active_sources += active.lower().startswith("true")
                    require(active_sources >= policy["minimum_sources"],
                            f"live: market[{i}] active independent provider IDs", errors)
                    risk_address = artifacts["risk_policy"]["address"]
                    risk_values = cast("call", risk_address,
                        "policy(bytes32)(uint16,uint16,bool,bool)", m["feed_id"],
                        "--rpc-url", rpc).split()
                    require(len(risk_values) >= 4 and
                            int(risk_values[0], 0) >= policy["minimum_confidence_bps"] and
                            risk_values[2].lower() == "false" and
                            risk_values[3].lower() == "true",
                            f"live: market[{i}] risk policy not configured or halted", errors)
            except (RuntimeError, subprocess.TimeoutExpired, FileNotFoundError) as e:
                errors.append(f"live: binding check: {e}")
    if production and not rpc:
        errors.append("production acceptance requires --rpc-url live verification")
    return errors


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", type=Path,
        default=Path("contracts/config/bet/sports-5d6-pretestnet-manifest.v1.json"))
    p.add_argument("--mode", choices=("prelaunch", "production"), default="prelaunch")
    p.add_argument("--rpc-url", default=None)
    args = p.parse_args()
    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        errors = check(manifest, args.mode == "production", args.rpc_url)
    except (ValueError, OSError, TypeError, KeyError) as e:
        errors = [f"invalid manifest: {e}"]
    for error in errors:
        print("FAIL:", error)
    if errors:
        return 1
    print("PASS: manifest structure" if args.mode == "prelaunch" else "PASS: production manifest and live checks")
    return 0


if __name__ == "__main__":
    sys.exit(main())
