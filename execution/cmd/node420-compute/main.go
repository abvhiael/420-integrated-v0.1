package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/420integrated/420-integrated/compute/worker"
)

type stringListFlag []string

func (f *stringListFlag) String() string { return fmt.Sprint([]string(*f)) }
func (f *stringListFlag) Set(value string) error {
	*f = append(*f, value)
	return nil
}

type standbyService struct{}

func (standbyService) Name() string { return "cmp-3.1-standby" }
func (standbyService) Run(ctx context.Context) error {
	<-ctx.Done()
	return ctx.Err()
}

func main() {
	defaults := worker.DefaultConfig()
	chainID := flag.Uint64("chain-id", 0, "canonical chain ID")
	providerID := flag.String("provider-id", "", "canonical provider bytes32 ID")
	nodeID := flag.String("node-id", "", "canonical node bytes32 ID")
	resourceID := flag.String("resource-id", "", "canonical resource bytes32 ID")
	workerID := flag.String("worker-id", "", "canonical worker bytes32 ID")
	stateDir := flag.String("state-dir", defaults.StateDir, "private worker state directory")
	heartbeat := flag.Duration("heartbeat", defaults.HeartbeatPeriod, "local daemon heartbeat period")
	shutdownTimeout := flag.Duration("shutdown-timeout", defaults.ShutdownTimeout, "bounded graceful-shutdown timeout")
	check := flag.Bool("check", false, "validate CMP-3.1 daemon configuration and exit")
	discover := flag.Bool("discover", false, "print CMP-3.2 local hardware/software discovery JSON and exit")
	benchmark := flag.Bool("benchmark", false, "run CMP-3.3 local benchmark and print self-reported capability evidence JSON")

	resourceDefaults := worker.DefaultLocalResourcePolicy()
	cpuPercent := flag.Float64("cpu-percent", resourceDefaults.CPUPercent, "CMP-3.11 maximum local CPU percentage")
	gpuPercent := flag.Float64("gpu-percent", resourceDefaults.GPUPercent, "CMP-3.11 maximum GPU percentage; execution requires a qualified GPU share enforcer")
	idleOnly := flag.Bool("idle-only", resourceDefaults.IdleOnly, "CMP-3.11 run work only while host is idle")
	idleCPUThreshold := flag.Float64("idle-cpu-threshold-percent", resourceDefaults.IdleCPUThresholdPercent, "CMP-3.11 maximum CPU utilization considered idle")
	minIdle := flag.Duration("min-idle", resourceDefaults.MinIdleDuration, "CMP-3.11 minimum continuous idle duration")
	maxCPUTemp := flag.Float64("max-cpu-temp-c", resourceDefaults.MaxCPUTemperatureC, "CMP-3.11 CPU thermal ceiling in Celsius; 0 disables")
	maxGPUTemp := flag.Float64("max-gpu-temp-c", resourceDefaults.MaxGPUTemperatureC, "CMP-3.11 GPU thermal ceiling in Celsius; 0 disables")
	bandwidthBPS := flag.Uint64("bandwidth-bytes-per-second", resourceDefaults.BandwidthBytesPerSecond, "CMP-3.11 aggregate worker I/O byte-rate ceiling; 0 disables")
	bandwidthBurst := flag.Uint64("bandwidth-burst-bytes", resourceDefaults.BandwidthBurstBytes, "CMP-3.11 byte-rate burst allowance; must pair with bandwidth rate")
	resourceTimezone := flag.String("resource-timezone", resourceDefaults.TimeZone, "CMP-3.11 IANA timezone for schedule windows")
	resourcePoll := flag.Duration("resource-poll", resourceDefaults.TelemetryPollInterval, "CMP-3.11 host telemetry polling interval")
	var resourceWindows stringListFlag
	flag.Var(&resourceWindows, "resource-window", "CMP-3.11 repeatable weekly window DDD@HH:MM-HH:MM, e.g. Mon@18:00-23:00")

	securityDefaults := worker.DefaultMaliciousWorkloadPolicy()
	maxCommandBytes := flag.Int("max-command-bytes", securityDefaults.MaxCommandBytes, "CMP-3.12 maximum canonical argv bytes")
	maxArgumentBytes := flag.Int("max-argument-bytes", securityDefaults.MaxArgumentBytes, "CMP-3.12 maximum single argv element bytes")
	maxViolations := flag.Uint("max-workload-violations", uint(securityDefaults.MaxViolations), "CMP-3.12 local violation count before quarantine")
	quarantineDuration := flag.Duration("workload-quarantine", securityDefaults.QuarantineDuration, "CMP-3.12 local quarantine duration")
	var denyImages stringListFlag
	var denyCommands stringListFlag
	flag.Var(&denyImages, "deny-image", "CMP-3.12 repeatable immutable image digest deny entry")
	flag.Var(&denyCommands, "deny-command-sha256", "CMP-3.12 repeatable canonical command SHA-256 deny entry")
	flag.Parse()

	if *discover && *benchmark {
		fmt.Fprintln(os.Stderr, "node420-compute: --discover and --benchmark are mutually exclusive")
		os.Exit(2)
	}
	if *discover {
		snapshot := worker.DiscoverHost()
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(snapshot); err != nil {
			fmt.Fprintln(os.Stderr, "node420-compute: encode discovery:", err)
			os.Exit(1)
		}
		return
	}
	if *benchmark {
		discovery := worker.DiscoverHost()
		result, err := worker.RunBenchmark(worker.DefaultBenchmarkConfig())
		if err != nil {
			fmt.Fprintln(os.Stderr, "node420-compute: benchmark:", err)
			os.Exit(1)
		}
		evidence, err := worker.BuildCapabilityEvidence(discovery, result)
		if err != nil {
			fmt.Fprintln(os.Stderr, "node420-compute: capability evidence:", err)
			os.Exit(1)
		}
		encoder := json.NewEncoder(os.Stdout)
		encoder.SetIndent("", "  ")
		if err := encoder.Encode(evidence); err != nil {
			fmt.Fprintln(os.Stderr, "node420-compute: encode capability evidence:", err)
			os.Exit(1)
		}
		return
	}

	resourcePolicy := worker.DefaultLocalResourcePolicy()
	resourcePolicy.CPUPercent = *cpuPercent
	resourcePolicy.GPUPercent = *gpuPercent
	resourcePolicy.IdleOnly = *idleOnly
	resourcePolicy.IdleCPUThresholdPercent = *idleCPUThreshold
	resourcePolicy.MinIdleDuration = *minIdle
	resourcePolicy.MaxCPUTemperatureC = *maxCPUTemp
	resourcePolicy.MaxGPUTemperatureC = *maxGPUTemp
	resourcePolicy.BandwidthBytesPerSecond = *bandwidthBPS
	resourcePolicy.BandwidthBurstBytes = *bandwidthBurst
	resourcePolicy.TimeZone = *resourceTimezone
	resourcePolicy.TelemetryPollInterval = *resourcePoll
	for _, raw := range resourceWindows {
		window, err := worker.ParseScheduleWindow(raw)
		if err != nil {
			fmt.Fprintln(os.Stderr, "node420-compute:", err)
			os.Exit(2)
		}
		resourcePolicy.Schedule = append(resourcePolicy.Schedule, window)
	}
	if err := resourcePolicy.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, "node420-compute:", err)
		os.Exit(2)
	}

	securityPolicy := worker.DefaultMaliciousWorkloadPolicy()
	securityPolicy.MaxCommandBytes = *maxCommandBytes
	securityPolicy.MaxArgumentBytes = *maxArgumentBytes
	securityPolicy.MaxViolations = uint32(*maxViolations)
	securityPolicy.QuarantineDuration = *quarantineDuration
	securityPolicy.DenyImageDigests = map[string]bool{}
	for _, digest := range denyImages {
		securityPolicy.DenyImageDigests[digest] = true
	}
	securityPolicy.DenyCommandSHA256 = map[string]bool{}
	for _, digest := range denyCommands {
		securityPolicy.DenyCommandSHA256[digest] = true
	}
	if err := securityPolicy.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, "node420-compute:", err)
		os.Exit(2)
	}

	cfg := worker.Config{
		Identity: worker.Identity{
			ChainID:    *chainID,
			ProviderID: *providerID,
			NodeID:     *nodeID,
			ResourceID: *resourceID,
			WorkerID:   *workerID,
		},
		StateDir:        *stateDir,
		HeartbeatPeriod: *heartbeat,
		ShutdownTimeout: *shutdownTimeout,
	}
	if err := cfg.Validate(); err != nil {
		fmt.Fprintln(os.Stderr, "node420-compute:", err)
		os.Exit(2)
	}
	if *check {
		fmt.Printf("node420-compute: configuration valid for chain %d worker %s; resource policy valid cpu=%.2f%% gpu=%.2f%% idleOnly=%t bandwidth=%d B/s windows=%d; security policy valid maxCommandBytes=%d maxArgumentBytes=%d maxViolations=%d quarantine=%s denyImages=%d denyCommands=%d\n",
			cfg.Identity.ChainID, cfg.Identity.WorkerID, resourcePolicy.CPUPercent, resourcePolicy.GPUPercent,
			resourcePolicy.IdleOnly, resourcePolicy.BandwidthBytesPerSecond, len(resourcePolicy.Schedule),
			securityPolicy.MaxCommandBytes, securityPolicy.MaxArgumentBytes, securityPolicy.MaxViolations,
			securityPolicy.QuarantineDuration, len(securityPolicy.DenyImageDigests), len(securityPolicy.DenyCommandSHA256))
		return
	}

	daemon, err := worker.New(cfg, standbyService{})
	if err != nil {
		fmt.Fprintln(os.Stderr, "node420-compute:", err)
		os.Exit(2)
	}
	ctx, cancel := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer cancel()

	fmt.Fprintln(os.Stderr, "node420-compute: CMP-3.1 daemon foundation only; workload execution is disabled until later CMP-3 steps")
	if err := daemon.Run(ctx); err != nil {
		fmt.Fprintln(os.Stderr, "node420-compute:", err)
		os.Exit(1)
	}
}
