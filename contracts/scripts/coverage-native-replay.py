#!/usr/bin/env python3
"""One-time native replay of retained failed coverage input, never qualification."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys

root = Path(sys.argv[1])
context = root / "coverage-shard-0/context-9"
payload = json.loads((context / "compiler-input.json").read_text())
retained = json.loads((context / "compiler-attempts.json").read_text())
print("RETAINED_COMPILER_ATTEMPTS=" + json.dumps(retained), flush=True)
print("RETAINED_SETTINGS=" + (context / "compiler-settings.json").read_text(), flush=True)
for name, source in payload["sources"].items():
    if source.get("content") != Path("contracts", name).read_text():
        raise ValueError("Replay source differs from exact checked-out candidate: " + name)
print("REPLAY_SOURCES_MATCH_CURRENT_HEAD=" + str(len(payload["sources"])), flush=True)
compiler = Path.home() / ".svm/0.8.24/solc-0.8.24"
version = subprocess.run([str(compiler), "--version"], capture_output=True, text=True, check=True).stdout
if "Version: 0.8.24+commit.e11b9ed9." not in version:
    raise ValueError("Unexpected native compiler")
print(version, flush=True)
spec = importlib.util.spec_from_file_location("coverage_solc", "contracts/scripts/coverage-solc.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)
default_sequence = ("dhfoDgvulfnTUtnIf[xa[r]EscLMcCTUtTOntnfDIulLculVcul[j]"
    "Tpeulxa[rul]xa[r]cLgvifCTUca[r]LSsTFOtfDnca[r]Iulc]jmul[jul]VcTOculjmul")
variants = [
    ("solc-0.8.24-default-without-post-inline-ssa", {"enabled": True, "runs": 200,
        "details": {"yulDetails": {"optimizerSteps":
            "dhfoDgvulfnTUtnIf[xa[r]EscLMcCTUtTOntnfDIulLculVcul[j]Tpeulxa[rul]xa[r]cLgvif]jmul[jul]VcTOculjmul:fDnTOcmu"}}}),
    ("documented-sequence-split-before-inline", {"enabled": True, "runs": 200,
        "details": {"yulDetails": {"optimizerSteps": "dhfoD[xarrscLMcCTU]xgvifjmul:fDnTOcmu"}}}),
    ("solc-0.8.24-default-without-full-inliner", {"enabled": True, "runs": 200,
        "details": {"yulDetails": {"optimizerSteps": default_sequence.replace("i", "") + ":fDnTOcmu"}}}),
    ("canonical-without-stack-allocation", {"enabled": True, "runs": 200,
        "details": {"yulDetails": {"stackAllocation": False}}}),
]
print("REPLAY_OTHER_SETTINGS=" + json.dumps({k: v for k, v in payload["settings"].items()
    if k not in ("outputSelection", "remappings")}), flush=True)
output_dir = Path("artifacts/contracts/native-compiler-replay")
output_dir.mkdir(parents=True, exist_ok=True)
for name, optimizer in variants:
    candidate = copy.deepcopy(payload)
    if optimizer is not None:
        candidate["settings"]["optimizer"] = optimizer
    runner = lambda encoded: subprocess.run([str(compiler), "--standard-json"],
        input=encoded, capture_output=True, timeout=300)
    if optimizer is None:
        result, attempts, selected = bridge.compile_with_fallback(candidate, runner)
    else:
        result, errors, details = bridge.compile_attempt(candidate, runner)
        attempts, selected = [details], candidate
    record = {"variant": name, "attempts": attempts}
    print("NATIVE_REPLAY=" + json.dumps(record), flush=True)
    (output_dir / (name + ".json")).write_text(json.dumps(record, indent=2) + "\n")
    (output_dir / (name + "-input.json")).write_text(json.dumps(selected) + "\n")
    if not any(a["result"] == "PASS" for a in attempts):
        continue
    # A diagnostic compile is not an execution or a comprehensive PASS.
    print("NATIVE_REPLAY_COMPILED=" + name, flush=True)
targets = [
    "test/BetReferenceSlotVerticalSlice420.t.sol",
    "test/ComputeIndependentVerifierSelector420.t.sol",
    "test/ComputeWorkerConflictingResultSlashEvidence420.t.sol",
    "test/InteropAudit420.t.sol",
    "test/RegistryIdentityNames420.t.sol",
    "test/UniBridgeAdapter420.t.sol",
]
for target in targets:
    candidate = copy.deepcopy(payload)
    candidate["settings"]["outputSelection"] = {target: payload["settings"]["outputSelection"][target]}
    result, errors, details = bridge.compile_attempt(candidate,
        lambda encoded: subprocess.run([str(compiler), "--standard-json"],
            input=encoded, capture_output=True, timeout=300))
    record = {"target": target, "attempt": details}
    print("NATIVE_TARGET=" + json.dumps(record), flush=True)
    (output_dir / (Path(target).name + ".json")).write_text(json.dumps(record, indent=2) + "\n")
raise SystemExit("Diagnostic-only candidate is NOT qualified; select and verify correction.")
