#!/usr/bin/env python3
"""Coverage-only Solc bridge; canonical builds continue to use Solc directly.

Foundry's --ir-minimum disables the optimizer passes required by this repository's
existing ABI decoders/encoders. Restore the canonical optimizer for instrumentation
without changing sources, output selection, EVM target or test inventory. Optimized
IR coverage has approximate source mappings; it is not a coverage-percentage gate.
"""
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
            or settings.get("viaIR") is not True
            or settings.get("evmVersion") != "cancun"
            or optimizer.get("enabled") is not True
            or optimizer.get("runs") != 200
            or optimizer.get("details", {}).get("yulDetails", {}).get("optimizerSteps") != "u"):
        raise ValueError("Refusing non-coverage or unexpected compiler settings")
    settings["optimizer"] = dict(CANONICAL_OPTIMIZER)
    return optimizer


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
        "original_optimizer": original,
        "instrumented_optimizer": CANONICAL_OPTIMIZER,
        "viaIR": payload["settings"]["viaIR"],
        "evmVersion": payload["settings"]["evmVersion"],
        "source_count": len(payload["sources"]),
        "sources_sha256": hashlib.sha256(json.dumps(payload["sources"],
            sort_keys=True, separators=(",", ":")).encode()).hexdigest(),
        "source_mapping": "approximate optimized IR; no precise percentage acceptance claimed",
    }
    (evidence / "compiler-settings.json").write_text(json.dumps(provenance, indent=2) + "\n")
    print("Coverage-only bridge: pinned Solc, canonical optimizer, unchanged sources; "
          "optimized IR source mappings are approximate.", file=sys.stderr)
    result = subprocess.run([str(compiler), *sys.argv[1:]],
                            input=json.dumps(payload).encode())
    return result.returncode


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, ValueError, KeyError, subprocess.CalledProcessError) as error:
        print(f"Coverage compiler bridge failed: {error}", file=sys.stderr)
        sys.exit(1)
