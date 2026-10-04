package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"

	"github.com/420integrated/420-integrated/compute/worker"
)

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
	flag.Parse()

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
		fmt.Printf("node420-compute: configuration valid for chain %d worker %s\n", cfg.Identity.ChainID, cfg.Identity.WorkerID)
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
