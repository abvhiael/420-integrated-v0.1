#!/usr/bin/env python3
"""Coverage-only Solc bridge; canonical builds continue to use Solc directly.

Foundry's --ir-minimum disables the optimizer passes required by this repository's
existing ABI decoders/encoders. Restore the canonical optimizer for instrumentation
without changing sources, EVM target or test inventory. Emit dependency source
maps as well as primary targets, so cross-partition calls remain covered. Optimized
IR coverage has approximate source mappings; it is not a coverage-percentage gate.
"""
import copy
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys

VERSION = "0.8.24+commit.e11b9ed9"
CANONICAL_OPTIMIZER = {"enabled": True, "runs": 200}


def restore_optimizer(payload):
    settings = payload["settings"]
    optimizer = settings["optimizer"]
    if (os.environ.get("FOUNDRY_PROFILE") != "coverage"
            or os.environ.get("FOUNDRY_DYNAMIC_TEST_LINKING") != "false"
            or settings.get("viaIR") is not True
            or settings.get("evmVersion") != "cancun"
            or optimizer.get("enabled") is not True
            or optimizer.get("runs") != 200
            or optimizer.get("details", {}).get("yulDetails", {}).get("optimizerSteps") != "u"):
        raise ValueError("Refusing non-coverage or unexpected compiler settings")
    outputs = settings["outputSelection"]
    fields = sorted({field for selections in outputs.values()
                     for field in selections.get("*", [])})
    if "evm.bytecode.object" not in fields or "evm.deployedBytecode.sourceMap" not in fields:
        raise ValueError("Coverage requires complete bytecode and runtime source maps")
    settings["optimizer"] = dict(CANONICAL_OPTIMIZER)
    # Foundry resolves the dependency closure even for skipped primary targets.
    # Retain runtime maps for every resolved input, without dropping any fields.
    for source in payload["sources"]:
        selections = outputs.setdefault(source, {})
        selections["*"] = sorted(set(selections.get("*", [])) | set(fields))
    return optimizer


# The documented Solidity 0.8.24 sequence omits full function inlining,
# retaining the other simplifying/cleanup passes and automatic stack handling.
# It is used only after a pinned compiler reports a Yul stack-depth error.
STACK_SAFE_SEQUENCE = "dhfoD[xarrscLMcCTU]uljmul:fDnTOcmu"


def compile_attempt(payload, compiler_run):
    encoded = json.dumps(payload).encode()
    result = compiler_run(encoded)
    output = json.loads(result.stdout)
    errors = [error for error in output.get("errors", [])
              if error.get("severity") == "error"]
    details = {
        "optimizer": payload["settings"]["optimizer"],
        "input_sha256": hashlib.sha256(encoded).hexdigest(),
        "sources_sha256": hashlib.sha256(json.dumps(payload["sources"],
            sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "exit_code": result.returncode,
        "errors": errors,
        "result": "PASS" if result.returncode == 0 and not errors else "FAIL",
    }
    return result, errors, details


def compile_with_fallback(payload, compiler_run):
    result, errors, first = compile_attempt(payload, compiler_run)
    attempts = [first]
    selected = payload
    if (result.returncode == 0 and errors
            and all(error.get("type") == "YulException"
                    and "too deep in the stack" in error.get("message", "")
                    for error in errors)):
        selected = copy.deepcopy(payload)
        selected["settings"]["optimizer"] = {
            **CANONICAL_OPTIMIZER,
            "details": {"yulDetails": {"optimizerSteps": STACK_SAFE_SEQUENCE}}}
        result, _, details = compile_attempt(selected, compiler_run)
        attempts.append(details)
    return result, attempts, selected



def main():
    compiler = Path.home() / ".svm/0.8.24/solc-0.8.24"
    version = subprocess.run([str(compiler), "--version"], capture_output=True,
                             text=True, check=True).stdout
    if f"Version: {VERSION}." not in version:
        raise ValueError("Coverage requires the pinned Solidity 0.8.24 compiler")
    if "--standard-json" not in sys.argv[1:]:
        os.execv(str(compiler), [str(compiler), *sys.argv[1:]])
    payload = json.load(sys.stdin)
    original = restore_optimizer(payload)
    evidence = Path(os.environ["COVERAGE_EVIDENCE_DIR"])
    evidence.mkdir(parents=True, exist_ok=True)
    provenance = {
        "compiler": VERSION,
        "profile": "coverage",
        "dynamic_test_linking": False,
        "original_optimizer": original,
        "instrumented_optimizer": CANONICAL_OPTIMIZER,
        "viaIR": payload["settings"]["viaIR"],
        "evmVersion": payload["settings"]["evmVersion"],
        "source_count": len(payload["sources"]),
        "emitted_dependency_context": "all resolved inputs retain bytecode and runtime source maps",
        "sources_sha256": hashlib.sha256(json.dumps(payload["sources"],
            sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "source_mapping": "approximate optimized IR; no precise percentage acceptance claimed",
    }
    # Retain the exact bounded compiler input, including a failed first attempt.
    (evidence / "compiler-input.json").write_text(json.dumps(payload) + "\n")
    result, attempts, selected = compile_with_fallback(payload, lambda encoded:
        subprocess.run([str(compiler), *sys.argv[1:]], input=encoded,
                       capture_output=True))
    provenance["instrumented_optimizer"] = selected["settings"]["optimizer"]
    provenance["compiler_attempts"] = len(attempts)
    (evidence / "compiler-settings.json").write_text(json.dumps(provenance, indent=2) + "\n")
    (evidence / "compiler-attempts.json").write_text(json.dumps(attempts, indent=2) + "\n")
    if len(attempts) == 2:
        (evidence / "compiler-fallback-input.json").write_text(json.dumps(selected) + "\n")
        print("Coverage-only Yul stack retry: failed attempt retained; unchanged sources "
              "use documented non-inlining optimizer sequence.", file=sys.stderr)
    sys.stdout.buffer.write(result.stdout)
    sys.stderr.buffer.write(result.stderr)
    return result.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Coverage compiler bridge failed: {error}", file=sys.stderr)
        sys.exit(1)
