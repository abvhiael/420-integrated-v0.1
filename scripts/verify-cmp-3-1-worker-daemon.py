#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
daemon = ROOT / "compute/worker/daemon.go"
config = ROOT / "compute/worker/config.go"
tests = ROOT / "compute/worker/daemon_test.go"
cmd = ROOT / "execution/cmd/node420-compute/main.go"
doc = ROOT / "docs/compute-market/CMP-3.1-WORKER-DAEMON.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"
makefile = ROOT / "Makefile"

errors = []
for path in [daemon, config, tests, cmd, doc, roadmap, workflow, makefile]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

daemon_text = daemon.read_text()
config_text = config.read_text()
tests_text = tests.read_text()
cmd_text = cmd.read_text()
doc_text = doc.read_text()
roadmap_text = roadmap.read_text()
workflow_text = workflow.read_text()
make_text = makefile.read_text()

for token in [
    "type Service interface",
    "type Daemon struct",
    "StateStarting",
    "StateReady",
    "StateStopping",
    "StateStopped",
    "ShutdownTimeout",
    "ErrServiceExited",
    "ErrAlreadyRunning",
]:
    if token not in daemon_text + config_text:
        errors.append(f"missing daemon foundation token: {token}")

for token in ["ChainID", "ProviderID", "NodeID", "ResourceID", "WorkerID", "validateBytes32"]:
    if token not in config_text:
        errors.append(f"missing fail-closed identity configuration: {token}")

for token in [
    "TestConfigValidationFailsClosed",
    "TestDaemonReadyAndGracefulShutdown",
    "TestUnexpectedServiceExitCancelsSiblings",
    "TestShutdownTimeoutFailsClosed",
    "TestDaemonRejectsEmptyDuplicateAndSecondRun",
]:
    if token not in tests_text:
        errors.append(f"missing CMP-3.1 test: {token}")

for token in [
    "node420-compute: CMP-3.1 daemon foundation only; workload execution is disabled",
    'worker.New(cfg, standbyService{})',
    'signal.NotifyContext',
]:
    if token not in cmd_text:
        errors.append(f"missing command boundary: {token}")

for forbidden in ["exec.Command(", "docker ", "podman ", "wasmtime", "execution-key", "result commitment"]:
    if forbidden in cmd_text.lower() or forbidden in daemon_text.lower():
        errors.append(f"CMP-3.1 improperly implements later-step functionality: {forbidden}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in doc_text
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in doc_text
):
    errors.append("CMP-3.1 documentation status drift")
if "## CMP-3.2 — Hardware/software discovery" not in roadmap_text:
    errors.append("canonical CMP-3 roadmap missing")
if "Verify CMP-3.1 worker daemon" not in workflow_text:
    errors.append("Compute Worker fast workflow does not own CMP-3.1 verifier")
if "go test ./compute/worker" not in workflow_text:
    errors.append("Compute Worker fast workflow does not test worker package")
if "bin/node420-compute" not in make_text:
    errors.append("Makefile does not build node420-compute")

if errors:
    print("CMP-3.1 worker daemon verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.1 worker daemon foundation: mechanically consistent")
