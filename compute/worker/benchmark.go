package worker

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"runtime"
	"sort"
	"time"
)

const (
	BenchmarkSchemaV1         = "420-compute-worker-benchmark-v1"
	CapabilityEvidenceSchemaV1 = "420-compute-worker-capability-evidence-v1"
	BenchmarkEvidenceTypeV1   = "420/COMPUTE/ATTESTATION/BENCHMARK/V1"
	CommitmentAlgorithmV1     = "sha256"
)

var ErrInvalidBenchmark = errors.New("invalid compute worker benchmark")

type BenchmarkConfig struct {
	CPUBufferBytes    int
	CPUIterations     int
	MemoryBufferBytes int
	MemoryIterations  int
}

type BenchmarkMetric struct {
	Name           string `json:"name"`
	Unit           string `json:"unit"`
	WorkUnits      uint64 `json:"workUnits"`
	DurationNanos  int64  `json:"durationNanos"`
	UnitsPerSecond uint64 `json:"unitsPerSecond"`
}

type BenchmarkResult struct {
	SchemaVersion string            `json:"schemaVersion"`
	CapturedAt    time.Time         `json:"capturedAt"`
	Metrics       []BenchmarkMetric `json:"metrics"`
}

type CapabilityClaim struct {
	Name  string `json:"name"`
	Value string `json:"value"`
}

type CapabilityEvidence struct {
	SchemaVersion             string            `json:"schemaVersion"`
	EvidenceType              string            `json:"evidenceType"`
	HashAlgorithm             string            `json:"hashAlgorithm"`
	GeneratedAt               time.Time         `json:"generatedAt"`
	SourceCommitment          string            `json:"sourceCommitment"`
	BenchmarkCommitment       string            `json:"benchmarkCommitment"`
	EvidenceHash              string            `json:"evidenceHash"`
	Authoritative             bool              `json:"authoritative"`
	IndependentlyAttested     bool              `json:"independentlyAttested"`
	ResultCorrectnessEvidence bool              `json:"resultCorrectnessEvidence"`
	Claims                    []CapabilityClaim `json:"claims"`
	Benchmark                 BenchmarkResult   `json:"benchmark"`
}

type evidencePreimage struct {
	SchemaVersion             string            `json:"schemaVersion"`
	EvidenceType              string            `json:"evidenceType"`
	HashAlgorithm             string            `json:"hashAlgorithm"`
	GeneratedAt               time.Time         `json:"generatedAt"`
	SourceCommitment          string            `json:"sourceCommitment"`
	BenchmarkCommitment       string            `json:"benchmarkCommitment"`
	Authoritative             bool              `json:"authoritative"`
	IndependentlyAttested     bool              `json:"independentlyAttested"`
	ResultCorrectnessEvidence bool              `json:"resultCorrectnessEvidence"`
	Claims                    []CapabilityClaim `json:"claims"`
	Benchmark                 BenchmarkResult   `json:"benchmark"`
}

func DefaultBenchmarkConfig() BenchmarkConfig {
	return BenchmarkConfig{
		CPUBufferBytes:    4 << 20,
		CPUIterations:     16,
		MemoryBufferBytes: 8 << 20,
		MemoryIterations:  16,
	}
}

func (c BenchmarkConfig) Validate() error {
	if c.CPUBufferBytes < 1024 || c.CPUIterations <= 0 {
		return fmt.Errorf("%w: CPU workload must be positive and bounded", ErrInvalidBenchmark)
	}
	if c.MemoryBufferBytes < 1024 || c.MemoryIterations <= 0 {
		return fmt.Errorf("%w: memory workload must be positive and bounded", ErrInvalidBenchmark)
	}
	const maxBuffer = 256 << 20
	const maxIterations = 4096
	if c.CPUBufferBytes > maxBuffer || c.MemoryBufferBytes > maxBuffer {
		return fmt.Errorf("%w: benchmark buffer exceeds %d bytes", ErrInvalidBenchmark, maxBuffer)
	}
	if c.CPUIterations > maxIterations || c.MemoryIterations > maxIterations {
		return fmt.Errorf("%w: benchmark iteration limit exceeded", ErrInvalidBenchmark)
	}
	return nil
}

func RunBenchmark(config BenchmarkConfig) (BenchmarkResult, error) {
	if err := config.Validate(); err != nil {
		return BenchmarkResult{}, err
	}
	return runBenchmark(config, time.Now, time.Since)
}

func runBenchmark(
	config BenchmarkConfig,
	now func() time.Time,
	since func(time.Time) time.Duration,
) (BenchmarkResult, error) {
	if err := config.Validate(); err != nil {
		return BenchmarkResult{}, err
	}
	cpuMetric, err := benchmarkSHA256(config.CPUBufferBytes, config.CPUIterations, now, since)
	if err != nil {
		return BenchmarkResult{}, err
	}
	memoryMetric, err := benchmarkMemoryCopy(config.MemoryBufferBytes, config.MemoryIterations, now, since)
	if err != nil {
		return BenchmarkResult{}, err
	}
	return BenchmarkResult{
		SchemaVersion: BenchmarkSchemaV1,
		CapturedAt:    now().UTC(),
		Metrics:       []BenchmarkMetric{cpuMetric, memoryMetric},
	}, nil
}

func benchmarkSHA256(
	bufferBytes, iterations int,
	now func() time.Time,
	since func(time.Time) time.Duration,
) (BenchmarkMetric, error) {
	buffer := deterministicBuffer(bufferBytes)
	started := now()
	var sink [32]byte
	for i := 0; i < iterations; i++ {
		sink = sha256.Sum256(buffer)
		buffer[i%len(buffer)] ^= sink[i%len(sink)]
	}
	runtime.KeepAlive(sink)
	return metricFromDuration("cpu_sha256_bytes", "bytes", bufferBytes, iterations, since(started))
}

func benchmarkMemoryCopy(
	bufferBytes, iterations int,
	now func() time.Time,
	since func(time.Time) time.Duration,
) (BenchmarkMetric, error) {
	source := deterministicBuffer(bufferBytes)
	target := make([]byte, bufferBytes)
	started := now()
	for i := 0; i < iterations; i++ {
		copy(target, source)
		source, target = target, source
	}
	runtime.KeepAlive(source)
	runtime.KeepAlive(target)
	return metricFromDuration("memory_copy_bytes", "bytes", bufferBytes, iterations, since(started))
}

func metricFromDuration(name, unit string, perIteration, iterations int, elapsed time.Duration) (BenchmarkMetric, error) {
	if elapsed <= 0 {
		return BenchmarkMetric{}, fmt.Errorf("%w: %s duration must be positive", ErrInvalidBenchmark, name)
	}
	if perIteration <= 0 || iterations <= 0 {
		return BenchmarkMetric{}, fmt.Errorf("%w: %s work must be positive", ErrInvalidBenchmark, name)
	}
	work := uint64(perIteration) * uint64(iterations)
	if uint64(perIteration) != 0 && work/uint64(perIteration) != uint64(iterations) {
		return BenchmarkMetric{}, fmt.Errorf("%w: %s work overflow", ErrInvalidBenchmark, name)
	}
	seconds := elapsed.Seconds()
	if seconds <= 0 {
		return BenchmarkMetric{}, fmt.Errorf("%w: %s elapsed seconds invalid", ErrInvalidBenchmark, name)
	}
	rate := float64(work) / seconds
	if rate <= 0 || rate > math.MaxUint64 {
		return BenchmarkMetric{}, fmt.Errorf("%w: %s rate invalid", ErrInvalidBenchmark, name)
	}
	return BenchmarkMetric{
		Name:           name,
		Unit:           unit,
		WorkUnits:      work,
		DurationNanos:  elapsed.Nanoseconds(),
		UnitsPerSecond: uint64(rate),
	}, nil
}

func deterministicBuffer(size int) []byte {
	buffer := make([]byte, size)
	for i := range buffer {
		buffer[i] = byte((i*31 + 17) & 0xff)
	}
	return buffer
}

func BuildCapabilityEvidence(discovery HostDiscovery, benchmark BenchmarkResult) (CapabilityEvidence, error) {
	if benchmark.SchemaVersion != BenchmarkSchemaV1 || len(benchmark.Metrics) == 0 {
		return CapabilityEvidence{}, fmt.Errorf("%w: benchmark schema or metrics invalid", ErrInvalidBenchmark)
	}
	for _, metric := range benchmark.Metrics {
		if metric.Name == "" || metric.Unit == "" || metric.WorkUnits == 0 || metric.DurationNanos <= 0 || metric.UnitsPerSecond == 0 {
			return CapabilityEvidence{}, fmt.Errorf("%w: invalid metric %q", ErrInvalidBenchmark, metric.Name)
		}
	}
	sourceCommitment, err := commitment(discovery)
	if err != nil {
		return CapabilityEvidence{}, fmt.Errorf("commit discovery: %w", err)
	}
	benchmarkCommitment, err := commitment(benchmark)
	if err != nil {
		return CapabilityEvidence{}, fmt.Errorf("commit benchmark: %w", err)
	}

	claims := capabilityClaims(discovery, benchmark)
	preimage := evidencePreimage{
		SchemaVersion:             CapabilityEvidenceSchemaV1,
		EvidenceType:              BenchmarkEvidenceTypeV1,
		HashAlgorithm:             CommitmentAlgorithmV1,
		GeneratedAt:               benchmark.CapturedAt,
		SourceCommitment:          sourceCommitment,
		BenchmarkCommitment:       benchmarkCommitment,
		Authoritative:             false,
		IndependentlyAttested:     false,
		ResultCorrectnessEvidence: false,
		Claims:                    claims,
		Benchmark:                 benchmark,
	}
	evidenceHash, err := commitment(preimage)
	if err != nil {
		return CapabilityEvidence{}, fmt.Errorf("commit capability evidence: %w", err)
	}
	return CapabilityEvidence{
		SchemaVersion:             preimage.SchemaVersion,
		EvidenceType:              preimage.EvidenceType,
		HashAlgorithm:             preimage.HashAlgorithm,
		GeneratedAt:               preimage.GeneratedAt,
		SourceCommitment:          preimage.SourceCommitment,
		BenchmarkCommitment:       preimage.BenchmarkCommitment,
		EvidenceHash:              evidenceHash,
		Authoritative:             preimage.Authoritative,
		IndependentlyAttested:     preimage.IndependentlyAttested,
		ResultCorrectnessEvidence: preimage.ResultCorrectnessEvidence,
		Claims:                    preimage.Claims,
		Benchmark:                 preimage.Benchmark,
	}, nil
}

func VerifyCapabilityEvidence(discovery HostDiscovery, evidence CapabilityEvidence) error {
	if evidence.SchemaVersion != CapabilityEvidenceSchemaV1 ||
		evidence.EvidenceType != BenchmarkEvidenceTypeV1 ||
		evidence.HashAlgorithm != CommitmentAlgorithmV1 ||
		evidence.Authoritative ||
		evidence.IndependentlyAttested ||
		evidence.ResultCorrectnessEvidence {
		return fmt.Errorf("%w: evidence authority/schema boundary violated", ErrInvalidBenchmark)
	}
	expected, err := BuildCapabilityEvidence(discovery, evidence.Benchmark)
	if err != nil {
		return err
	}
	if expected.SourceCommitment != evidence.SourceCommitment ||
		expected.BenchmarkCommitment != evidence.BenchmarkCommitment ||
		expected.EvidenceHash != evidence.EvidenceHash {
		return fmt.Errorf("%w: capability evidence commitment mismatch", ErrInvalidBenchmark)
	}
	return nil
}

func capabilityClaims(discovery HostDiscovery, benchmark BenchmarkResult) []CapabilityClaim {
	claims := []CapabilityClaim{
		{Name: "architecture", Value: discovery.OS.Architecture},
		{Name: "logical_cpus", Value: fmt.Sprintf("%d", discovery.CPU.LogicalCPUs)},
	}
	if discovery.Memory.Known {
		claims = append(claims, CapabilityClaim{Name: "memory_bytes", Value: fmt.Sprintf("%d", discovery.Memory.TotalBytes)})
	}
	if len(discovery.Accelerators) > 0 {
		claims = append(claims, CapabilityClaim{Name: "graphics_accelerators", Value: fmt.Sprintf("%d", len(discovery.Accelerators))})
	}
	if len(discovery.Software.DetectedTools) > 0 {
		tools := append([]string(nil), discovery.Software.DetectedTools...)
		sort.Strings(tools)
		claims = append(claims, CapabilityClaim{Name: "detected_tools", Value: fmt.Sprintf("%v", tools)})
	}
	for _, metric := range benchmark.Metrics {
		claims = append(claims, CapabilityClaim{
			Name:  "benchmark_" + metric.Name + "_per_second",
			Value: fmt.Sprintf("%d", metric.UnitsPerSecond),
		})
	}
	sort.Slice(claims, func(i, j int) bool {
		if claims[i].Name == claims[j].Name {
			return claims[i].Value < claims[j].Value
		}
		return claims[i].Name < claims[j].Name
	})
	return claims
}

func commitment(value any) (string, error) {
	payload, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(payload)
	return "0x" + hex.EncodeToString(sum[:]), nil
}
