#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
discovery = ROOT / "compute/worker/discovery.go"
tests = ROOT / "compute/worker/discovery_test.go"
cmd = ROOT / "execution/cmd/node420-compute/main.go"
doc = ROOT / "docs/compute-market/CMP-3.2-HARDWARE-SOFTWARE-DISCOVERY.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for path in [discovery, tests, cmd, doc, roadmap, workflow]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

d = discovery.read_text()
t = tests.read_text()
c = cmd.read_text()
docs = doc.read_text()
road = roadmap.read_text()
wf = workflow.read_text()

for token in [
    'DiscoverySchemaV1 = "420-compute-worker-discovery-v1"',
    "type HostDiscovery struct",
    "Authoritative",
    "BenchmarkEvidence",
    "runtime.GOOS",
    "runtime.GOARCH",
    "runtime.NumCPU()",
    "readCPUModel",
    "readMemoryTotal",
    "discoverLinuxAccelerators",
    "discoverTools",
]:
    if token not in d:
        errors.append(f"missing discovery implementation token: {token}")

for token in [
    "Authoritative:     false",
    "BenchmarkEvidence: false",
    'candidates := []string{"docker", "podman", "runc", "wasmtime", "nvidia-smi"}',
    "filepath.Base(executable)",
]:
    if token not in d:
        errors.append(f"missing non-authoritative/privacy boundary: {token}")

for forbidden in [
    "os.Environ(",
    "os.Getenv(",
    "net.Interfaces(",
    "exec.Command(",
    "serial number",
    "mac address",
    "private key",
]:
    if forbidden.lower() in d.lower():
        errors.append(f"discovery crosses CMP-3.2 privacy/execution boundary: {forbidden}")

for token in [
    "TestDiscoverHostPortableBaselineIsNonAuthoritative",
    "TestReadCPUModel",
    "TestReadCPUModelRejectsNumericProcessorIndex",
    "TestReadMemoryTotal",
    "TestReadMemoryTotalFailsOnMalformedValue",
    "TestDiscoverLinuxAcceleratorsIsDeterministicAndCoarse",
    "TestDiscoveryDoesNotExposeSensitiveHostIdentifiers",
]:
    if token not in t:
        errors.append(f"missing CMP-3.2 test: {token}")

for token in [
    'flag.Bool("discover"',
    "worker.DiscoverHost()",
    "json.NewEncoder(os.Stdout)",
]:
    if token not in c:
        errors.append(f"missing node420-compute discovery CLI boundary: {token}")

for token in [
    "Compute Worker Fast Qualification",
    "go test ./compute/worker",
    "go test ./execution/cmd/node420-compute",
    "go vet ./compute/worker ./execution/cmd/node420-compute",
    "go build ./execution/cmd/node420-compute",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
]:
    if token not in wf:
        errors.append(f"fast workflow missing CMP-3 coverage: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in docs
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in docs
):
    errors.append("CMP-3.2 documentation status drift")
if "Next canonical step: **CMP-3.3 — Benchmarking and capability evidence**." not in docs:
    errors.append("CMP-3.2 next-step boundary drift")
if "## CMP-3.2 — Hardware/software discovery" not in road:
    errors.append("canonical CMP-3.2 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in road
    and "COMPLETE — Level 1 exact-head qualified" not in road
):
    errors.append("CMP-3.2 roadmap status missing or stale")

if errors:
    print("CMP-3.2 hardware/software discovery verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.2 hardware/software discovery: mechanically consistent")
