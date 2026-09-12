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
    Stage("internal-links", (sys.executable, "scripts/validate-doc-links.py")),
    Stage("troubleshooting-ids", (sys.executable, "scripts/validate-troubleshooting-ids.py")),
    Stage("orphan-navigation", (sys.executable, "scripts/validate-doc-orphans.py")),
    Stage("required-doc-coverage", (sys.executable, "scripts/validate-required-docs.py")),
    Stage("generated-reference-freshness", (sys.executable, "scripts/qualify-generated-reference.py", "--check")),
    Stage("strict-mkdocs-build", (sys.executable, "-m", "mkdocs", "build", "--strict")),
    Stage("search-navigation", (sys.executable, "scripts/qualify-docs.py")),
)


def render_command(command: Sequence[str]) -> str:
    return " ".join(command)


def run_stage(stage: Stage) -> int:
    print(f"420Docs CI: START {stage.name}")
    print(f"420Docs CI: RUN   {render_command(stage.command)}")
    try:
        completed = subprocess.run(stage.command, cwd=ROOT, check=False)
    except OSError as exc:
        print(f"420Docs CI: ERROR {stage.name}: could not execute stage: {exc}", file=sys.stderr)
        return RUNNER_ERROR
    if completed.returncode != 0:
        print(f"420Docs CI: FAIL  {stage.name}: command exited {completed.returncode}", file=sys.stderr)
        return QUALIFICATION_FAILURE
    print(f"420Docs CI: PASS  {stage.name}")
    return PASS


def main() -> int:
    print(f"420Docs CI: root={ROOT}")
    print(f"420Docs CI: stages={len(STAGES)}")
    for stage in STAGES:
        result = run_stage(stage)
        if result != PASS:
            return result
    print("420Docs CI: PASS  all documentation qualification stages")
    return PASS


if __name__ == "__main__":
    raise SystemExit(main())
