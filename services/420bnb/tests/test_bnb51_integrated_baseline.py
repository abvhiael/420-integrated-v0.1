"""BNB-5.1: independently recheck the integrated, immutable Phase 4 baseline.

These are provenance and ownership checks. They grant no issuer, booking, funds
or operational authority and do not substitute for production/testnet witnesses.
"""
import ast
import json
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[3]
BASE = "3f2cf64897e96c4f16213bcaf93564db72a174c9"
CERT_HEAD = "3a7cdf175840e11c337e36d1321490929b5634f3"
QUALIFIED = "7ccc76fe613ba4fdc162d459827f5ec95fae3385"
OLD_MAIN = "959288c8bd33b6da0325b6a5d060e00e7bcf0e48"
RECORD = ROOT / "docs/bnb/BNB-5.1-BASELINE-INVENTORY.json"


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def baseline(path):
    return git("show", BASE + ":" + path)


def record():
    return json.loads(RECORD.read_text())


def test_phase4_merge_has_both_authoritative_parents_and_unchanged_tree():
    parents = git("rev-list", "--parents", "-n", "1", BASE).split()
    assert parents == [BASE, OLD_MAIN, CERT_HEAD]
    subprocess.run(["git", "merge-base", "--is-ancestor", BASE, "HEAD"],
                   cwd=ROOT, check=True)
    assert git("rev-parse", BASE + "^{tree}") == git("rev-parse", CERT_HEAD + "^{tree}")
    changed = git("diff", "--name-only", QUALIFIED, BASE).splitlines()
    assert set(changed) == {
        "docs/bnb/BNB-4.12-LEVEL3-WIP-RECONCILIATION.md",
        "docs/bnb/BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md",
        "docs/bnb/BNB-PHASE4-ROADMAP.md",
    }


def test_pinned_certificate_and_inventory_have_real_source_provenance():
    rec = record()
    assert rec["source_sha"] == rec["main_sha"] == rec["phase4_merge_sha"] == BASE
    assert rec["phase4_certificate_head"] == CERT_HEAD
    assert rec["qualified_executable_sha"] == QUALIFIED
    assert rec["phase4_merged"] is True
    cert = baseline("docs/bnb/BNB-4.12-PHASE4-LEVEL3-CLOSEOUT.md")
    assert "REPOSITORY LEVEL 3 PASS" in cert and QUALIFIED in cert
    assert "TESTNET/PRODUCTION RELEASE BLOCKED" in cert
    paths = [entry["path"] for entry in rec["files"]]
    assert len(paths) == len(set(paths)) == 59
    for entry in rec["files"]:
        assert ".." not in Path(entry["path"]).parts
        assert git("rev-parse", BASE + ":" + entry["path"]) == entry["blob"]


def test_complete_migration_inventory_and_existing_migration_immutability():
    rec = record()
    prefix = "services/420bnb/migrations/"
    actual = git("ls-tree", "-r", "--name-only", BASE, prefix).splitlines()
    expected = sorted(e["path"] for e in rec["files"] if e["path"].startswith(prefix))
    assert actual == expected
    assert rec["migration_count"] == len(actual) == 26
    assert [int(Path(path).name[:3]) for path in actual] == list(range(1, 27))
    # Later phases may append migrations, but never silently rewrite these.
    for path in actual:
        assert git("hash-object", path) == git("rev-parse", BASE + ":" + path)


def test_all_baseline_http_routes_match_ast_without_duplicates():
    expected = record()["routes"]
    routes = []
    for node in ast.walk(ast.parse(baseline("services/420bnb/api.py"))):
        if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            continue
        for decorator in node.decorator_list:
            if (isinstance(decorator, ast.Call)
                    and isinstance(decorator.func, ast.Attribute)
                    and isinstance(decorator.func.value, ast.Name)
                    and decorator.func.value.id == "app"
                    and decorator.func.attr in {"get", "post", "put", "delete", "patch", "head", "options"}):
                routes.append({"method": decorator.func.attr.upper(),
                               "path": ast.literal_eval(decorator.args[0])})
    key = lambda item: (item["method"], item["path"])
    assert sorted(routes, key=key) == sorted(expected, key=key)
    assert len(routes) == len({key(item) for item in routes}) == 98


def test_gate_mapping_retains_all_owners_and_no_invented_external_gate():
    text = (ROOT / "docs/bnb/BNB-TESTNET-WORK-ROADMAP.md").read_text()
    gates = [line.split()[1] for line in text.splitlines() if line.startswith("## T-BNB-")]
    rec = record()
    assert len(gates) == len(set(gates)) == 17
    assert set(gates) == set(rec["gates"])
    mapping = rec["remaining_phase5_task_gate_map"]
    assert set(mapping) == {"BNB-5." + str(n) for n in range(1, 15)}
    assert all(values and set(values).issubset(gates) for values in mapping.values())
    roadmap = (ROOT / "docs/bnb/BNB-PHASE5-ROADMAP.md").read_text()
    assert "BNB-5.7" in roadmap and "BNB-5.13" in roadmap and "BNB-5.14" in roadmap


def test_current_release_flags_and_baseline_runtime_boundaries_fail_closed():
    template = json.loads((ROOT / "services/420bnb/deployment.template.json").read_text())
    assert template["booking_enabled"] is False
    assert template["financial_execution"] is False
    production = (ROOT / "services/420bnb/production.py").read_text()
    assert 'contract.get("booking_enabled") is False' in production
    assert 'contract.get("financial_execution") is False' in production
    outbox = ast.parse(baseline("services/420bnb/outbox.py"))
    names = {node.name for node in outbox.body if isinstance(node, ast.FunctionDef)}
    assert {"claim", "acknowledge", "fail", "replay", "process_batch"}.issubset(names)
    assert 'WHERE id=%s AND lease_owner=%s' in baseline("services/420bnb/outbox.py")
    compose = baseline("services/420bnb/compose.production.yml")
    assert all("\n  " + name + ":" in compose for name in ("api-a", "api-b", "web", "ingress", "migrate"))
    assert "\n  worker:" not in compose  # a Phase 5 task, not a deployed predecessor.


def test_qualification_owner_checks_implementation_head_and_has_provenance_history():
    workflow = (ROOT / ".github/workflows/bnb-runtime.yml").read_text()
    assert "ref: ${{ github.event.pull_request.head.sha || github.sha }}" in workflow
    assert "fetch-depth: 0" in workflow
    assert 'test "$(git rev-parse HEAD)" = "${{ github.event.pull_request.head.sha || github.sha }}"' in workflow
