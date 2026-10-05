package worker

import (
	"encoding/json"
	"strings"
	"testing"
	"time"
)

func benchmarkFixture() BenchmarkResult {
	return BenchmarkResult{
		SchemaVersion: BenchmarkSchemaV1,
		CapturedAt:    time.Date(2026, 10, 5, 1, 0, 0, 0, time.UTC),
		Metrics: []BenchmarkMetric{
			{Name: "cpu_sha256_bytes", Unit: "bytes", WorkUnits: 4096, DurationNanos: 1_000_000, UnitsPerSecond: 4_096_000},
			{Name: "memory_copy_bytes", Unit: "bytes", WorkUnits: 8192, DurationNanos: 2_000_000, UnitsPerSecond: 4_096_000},
		},
	}
}

func discoveryFixture() HostDiscovery {
	return HostDiscovery{
		SchemaVersion:     DiscoverySchemaV1,
		CapturedAt:        time.Date(2026, 10, 5, 0, 59, 0, 0, time.UTC),
		Authoritative:     false,
		BenchmarkEvidence: false,
		OS:                OSDiscovery{Name: "linux", Architecture: "amd64"},
		CPU:               CPUDiscovery{LogicalCPUs: 8, Model: "Example CPU"},
		Memory:            MemoryDiscovery{TotalBytes: 16 << 30, Known: true},
		Accelerators:      []AcceleratorDiscovery{{Kind: "graphics", Index: 0, VendorID: "0x10de", DeviceID: "0x2684"}},
		Software:          SoftwareDiscovery{GoRuntime: "go1.23", Executable: "node420-compute", DetectedTools: []string{"docker", "nvidia-smi"}},
	}
}

func TestBenchmarkConfigFailsClosed(t *testing.T) {
	cfg := DefaultBenchmarkConfig()
	cfg.CPUIterations = 0
	if err := cfg.Validate(); err == nil {
		t.Fatal("zero CPU iterations must fail")
	}
	cfg = DefaultBenchmarkConfig()
	cfg.MemoryBufferBytes = 1
	if err := cfg.Validate(); err == nil {
		t.Fatal("tiny memory workload must fail")
	}
	cfg = DefaultBenchmarkConfig()
	cfg.CPUBufferBytes = 257 << 20
	if err := cfg.Validate(); err == nil {
		t.Fatal("oversized benchmark buffer must fail")
	}
}

func TestMetricFromDurationRejectsZeroTime(t *testing.T) {
	if _, err := metricFromDuration("cpu_sha256_bytes", "bytes", 1024, 1, 0); err == nil {
		t.Fatal("zero-duration benchmark must fail")
	}
}

func TestSmallBenchmarkProducesBoundedMetrics(t *testing.T) {
	result, err := RunBenchmark(BenchmarkConfig{
		CPUBufferBytes:    4 << 10,
		CPUIterations:     2,
		MemoryBufferBytes: 4 << 10,
		MemoryIterations:  2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if result.SchemaVersion != BenchmarkSchemaV1 || len(result.Metrics) != 2 {
		t.Fatalf("unexpected benchmark result: %+v", result)
	}
	for _, metric := range result.Metrics {
		if metric.DurationNanos <= 0 || metric.UnitsPerSecond == 0 {
			t.Fatalf("invalid metric: %+v", metric)
		}
	}
}

func TestCapabilityEvidenceIsContentAddressedAndNonAuthoritative(t *testing.T) {
	discovery := discoveryFixture()
	evidence, err := BuildCapabilityEvidence(discovery, benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}
	if evidence.SchemaVersion != CapabilityEvidenceSchemaV1 {
		t.Fatalf("schema=%q", evidence.SchemaVersion)
	}
	if evidence.EvidenceType != BenchmarkEvidenceTypeV1 {
		t.Fatalf("evidenceType=%q", evidence.EvidenceType)
	}
	if evidence.Authoritative || evidence.IndependentlyAttested || evidence.ResultCorrectnessEvidence {
		t.Fatal("local benchmark evidence must remain self-reported and non-authoritative")
	}
	for _, value := range []string{evidence.SourceCommitment, evidence.BenchmarkCommitment, evidence.EvidenceHash} {
		if len(value) != 66 || !strings.HasPrefix(value, "0x") {
			t.Fatalf("invalid bytes32-compatible commitment %q", value)
		}
	}
	if err := VerifyCapabilityEvidence(discovery, evidence); err != nil {
		t.Fatal(err)
	}
}

func TestCapabilityEvidenceDetectsTamperingAndCrossHostReuse(t *testing.T) {
	discovery := discoveryFixture()
	evidence, err := BuildCapabilityEvidence(discovery, benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}

	tampered := evidence
	tampered.Benchmark.Metrics[0].UnitsPerSecond++
	if err := VerifyCapabilityEvidence(discovery, tampered); err == nil {
		t.Fatal("tampered benchmark must fail commitment verification")
	}

	otherHost := discovery
	otherHost.CPU.LogicalCPUs++
	if err := VerifyCapabilityEvidence(otherHost, evidence); err == nil {
		t.Fatal("cross-host discovery substitution must fail")
	}
}

func TestCapabilityEvidenceRejectsAuthorityEscalation(t *testing.T) {
	discovery := discoveryFixture()
	evidence, err := BuildCapabilityEvidence(discovery, benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}
	evidence.Authoritative = true
	if err := VerifyCapabilityEvidence(discovery, evidence); err == nil {
		t.Fatal("self-reported evidence cannot become authoritative")
	}
}

func TestCapabilityEvidenceJSONContainsNoAttestationOrCorrectnessClaim(t *testing.T) {
	evidence, err := BuildCapabilityEvidence(discoveryFixture(), benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}
	payload, err := json.Marshal(evidence)
	if err != nil {
		t.Fatal(err)
	}
	text := strings.ToLower(string(payload))
	for _, forbidden := range []string{"privatekey", "wallet", "validator", "jobcorrect", "verifiedresult"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("evidence leaks forbidden authority/secret token %q", forbidden)
		}
	}
}

func TestCapabilityClaimsAreDeterministic(t *testing.T) {
	a, err := BuildCapabilityEvidence(discoveryFixture(), benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}
	b, err := BuildCapabilityEvidence(discoveryFixture(), benchmarkFixture())
	if err != nil {
		t.Fatal(err)
	}
	if a.EvidenceHash != b.EvidenceHash || a.SourceCommitment != b.SourceCommitment || a.BenchmarkCommitment != b.BenchmarkCommitment {
		t.Fatal("identical evidence inputs must produce identical commitments")
	}
	if len(a.Claims) == 0 {
		t.Fatal("capability claims missing")
	}
	for i := 1; i < len(a.Claims); i++ {
		if a.Claims[i-1].Name > a.Claims[i].Name {
			t.Fatalf("claims are not deterministic: %+v", a.Claims)
		}
	}
}
