package worker

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strconv"
	"strings"
	"time"
)

const DiscoverySchemaV1 = "420-compute-worker-discovery-v1"

type OSDiscovery struct {
	Name         string `json:"name"`
	Architecture string `json:"architecture"`
	Kernel       string `json:"kernel,omitempty"`
}

type CPUDiscovery struct {
	LogicalCPUs int    `json:"logicalCpus"`
	Model       string `json:"model,omitempty"`
}

type MemoryDiscovery struct {
	TotalBytes uint64 `json:"totalBytes,omitempty"`
	Known      bool   `json:"known"`
}

type AcceleratorDiscovery struct {
	Kind     string `json:"kind"`
	Index    int    `json:"index"`
	VendorID string `json:"vendorId,omitempty"`
	DeviceID string `json:"deviceId,omitempty"`
}

type SoftwareDiscovery struct {
	GoRuntime     string   `json:"goRuntime"`
	Executable    string   `json:"executable,omitempty"`
	DetectedTools []string `json:"detectedTools,omitempty"`
}

type HostDiscovery struct {
	SchemaVersion     string                 `json:"schemaVersion"`
	CapturedAt        time.Time              `json:"capturedAt"`
	Authoritative     bool                   `json:"authoritative"`
	BenchmarkEvidence bool                   `json:"benchmarkEvidence"`
	OS                OSDiscovery            `json:"os"`
	CPU               CPUDiscovery           `json:"cpu"`
	Memory            MemoryDiscovery        `json:"memory"`
	Accelerators      []AcceleratorDiscovery `json:"accelerators,omitempty"`
	Software          SoftwareDiscovery      `json:"software"`
	Warnings          []string               `json:"warnings,omitempty"`
}

// DiscoverHost returns a local, descriptive inventory only. It never proves
// eligibility, performance, benchmark evidence, attestation, or authorization.
func DiscoverHost() HostDiscovery {
	return discoverHost(time.Now, exec.LookPath, string(os.PathSeparator))
}

func discoverHost(now func() time.Time, lookup func(string) (string, error), root string) HostDiscovery {
	snapshot := HostDiscovery{
		SchemaVersion:     DiscoverySchemaV1,
		CapturedAt:        now().UTC(),
		Authoritative:     false,
		BenchmarkEvidence: false,
		OS: OSDiscovery{
			Name:         runtime.GOOS,
			Architecture: runtime.GOARCH,
		},
		CPU: CPUDiscovery{LogicalCPUs: runtime.NumCPU()},
		Memory: MemoryDiscovery{},
		Software: SoftwareDiscovery{
			GoRuntime: runtime.Version(),
		},
	}

	if executable, err := os.Executable(); err == nil {
		snapshot.Software.Executable = filepath.Base(executable)
	}
	snapshot.Software.DetectedTools = discoverTools(lookup)

	if runtime.GOOS != "linux" {
		snapshot.Warnings = append(snapshot.Warnings,
			"platform-specific memory, CPU-model and accelerator probes are unavailable; portable runtime inventory only")
		return snapshot
	}

	procRoot := filepath.Join(root, "proc")
	sysRoot := filepath.Join(root, "sys")
	if root == string(os.PathSeparator) {
		procRoot = "/proc"
		sysRoot = "/sys"
	}

	if model, err := readCPUModel(filepath.Join(procRoot, "cpuinfo")); err == nil {
		snapshot.CPU.Model = model
	} else {
		snapshot.Warnings = append(snapshot.Warnings, "cpu model unavailable: "+err.Error())
	}

	if total, err := readMemoryTotal(filepath.Join(procRoot, "meminfo")); err == nil {
		snapshot.Memory = MemoryDiscovery{TotalBytes: total, Known: true}
	} else {
		snapshot.Warnings = append(snapshot.Warnings, "memory total unavailable: "+err.Error())
	}

	accelerators, err := discoverLinuxAccelerators(filepath.Join(sysRoot, "class", "drm"))
	if err != nil {
		snapshot.Warnings = append(snapshot.Warnings, "accelerator inventory unavailable: "+err.Error())
	} else {
		snapshot.Accelerators = accelerators
	}
	sort.Strings(snapshot.Warnings)
	return snapshot
}

func discoverTools(lookup func(string) (string, error)) []string {
	candidates := []string{"docker", "podman", "runc", "wasmtime", "nvidia-smi"}
	found := make([]string, 0, len(candidates))
	for _, name := range candidates {
		if _, err := lookup(name); err == nil {
			found = append(found, name)
		}
	}
	sort.Strings(found)
	return found
}

func readCPUModel(path string) (string, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		key, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		key = strings.TrimSpace(strings.ToLower(key))
		if key == "model name" || key == "hardware" || key == "processor" {
			value = strings.TrimSpace(value)
			if value != "" && !allDigits(value) {
				return value, nil
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return "", err
	}
	return "", fmt.Errorf("no CPU model field")
}

func readMemoryTotal(path string) (uint64, error) {
	file, err := os.Open(path)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		fields := strings.Fields(scanner.Text())
		if len(fields) < 2 || fields[0] != "MemTotal:" {
			continue
		}
		kib, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil {
			return 0, fmt.Errorf("invalid MemTotal: %w", err)
		}
		if kib > math.MaxUint64/1024 {
			return 0, fmt.Errorf("MemTotal overflow")
		}
		return kib * 1024, nil
	}
	if err := scanner.Err(); err != nil {
		return 0, err
	}
	return 0, fmt.Errorf("MemTotal missing")
}

func discoverLinuxAccelerators(drmRoot string) ([]AcceleratorDiscovery, error) {
	entries, err := os.ReadDir(drmRoot)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	accelerators := make([]AcceleratorDiscovery, 0)
	for _, entry := range entries {
		index, ok := drmCardIndex(entry.Name())
		if !ok {
			continue
		}
		deviceRoot := filepath.Join(drmRoot, entry.Name(), "device")
		vendor, vendorErr := readTrimmed(filepath.Join(deviceRoot, "vendor"))
		device, deviceErr := readTrimmed(filepath.Join(deviceRoot, "device"))
		if vendorErr != nil && deviceErr != nil {
			continue
		}
		accelerators = append(accelerators, AcceleratorDiscovery{
			Kind:     "graphics",
			Index:    index,
			VendorID: normalizePCIIdentifier(vendor),
			DeviceID: normalizePCIIdentifier(device),
		})
	}
	sort.Slice(accelerators, func(i, j int) bool { return accelerators[i].Index < accelerators[j].Index })
	return accelerators, nil
}

func drmCardIndex(name string) (int, bool) {
	if !strings.HasPrefix(name, "card") {
		return 0, false
	}
	suffix := strings.TrimPrefix(name, "card")
	if suffix == "" || !allDigits(suffix) {
		return 0, false
	}
	index, err := strconv.Atoi(suffix)
	return index, err == nil
}

func allDigits(value string) bool {
	if value == "" {
		return false
	}
	for _, r := range value {
		if r < '0' || r > '9' {
			return false
		}
	}
	return true
}

func readTrimmed(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(data)), nil
}

func normalizePCIIdentifier(value string) string {
	value = strings.TrimSpace(strings.ToLower(value))
	if strings.HasPrefix(value, "0x") {
		return value
	}
	if value == "" {
		return ""
	}
	return "0x" + value
}
