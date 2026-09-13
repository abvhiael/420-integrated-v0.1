#!/usr/bin/env python3
"""Run the deterministic 420Docs qualification pipeline locally or in CI.

Exit codes:
  0 - every configured qualification stage passed
  1 - a qualification stage ran and failed
  2 - the qualification runner could not execute a configured stage
"""

from __future__ import annotations

import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Sequence

ROOT = Path(__file__).resolve().parents[1]
PASS = 0
QUALIFICATION_FAILURE = 1
RUNNER_ERROR = 2

@dataclass(frozen=True)
class Stage:
    name: str
    command: tuple[str, ...]

STAGES: tuple[Stage, ...] = (
    Stage("front-matter", (sys.executable, "scripts/validate-doc-frontmatter.py")),
    Stage("version-metadata", (sys.executable, "scripts/validate-doc-version-metadata.py")),
    Stage("version-registry", (sys.executable, "scripts/validate-doc-version-registry.py")),
    Stage("version-routing", (sys.executable, "scripts/validate-doc-version-routing.py")),
    Stage("historical-retention", (sys.executable, "scripts/validate-doc-historical-retention.py")),
    Stage("internal-links", (sys.executable, "scripts/validate-doc-links.py")),
    Stage("troubleshooting-ids", (sys.executable, "scripts/validate-troubleshooting-ids.py")),
    Stage("orphan-navigation", (sys.executable, "scripts/validate-doc-orphans.py")),
    Stage("required-doc-coverage", (sys.executable, "scripts/validate-required-docs.py")),
    Stage("generated-reference-integration", (sys.executable, "scripts/validate-generated-reference-integration.py")),
    Stage("publication-safety", (sys.executable, "scripts/validate-doc-publication-safety.py")),
    Stage("workflow-contract", (sys.executable, "scripts/validate-doc-workflow.py")),
    Stage("ci-self-tests", (sys.executable, "scripts/selftest-documentation-ci.py")),
    Stage("generated-reference-freshness", (sys.executable, "scripts/qualify-generated-reference.py", "--check")),
    Stage("strict-mkdocs-build", (sys.executable, "-m", "mkdocs", "build", "--strict")),
    Stage("version-renderer-context", (sys.executable, "scripts/render-doc-version-context.py", "--site-dir", "site")),
    Stage("version-selector-render", (sys.executable, "scripts/inject-doc-version-selector.py", "--site-dir", "site")),
    Stage("search-navigation", (sys.executable, "scripts/qualify-docs.py")),
)

def render_command(command: Sequence[str]) -> str:
    return " ".join(command)

def run_stage(stage: Stage) -> int:
    print(f"420Docs CI: START {stage.name}", flush=True)
    print(f"420Docs CI: RUN   {render_command(stage.command)}", flush=True)
    try:
        completed = subprocess.run(stage.command, cwd=ROOT, check=False)
    except OSError as exc:
        print(f"420Docs CI: ERROR {stage.name}: could not execute stage: {exc}", file=sys.stderr, flush=True)
        return RUNNER_ERROR
    if completed.returncode != 0:
        print(f"420Docs CI: FAIL  {stage.name}: command exited {completed.returncode}", file=sys.stderr, flush=True)
        return QUALIFICATION_FAILURE
    print(f"420Docs CI: PASS  {stage.name}", flush=True)
    return PASS

def main() -> int:
    print(f"420Docs CI: root={ROOT}", flush=True)
    print(f"420Docs CI: stages={len(STAGES)}", flush=True)
    for stage in STAGES:
        result = run_stage(stage)
        if result != PASS:
            return result
    print("420Docs CI: PASS  all documentation qualification stages", flush=True)
    return PASS

if __name__ == "__main__":
    raise SystemExit(main())
