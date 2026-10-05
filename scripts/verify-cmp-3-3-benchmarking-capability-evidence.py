#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
bench = ROOT / "compute/worker/benchmark.go"
tests = ROOT / "compute/worker/benchmark_test.go"
discovery = ROOT / "compute/worker/discovery.go"
cmd = ROOT / "execution/cmd/node420-compute/main.go"
doc = ROOT / "docs/compute-market/CMP-3.3-BENCHMARKING-CAPABILITY-EVIDENCE.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for path in [bench, tests, discovery, cmd, doc, roadmap, workflow]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")

if errors:
    print("\n".join(errors))
    sys.exit(1)

b = bench.read_text()
t = tests.read_text()
c = cmd.read_text()
docs = doc.read_text()
road = roadmap.read_text()
wf = workflow.read_text()

for token in [
    'BenchmarkSchemaV1',
    'CapabilityEvidenceSchemaV1',
    'BenchmarkEvidenceTypeV1',
    '420/COMPUTE/ATTESTATION/BENCHMARK/V1',
    'type BenchmarkMetric struct',
    'type BenchmarkResult struct',
    'type CapabilityEvidence struct',
    'DefaultBenchmarkConfig',
    'RunBenchmark',
    'benchmarkSHA256',
    'benchmarkMemoryCopy',
    'BuildCapabilityEvidence',
    'VerifyCapabilityEvidence',
    'SourceCommitment',
    'BenchmarkCommitment',
    'EvidenceHash',
]:
    if token not in b:
        errors.append(f"missing benchmark/evidence implementation token: {token}")

for token in [
    'Authoritative:             false',
    'IndependentlyAttested:     false',
    'ResultCorrectnessEvidence: false',
    'CommitmentAlgorithmV1',
    'sha256.Sum256',
]:
    if token not in b:
        errors.append(f"missing evidence trust/content-address boundary: {token}")

for forbidden in [
    'exec.Command(',
    'net.Dial(',
    'http.Get(',
    'http.Post(',
    'os.Getenv(',
    'os.Environ(',
    'nvidia-smi',
    'docker run',
    'podman run',
    'wasmtime ',
    'private key',
]:
    if forbidden.lower() in b.lower():
        errors.append(f"CMP-3.3 crosses benchmark/security boundary: {forbidden}")

for token in [
    'TestBenchmarkConfigFailsClosed',
    'TestMetricFromDurationRejectsZeroTime',
    'TestSmallBenchmarkProducesBoundedMetrics',
    'TestCapabilityEvidenceIsContentAddressedAndNonAuthoritative',
    'TestCapabilityEvidenceDetectsTamperingAndCrossHostReuse',
    'TestCapabilityEvidenceRejectsAuthorityEscalation',
    'TestCapabilityEvidenceJSONContainsNoAttestationOrCorrectnessClaim',
    'TestCapabilityClaimsAreDeterministic',
]:
    if token not in t:
        errors.append(f"missing CMP-3.3 test: {token}")

for token in [
    'flag.Bool("benchmark"',
    'worker.RunBenchmark(worker.DefaultBenchmarkConfig())',
    'worker.BuildCapabilityEvidence(discovery, result)',
    '--discover and --benchmark are mutually exclusive',
]:
    if token not in c:
        errors.append(f"missing node420-compute benchmark CLI boundary: {token}")

for token in [
    "go test ./compute/worker",
    "go test ./execution/cmd/node420-compute",
    "go vet ./compute/worker ./execution/cmd/node420-compute",
    "go build ./execution/cmd/node420-compute",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py",
]:
    if token not in wf:
        errors.append(f"Compute Worker fast workflow missing CMP-3 coverage: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in docs
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in docs
):
    errors.append("CMP-3.3 documentation status drift")
if "Next canonical step: **CMP-3.4 — Secure workload sandbox**." not in docs:
    errors.append("CMP-3.3 next canonical step drift")
if "## CMP-3.3 — Benchmarking and capability evidence" not in road:
    errors.append("canonical CMP-3.3 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in road
    and "COMPLETE — Level 1 exact-head qualified" not in road
):
    errors.append("CMP-3.3 roadmap status missing or stale")

if errors:
    print("CMP-3.3 benchmarking and capability evidence verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.3 benchmarking and capability evidence: mechanically consistent")
