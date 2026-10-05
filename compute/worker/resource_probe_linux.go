package worker

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"
)

type LinuxHostResourceProbe struct {
	procStatPath string
	thermalRoot  string
	hwmonRoot    string
	devRoot      string
	now          func() time.Time
	mu           sync.Mutex
	previous     cpuTimes
}

type cpuTimes struct {
	total uint64
	idle  uint64
	valid bool
}

func NewLinuxHostResourceProbe() *LinuxHostResourceProbe {
	return &LinuxHostResourceProbe{
		procStatPath: "/proc/stat",
		thermalRoot:  "/sys/class/thermal",
		hwmonRoot:    "/sys/class/hwmon",
		devRoot:      "/dev",
		now:          time.Now,
	}
}

func newLinuxHostResourceProbe(procStatPath, thermalRoot, hwmonRoot, devRoot string, now func() time.Time) *LinuxHostResourceProbe {
	if now == nil {
		now = time.Now
	}
	return &LinuxHostResourceProbe{
		procStatPath: procStatPath,
		thermalRoot: thermalRoot,
		hwmonRoot: hwmonRoot,
		devRoot: devRoot,
		now: now,
	}
}

func (p *LinuxHostResourceProbe) Snapshot(ctx context.Context) (HostResourceSnapshot, error) {
	if err := ctx.Err(); err != nil {
		return HostResourceSnapshot{}, err
	}
	snapshot := HostResourceSnapshot{
		CapturedAt:  p.now().UTC(),
		LogicalCPUs: runtime.NumCPU(),
	}
	if runtime.GOOS != "linux" && p.procStatPath == "/proc/stat" {
		return snapshot, nil
	}

	current, err := readCPUTimes(p.procStatPath)
	if err != nil {
		return HostResourceSnapshot{}, fmt.Errorf("read CPU telemetry: %w", err)
	}
	p.mu.Lock()
	previous := p.previous
	p.previous = current
	p.mu.Unlock()
	if previous.valid && current.total > previous.total {
		totalDelta := current.total - previous.total
		idleDelta := current.idle - previous.idle
		if idleDelta <= totalDelta {
			snapshot.CPUUtilizationPercent = 100 * (1 - float64(idleDelta)/float64(totalDelta))
			snapshot.CPUUtilizationKnown = true
		}
	}

	cpuTemp, cpuKnown := maxThermalTemperature(p.thermalRoot)
	if named, known := maxHWMonTemperature(p.hwmonRoot, []string{"coretemp", "k10temp", "zenpower", "cpu", "soc"}); known {
		if !cpuKnown || named > cpuTemp {
			cpuTemp, cpuKnown = named, true
		}
	}
	snapshot.CPUTemperatureC = cpuTemp
	snapshot.CPUTemperatureKnown = cpuKnown

	gpuTemp, gpuKnown := maxHWMonTemperature(p.hwmonRoot, []string{"nvidia", "amdgpu", "nouveau", "gpu"})
	snapshot.GPUTemperatureC = gpuTemp
	snapshot.GPUTemperatureKnown = gpuKnown
	snapshot.GPUAvailable = gpuKnown || gpuDevicePresent(p.devRoot)
	return snapshot, nil
}

func readCPUTimes(path string) (cpuTimes, error) {
	file, err := os.Open(path)
	if err != nil {
		return cpuTimes{}, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return cpuTimes{}, err
		}
		return cpuTimes{}, fmt.Errorf("missing aggregate cpu line")
	}
	fields := strings.Fields(scanner.Text())
	if len(fields) < 5 || fields[0] != "cpu" {
		return cpuTimes{}, fmt.Errorf("invalid aggregate cpu line")
	}
	var values []uint64
	for _, field := range fields[1:] {
		value, err := strconv.ParseUint(field, 10, 64)
		if err != nil {
			return cpuTimes{}, fmt.Errorf("invalid cpu counter")
		}
		values = append(values, value)
	}
	var total uint64
	for _, value := range values {
		total += value
	}
	idle := values[3]
	if len(values) > 4 {
		idle += values[4]
	}
	return cpuTimes{total: total, idle: idle, valid: true}, nil
}

func maxThermalTemperature(root string) (float64, bool) {
	paths, _ := filepath.Glob(filepath.Join(root, "thermal_zone*", "temp"))
	var max float64
	var known bool
	for _, path := range paths {
		if value, ok := readMilliCelsius(path); ok && (!known || value > max) {
			max, known = value, true
		}
	}
	return max, known
}

func maxHWMonTemperature(root string, names []string) (float64, bool) {
	dirs, _ := filepath.Glob(filepath.Join(root, "hwmon*"))
	var max float64
	var known bool
	for _, dir := range dirs {
		rawName, err := os.ReadFile(filepath.Join(dir, "name"))
		if err != nil {
			continue
		}
		name := strings.ToLower(strings.TrimSpace(string(rawName)))
		match := false
		for _, allowed := range names {
			if strings.Contains(name, strings.ToLower(allowed)) {
				match = true
				break
			}
		}
		if !match {
			continue
		}
		temps, _ := filepath.Glob(filepath.Join(dir, "temp*_input"))
		for _, path := range temps {
			if value, ok := readMilliCelsius(path); ok && (!known || value > max) {
				max, known = value, true
			}
		}
	}
	return max, known
}

func readMilliCelsius(path string) (float64, bool) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return 0, false
	}
	value, err := strconv.ParseFloat(strings.TrimSpace(string(raw)), 64)
	if err != nil {
		return 0, false
	}
	if value > 1000 {
		value /= 1000
	}
	if value < -50 || value > 200 {
		return 0, false
	}
	return value, true
}

func gpuDevicePresent(root string) bool {
	for _, pattern := range []string{
		filepath.Join(root, "nvidia0"),
		filepath.Join(root, "dri", "renderD*"),
	} {
		matches, _ := filepath.Glob(pattern)
		if len(matches) > 0 {
			return true
		}
	}
	return false
}
