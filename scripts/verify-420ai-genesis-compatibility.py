#!/usr/bin/env python3
"""AI-AUDIT-2 frozen Genesis compatibility qualification.

This is an app-scoped Level 1 verifier. It proves that the five frozen 420AI
Genesis discovery identities remain consistent across canonical configuration,
that the predeploy plan still points at the intended compatibility contracts,
and that the compatibility contracts retain their frozen constructor/authority
boundaries. It does not claim live Genesis deployment or current ComputeMarket
integration qualification.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

EXPECTED = {
    "AIProviderRegistry": "0x000000000000000000000000000000000000042f",
    "AIModelRegistry": "0x0000000000000000000000000000000000000430",
    "AIJobManager": "0x0000000000000000000000000000000000000431",
    "AIJobEscrow": "0x0000000000000000000000000000000000000432",
    "AIReputationRegistry": "0x0000000000000000000000000000000000000433",
}

ADDRESS_FILES = [
    ROOT / "config" / "ai-genesis.json",
    ROOT / "config" / "system-addresses.json",
    ROOT / "contracts" / "config" / "system-addresses.json",
    ROOT / "contracts" / "config" / "deployment-manifest.json",
    ROOT / "contracts" / "config" / "genesis-canonical-addresses.json",
]

PREDEPLOY = ROOT / "contracts" / "config" / "predeploy" / "predeploy-plan.json"
ARCH = ROOT / "docs" / "420-AI-V1-ARCHITECTURE.md"
GENESIS_DOC = ROOT / "docs" / "STEP-4.2A-NATIVE-AI-GENESIS.md"
AI_SRC = ROOT / "contracts" / "src" / "ai"

errors: list[str] = []


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def canonical_name(record: dict) -> str | None:
    name = record.get("name")
    if isinstance(name, str):
        return name
    contract = record.get("contract")
    if isinstance(contract, str):
        return contract.removesuffix(".sol")
    return None


def normalize_address(value) -> str | None:
    if not isinstance(value, str):
        return None
    if re.fullmatch(r"0x[0-9a-fA-F]{40}", value):
        return value.lower()
    return None


for path in ADDRESS_FILES:
    if not path.is_file():
        errors.append(f"missing canonical address file: {path.relative_to(ROOT)}")
        continue
    doc = json.loads(path.read_text())
    found: dict[str, set[str]] = {name: set() for name in EXPECTED}

    # config/ai-genesis.json stores the interface map directly.
    interfaces = doc.get("interfaces") if isinstance(doc, dict) else None
    if isinstance(interfaces, dict):
        for name in EXPECTED:
            addr = normalize_address(interfaces.get(name))
            if addr:
                found[name].add(addr)

    # Other canonical files use name/address or contract/address records.
    for record in walk(doc):
        name = canonical_name(record)
        if name in EXPECTED:
            addr = normalize_address(record.get("address"))
            if addr:
                found[name].add(addr)

    for name, expected in EXPECTED.items():
        if found[name] != {expected}:
            errors.append(
                f"{path.relative_to(ROOT)}: {name} expected only {expected}, found {sorted(found[name])}"
            )

if not PREDEPLOY.is_file():
    errors.append("missing contracts/config/predeploy/predeploy-plan.json")
else:
    plan = json.loads(PREDEPLOY.read_text())
    entries = {
        canonical_name(record): record
        for record in walk(plan)
        if canonical_name(record) in EXPECTED and normalize_address(record.get("address"))
    }
    for name, expected in EXPECTED.items():
        entry = entries.get(name)
        if not entry:
            errors.append(f"predeploy plan missing {name}")
            continue
        if normalize_address(entry.get("address")) != expected:
            errors.append(f"predeploy plan address drift for {name}")
        if entry.get("source") != f"ai/{name}.sol":
            errors.append(f"predeploy plan source drift for {name}: {entry.get('source')!r}")
        if entry.get("artifact") != f"contracts/artifacts/{name}.json":
            errors.append(f"predeploy plan artifact drift for {name}: {entry.get('artifact')!r}")
        if entry.get("constructor_strategy") != "GENESIS_STORAGE_INITIALIZATION":
            errors.append(f"predeploy constructor strategy drift for {name}")
        if entry.get("status") != "SOURCE_READY":
            errors.append(f"predeploy source status drift for {name}: {entry.get('status')!r}")

for path in (ARCH, GENESIS_DOC):
    text = path.read_text()
    for name, address in EXPECTED.items():
        short = address[-4:]
        if name not in text or short.lower() not in text.lower():
            errors.append(f"{path.relative_to(ROOT)} missing frozen identity {name} / ...{short}")

constructor_pattern = re.compile(
    r"constructor\s*\(address\s+timelock_\)\s+SystemAccess\s*\(timelock_\)\s*\{\s*\}",
    re.MULTILINE,
)
for name in EXPECTED:
    source = AI_SRC / f"{name}.sol"
    if not source.is_file():
        errors.append(f"missing compatibility source: contracts/src/ai/{name}.sol")
        continue
    text = source.read_text()
    if not constructor_pattern.search(text):
        errors.append(f"{name}: constructor no longer cleanly delegates only governance timelock initialization")

job = (AI_SRC / "AIJobManager.sol").read_text()
escrow = (AI_SRC / "AIJobEscrow.sol").read_text()
provider = (AI_SRC / "AIProviderRegistry.sol").read_text()
model = (AI_SRC / "AIModelRegistry.sol").read_text()
reputation = (AI_SRC / "AIReputationRegistry.sol").read_text()

required_source_tokens = {
    "AIJobManager": [
        "address public constant AI_JOB_ESCROW = address(0x0000000000000000000000000000000000000432);",
        "if (msg.sender != AI_JOB_ESCROW) revert NotEscrow();",
        "if (computeAdapterBound) revert AdapterAlreadyBound();",
        "if (j.status != from) revert InvalidTransition();",
    ],
    "AIJobEscrow": [
        "address public constant AI_JOB_MANAGER = address(0x0000000000000000000000000000000000000431);",
        "function fund(bytes32, bytes32) external payable { revert DirectCustodyDisabled(); }",
        "if (to != e.beneficiary) revert InvalidRecipient();",
        "if (vaultAdapterBound) revert AdapterAlreadyBound();",
        "if (settlementAdapterBound) revert AdapterAlreadyBound();",
    ],
    "AIProviderRegistry": [
        "if (msg.sender != operatorAccount) revert NotOperator();",
        "if (p.state == ProviderState.RETIRED) revert InvalidStateTransition();",
        "if (p.state == ProviderState.ACTIVE) revert ActiveStakeLocked();",
    ],
    "AIModelRegistry": [
        "if (_modelVersions[modelVersionId].exists || versionIdByNumber[modelId][version] != bytes32(0))",
        "v.state = VersionState.DEPRECATED;",
        "if (m.creator != msg.sender) revert NotCreator();",
    ],
    "AIReputationRegistry": [
        "function setReputation(bytes32, uint64, uint64, uint64) external pure",
        "revert InvalidEvidence();",
        "if (evidenceApplied[evidenceId]) revert EvidenceAlreadyApplied();",
        "modifier onlyTrustAdapter()",
    ],
}
texts = {
    "AIJobManager": job,
    "AIJobEscrow": escrow,
    "AIProviderRegistry": provider,
    "AIModelRegistry": model,
    "AIReputationRegistry": reputation,
}
for name, tokens in required_source_tokens.items():
    for token in tokens:
        if token not in texts[name]:
            errors.append(f"{name}: required compatibility boundary missing: {token}")

if errors:
    print("420AI Genesis compatibility qualification FAILED")
    for error in errors:
        print(f"- {error}")
    raise SystemExit(1)

print("420AI Genesis compatibility qualification PASSED")
for name, address in EXPECTED.items():
    print(f"- {name}: {address}")
print(f"verified canonical address files: {len(ADDRESS_FILES)}")
print("verified predeploy plan source/artifact/address/constructor status")
print("verified one-way compatibility authority/lifecycle source boundaries")
print("live Genesis materialization and current ComputeMarket integration intentionally deferred")
