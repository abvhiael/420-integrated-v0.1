#!/usr/bin/env python3
"""Fail closed when the reviewed Resource authority inventory drifts.

This is a coverage/identity gate, not a proof that authorization is correct.
Security behavior is qualified separately by Solidity integration tests.
"""
import argparse
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MATRIX = "contracts/config/resource/resource-8a3-authorization-matrix.json"
FIELDS = {"operation", "principal", "directOwnership", "delegatedAuthority",
          "component", "action", "scope", "service", "economicLimits",
          "governanceEmergency", "lifecycle", "openFinding"}
EXPECTED = {
    "ResourceAuthorization420", "ResourcePolicyRegistry420",
    "ResourceProviderRegistry420", "ResourceProviderCollateral420",
    "ResourceNodeRegistry420", "ResourceOfferRegistry420",
    "ResourceSessionRegistry420", "ResourceReceiptRegistry420",
    "ResourceRouter420", "StorageProofSchemeRegistry420",
    "StorageCapacityRegistry420", "StorageCommitmentRegistry420",
    "StorageProofRegistry420", "StorageAgreementRegistry420",
    "StorageObjectManifestRegistry420", "StorageSettlementRegistry420",
}
# Mask comments and strings without removing line breaks or joining tokens.
LEX = re.compile(r'//[^\n]*|/\*.*?\*/|"(?:\\.|[^"\\])*"|\'(?:\\.|[^\'\\])*\'', re.S)
DECL = re.compile(r"\bfunction\s+(\w+)\s*\(([^{}]*?)\)\s*([^{};]*)\{")
def mask(source):
    return LEX.sub(lambda m: re.sub(r"[^\n]", " ", m.group()), source)

def inventory(source):
    s = mask(source)
    result = {}
    for m in DECL.finditer(s):
        name, args, modifiers = m.groups()
        if not re.search(r"\b(public|external)\b", modifiers):
            continue
        # The deliberately disabled legacy selector is an authority-relevant exception.
        if re.search(r"\b(view|pure)\b", modifiers) and name != "openSession":
            continue
        if name in result:
            raise ValueError(f"overloaded operation needs explicit signature inventory: {name}")
        start = m.end()
        depth = 1
        end = start
        while depth and end < len(s):
            depth += (s[end] == "{") - (s[end] == "}")
            end += 1
        if depth:
            raise ValueError(f"unterminated body: {name}")
        result[name] = s[start:end-1]
    if re.search(r"\b(?:receive|fallback)\s*\(", s):
        raise ValueError("receive/fallback must receive explicit matrix disposition")
    return result

def verify(root):
    data = json.loads((root / MATRIX).read_text())
    errors = []
    def need(ok, message):
        if not ok:
            errors.append(message)
    contracts = data["contracts"]
    need(data["schema"] == "420-resource-8a3-operation-authority-v1", "schema drift")
    need(set(contracts) == EXPECTED, "contract inventory drift")
    package = json.loads((root / "contracts/config/resource/resource-audit-8-deployment-package.json").read_text())
    need({x["contract"] for x in package["deployment_order"] if "constructor" in x} == EXPECTED,
         "deployment graph differs from matrix")
    src = root / "contracts/src/resource"
    auth = (src / "ResourceAuthorization420.sol").read_text()
    ids = {}
    for library in ("ResourceIds420", "StorageIds420", "StorageProofIds420"):
        raw = (src / (library + ".sol")).read_text()
        for name, value in re.findall(r'constant\s+(\w+)\s*=\s*keccak256\("([^"]+)"\)', raw):
            ids[library + "." + name] = value
    need(ids.get("ResourceIds420.COMPONENT_RESOURCE") == data["componentPreimage"], "component ID drift")
    need(len(set(ids.values())) == len(ids), "identifier preimage collision")
    declared_actions = set()
    count = 0
    for contract, rows in contracts.items():
        methods = inventory((src / (contract + ".sol")).read_text())
        names = [r["operation"] for r in rows]
        need(len(names) == len(set(names)), f"{contract}: duplicate rows")
        need(set(names) == set(methods), f"{contract}: missing={sorted(set(methods)-set(names))} stale={sorted(set(names)-set(methods))}")
        for row in rows:
            count += 1
            label = contract + "." + row["operation"]
            need(set(row) == FIELDS, f"{label}: invalid fields")
            for field in FIELDS - {"component", "action"}:
                need(isinstance(row.get(field), str) and bool(row[field].strip()), f"{label}: empty {field}")
            action = row.get("action")
            body = methods.get(row["operation"], "")
            if action:
                declared_actions.add(action)
                need(action in ids, f"{label}: unknown canonical action")
                need(row.get("component") == "ResourceIds420.COMPONENT_RESOURCE", f"{label}: incorrect component")
                need(action in body, f"{label}: action not referenced by operation")
                need(action in auth, f"{label}: action missing from typed authorization adapter")
            else:
                need(row.get("component") is None and row.get("delegatedAuthority") == "None",
                     f"{label}: unexpected delegated authority")
                need(not re.search(r"\b(?:ResourceIds420|StorageIds420|StorageProofIds420)\.ACTION_", body),
                     f"{label}: undeclared action reference")
    # OPEN_SESSION is a declared but unused historical action; the current entry
    # point uses direct consumer identity. Do not silently admit it as a grant.
    expected_actions = {k for k in ids if ".ACTION_" in k} - {"ResourceIds420.ACTION_OPEN_SESSION"}
    need(declared_actions == expected_actions, "action coverage drift")
    need(set(data["readOnly"]) == {"ResourceAuthorization420", "ResourceRouter420"}, "read-only inventory drift")
    need(all(not contracts.get(k) for k in data["readOnly"]), "read-only contract gained mutator")
    need("revert InvalidSession();" in inventory((src / "ResourceSessionRegistry420.sol").read_text()).get("openSession",""), "legacy selector disposition drift")
    for kind, derivation in data["scopeDerivations"].items():
        domain = re.search(r'"([^"]+)"', derivation)
        need(bool(domain) and domain.group(1) in auth, f"{kind}: scope domain drift")
    if errors:
        raise SystemExit("\n".join(errors))
    print(json.dumps({"pass": True, "contracts": len(contracts), "operations": count,
                      "delegatedActions": len(declared_actions), "status": data["status"]}, sort_keys=True))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", type=Path, default=ROOT)
    verify(parser.parse_args().root)
