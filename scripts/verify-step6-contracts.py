#!/usr/bin/env python3
import json
import pathlib
import sys


def first_json_difference(expected, actual, path="$"):
    if type(expected) is not type(actual):
        return path, expected, actual, "type mismatch"

    if isinstance(expected, dict):
        for key in expected:
            child = f"{path}.{key}"
            if key not in actual:
                return child, expected[key], "<missing>", "missing key"
            diff = first_json_difference(expected[key], actual[key], child)
            if diff:
                return diff
        for key in actual:
            if key not in expected:
                return f"{path}.{key}", "<missing>", actual[key], "unexpected key"
        return None

    if isinstance(expected, list):
        common = min(len(expected), len(actual))
        for index in range(common):
            diff = first_json_difference(expected[index], actual[index], f"{path}[{index}]")
            if diff:
                return diff
        if len(expected) != len(actual):
            index = common
            if len(expected) > len(actual):
                return f"{path}[{index}]", expected[index], "<missing>", "missing list item"
            return f"{path}[{index}]", "<missing>", actual[index], "unexpected list item"
        return None

    if expected != actual:
        return path, expected, actual, "value mismatch"
    return None


def format_difference(label, diff):
    path, expected, actual, reason = diff
    return (
        f"{label} at {path}: {reason}; "
        f"expected={json.dumps(expected, sort_keys=True)} "
        f"actual={json.dumps(actual, sort_keys=True)}"
    )


def frozen_manifest_projection(assignments, manifest, frozen_through):
    frozen_address = frozen_through.lower()
    frozen_addresses = {item["address"].lower() for item in assignments}

    expected = {
        "governance_timelock": "0x0000000000000000000000000000000000000429",
        "contracts": [
            {
                "name": item["name"],
                "address": item["address"].lower(),
                "deployment": "GENESIS_SYSTEM_ADDRESS",
            }
            for item in assignments
        ],
    }

    projected_contracts = []
    for item in manifest.get("contracts", []):
        address = str(item.get("address", "")).lower()
        if address in frozen_addresses:
            projected_contracts.append(
                {
                    "name": item.get("name"),
                    "address": address,
                    "deployment": item.get("deployment"),
                }
            )

    actual = {
        "governance_timelock": str(manifest.get("governance_timelock", "")).lower(),
        "contracts": projected_contracts,
    }

    # Keep the frozen range explicit in this projection helper so a caller cannot
    # accidentally validate a different range while reusing the same assignments.
    if not assignments or assignments[-1]["address"].lower() != frozen_address:
        return expected, actual, (
            "$.contracts",
            frozen_address,
            assignments[-1]["address"].lower() if assignments else "<missing>",
            "frozen range mismatch",
        )

    return expected, actual, first_json_difference(expected, actual)


def verify(root):
    errors = []

    sysaddr = json.loads((root / "config/system-addresses.json").read_text())
    assign = sysaddr["assignments"]
    addresses = [x["address"].lower() for x in assign]
    names = [x["name"] for x in assign]
    if len(set(addresses)) != len(addresses):
        errors.append("duplicate system address")
    if len(set(names)) != len(names):
        errors.append("duplicate system name")
    if not addresses or addresses[0] != "0x0000000000000000000000000000000000000420":
        errors.append("range start wrong")
    if not addresses or addresses[-1] != "0x000000000000000000000000000000000000043c":
        errors.append("range end wrong")
    expected = [f"0x{i:040x}" for i in range(0x420, 0x43D)]
    if addresses != expected:
        errors.append("system address map must be contiguous and ordered through 0x043c")
    frozen_through = sysaddr.get("frozen_through", "").lower()
    if frozen_through != expected[-1]:
        errors.append("frozen_through mismatch")
    if (
        sysaddr.get("native_system_origin", {}).get("address", "").lower()
        != "0xfffffffffffffffffffffffffffffffffffffffe"
    ):
        errors.append("native system origin must equal go-ethereum params.SystemAddress")

    deployment_manifest_path = root / "contracts/config/deployment-manifest.json"
    if not deployment_manifest_path.exists():
        errors.append("missing contracts/config/deployment-manifest.json")
    else:
        deployment_manifest = json.loads(deployment_manifest_path.read_text())
        _, _, projection_diff = frozen_manifest_projection(
            assign, deployment_manifest, frozen_through
        )
        if projection_diff:
            errors.append(
                format_difference("deployment manifest frozen projection mismatch", projection_diff)
            )

    required = [
        "contracts/src/system/RewardController.sol",
        "contracts/src/system/AttentionTreasury.sol",
        "contracts/src/system/DevelopmentTreasury.sol",
        "contracts/src/system/ValidatorRegistry.sol",
        "contracts/src/system/CommunityValidatorReserve.sol",
        "contracts/src/system/FounderVestingRegistry.sol",
        "contracts/src/system/ConsensusSystemCall420.sol",
        "contracts/src/ai/AIProviderRegistry.sol",
        "contracts/src/ai/AIModelRegistry.sol",
        "contracts/src/ai/AIJobManager.sol",
        "contracts/src/ai/AIJobEscrow.sol",
        "contracts/src/ai/AIReputationRegistry.sol",
    ]
    for rel in required:
        if not (root / rel).exists():
            errors.append(f"missing {rel}")

    app = json.loads((root / "config/application-domains.json").read_text())
    if not all(d.startswith("420/APP/") for d in app["domains"]):
        errors.append("application domain prefix violation")
    protocol = json.loads((root / "config/protocol.json").read_text())
    for domain in protocol.get("cryptography", {}).get("domains", []):
        if str(domain).startswith("420/APP/"):
            errors.append("application domain leaked into consensus cryptography namespace")

    vr = (root / "contracts/src/system/ValidatorRegistry.sol").read_text()
    if "42_000 ether" not in vr or "21_000 ether" not in vr:
        errors.append("validator bond constants missing")
    cv = (root / "contracts/src/system/CommunityValidatorReserve.sol").read_text()
    if "6_300_000 ether" not in cv:
        errors.append("community validator reserve constant missing")
    fv = (root / "contracts/src/system/FounderVestingRegistry.sol").read_text()
    for token in [
        "FOUNDER_COUNT = 10",
        "LOCKED_PER_FOUNDER = 50_000 ether",
        "RELEASES = 13",
        "INTERVAL = 14 days",
    ]:
        if token not in fv:
            errors.append("founder vesting invariant missing: " + token)

    sc = (root / "contracts/src/system/ConsensusSystemCall420.sol").read_text()
    for token in [
        "0xfffffffffffffffffffffffffffffffffffffffe",
        "0x0000000000000000000000000000000000000420",
        "0x0000000000000000000000000000000000000423",
        "420/CONSENSUS_SYSTEM_CALL/V1",
    ]:
        if token not in sc:
            errors.append("consensus system-call invariant missing: " + token)

    return {
        "pass": not errors,
        "errors": errors,
        "system_address_count": len(assign),
        "application_domain_count": len(app["domains"]),
    }


def main():
    root = pathlib.Path(__file__).resolve().parents[1]
    out = verify(root)
    (root / "contracts/config/verification.json").write_text(json.dumps(out, indent=2) + "\n")
    print(json.dumps(out, indent=2))
    return 0 if out["pass"] else 2


if __name__ == "__main__":
    sys.exit(main())
