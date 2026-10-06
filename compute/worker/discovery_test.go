package worker

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestDiscoverHostPortableBaselineIsNonAuthoritative(t *testing.T) {
	now := time.Date(2026, 10, 4, 22, 0, 0, 0, time.UTC)
	snapshot := discoverHost(
		func() time.Time { return now },
		func(name string) (string, error) {
			if name == "docker" || name == "nvidia-smi" {
				return "/ignored/" + name, nil
			}
			return "", errors.New("not found")
		},
		t.TempDir(),
	)

	if snapshot.SchemaVersion != DiscoverySchemaV1 {
		t.Fatalf("schema=%q", snapshot.SchemaVersion)
	}
	if snapshot.CapturedAt != now {
		t.Fatalf("capturedAt=%s", snapshot.CapturedAt)
	}
	if snapshot.Authoritative || snapshot.BenchmarkEvidence {
		t.Fatal("local discovery must never claim authority or benchmark evidence")
	}
	if snapshot.OS.Name != runtime.GOOS || snapshot.OS.Architecture != runtime.GOARCH {
		t.Fatalf("unexpected runtime identity: %+v", snapshot.OS)
	}
	if snapshot.CPU.LogicalCPUs < 1 {
		t.Fatalf("logical CPU count=%d", snapshot.CPU.LogicalCPUs)
	}
	if !slices.Equal(snapshot.Software.DetectedTools, []string{"docker", "nvidia-smi"}) {
		t.Fatalf("tools=%v", snapshot.Software.DetectedTools)
	}
	for _, tool := range snapshot.Software.DetectedTools {
		if strings.Contains(tool, "/") || strings.Contains(tool, "\\") {
			t.Fatalf("tool discovery leaked local path: %q", tool)
		}
	}
}

func TestReadCPUModel(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cpuinfo")
	content := "processor : 0\nmodel name : Example CPU 4200\nflags : ignored\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	model, err := readCPUModel(path)
	if err != nil {
		t.Fatal(err)
	}
	if model != "Example CPU 4200" {
		t.Fatalf("model=%q", model)
	}
}

func TestReadCPUModelRejectsNumericProcessorIndex(t *testing.T) {
	path := filepath.Join(t.TempDir(), "cpuinfo")
	if err := os.WriteFile(path, []byte("processor : 0\nprocessor : 1\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := readCPUModel(path); err == nil {
		t.Fatal("numeric processor indices must not be mistaken for a CPU model")
	}
}

func TestReadMemoryTotal(t *testing.T) {
	path := filepath.Join(t.TempDir(), "meminfo")
	if err := os.WriteFile(path, []byte("MemTotal:       16384 kB\nMemFree: 42 kB\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	total, err := readMemoryTotal(path)
	if err != nil {
		t.Fatal(err)
	}
	if total != 16384*1024 {
		t.Fatalf("total=%d", total)
	}
}

func TestReadMemoryTotalFailsOnMalformedValue(t *testing.T) {
	path := filepath.Join(t.TempDir(), "meminfo")
	if err := os.WriteFile(path, []byte("MemTotal: nope kB\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := readMemoryTotal(path); err == nil {
		t.Fatal("malformed MemTotal must fail visibly")
	}
}

func TestDiscoverLinuxAcceleratorsIsDeterministicAndCoarse(t *testing.T) {
	root := filepath.Join(t.TempDir(), "drm")
	for _, card := range []struct {
		name, vendor, device string
	}{
		{"card10", "0x10de\n", "2684\n"},
		{"card2", "1002\n", "0x744c\n"},
	} {
		deviceDir := filepath.Join(root, card.name, "device")
		if err := os.MkdirAll(deviceDir, 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(deviceDir, "vendor"), []byte(card.vendor), 0o600); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(filepath.Join(deviceDir, "device"), []byte(card.device), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.MkdirAll(filepath.Join(root, "card2-DP-1"), 0o700); err != nil {
		t.Fatal(err)
	}

	got, err := discoverLinuxAccelerators(root)
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 {
		t.Fatalf("accelerators=%+v", got)
	}
	if got[0].Index != 2 || got[1].Index != 10 {
		t.Fatalf("accelerators not numerically sorted: %+v", got)
	}
	if got[0].VendorID != "0x1002" || got[0].DeviceID != "0x744c" {
		t.Fatalf("unexpected normalized PCI IDs: %+v", got[0])
	}
}

func TestDiscoveryDoesNotExposeSensitiveHostIdentifiers(t *testing.T) {
	snapshot := DiscoverHost()
	text := strings.ToLower(strings.Join([]string{
		snapshot.SchemaVersion,
		snapshot.OS.Name,
		snapshot.OS.Architecture,
		snapshot.CPU.Model,
		snapshot.Software.Executable,
		strings.Join(snapshot.Software.DetectedTools, ","),
		strings.Join(snapshot.Warnings, ","),
	}, " "))
	for _, forbidden := range []string{"mac address", "ip address", "serial number", "environment variable", "home directory"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("discovery unexpectedly exposes %q", forbidden)
		}
	}
}
