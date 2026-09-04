package main

import (
	"context"
	"crypto/sha256"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	dev "github.com/420integrated/420-integrated/consensus/devnet"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	protocol "github.com/420integrated/420-integrated/consensus/types"
)

const version = "0.1.0-dev"

func main() {
	showVersion := flag.Bool("version", false, "print version and exit")
	showProtocol := flag.Bool("protocol", false, "print frozen protocol timing constants")
	engineEndpoint := flag.String("engine", "", "Engine API endpoint")
	jwtPath := flag.String("jwt-secret", "./jwt.hex", "Engine API JWT secret")
	engineProbe := flag.Bool("engine-probe", false, "negotiate Engine API capabilities and exit")

	devnet := flag.Bool("devnet-validator", false, "run deterministic local devnet validator")
	nodeID := flag.Uint64("node-id", 0, "devnet node/validator id")
	seat := flag.Uint("seat", 0, "devnet seat 0..14")
	bus := flag.String("bus", "127.0.0.1:9420", "devnet TCP broker")
	maxSlots := flag.Uint64("max-slots", 8, "devnet slots before exit")
	slotMS := flag.Int("slot-ms", 250, "devnet accelerated slot duration milliseconds")
	primaryDown := flag.Bool("primary-down", false, "devnet: treat scheduled primary as unavailable")
	fb1Down := flag.Bool("fb1-down", false, "devnet: treat fallback-1 as unavailable")
	statePath := flag.String("state", "", "devnet persistent consensus state file")
	engineStatePath := flag.String("engine-state", "", "devnet file sink for Engine head/safe/finalized")
	flag.Parse()

	if *showVersion {
		fmt.Printf("fourtwentyd %s\n", version)
		return
	}
	if *showProtocol {
		fmt.Printf("chain_id=%d slot_seconds=%d slots_per_epoch=%d epochs_per_rotation=%d slots_per_rotation=%d\n",
			protocol.ChainID, protocol.SlotSeconds, protocol.SlotsPerEpoch, protocol.EpochsPerRotation, protocol.SlotsPerRotation)
		return
	}
	if *engineProbe {
		if *engineEndpoint == "" {
			fmt.Fprintln(os.Stderr, "--engine is required")
			os.Exit(2)
		}
		secret, err := eng.LoadJWTSecret(*jwtPath)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		c, err := eng.NewClient(*engineEndpoint, secret)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		wanted := []string{"engine_forkchoiceUpdatedV3", "engine_getPayloadV3", "engine_newPayloadV3", "engine420_submitSystemCallsV1"}
		caps, err := c.ExchangeCapabilities(ctx, wanted)
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(3)
		}
		fmt.Printf("fourtwentyd: Engine API reachable; capabilities=%v; required_420=%s\n", caps, "engine420_submitSystemCallsV1")
		return
	}
	if *devnet {
		if *seat > 14 {
			fmt.Fprintln(os.Stderr, "seat must be 0..14")
			os.Exit(2)
		}
		seed := sha256.Sum256([]byte("420-step4.5-devnet-seed"))
		var sink eng.ForkchoiceSink
		if *engineEndpoint != "" {
			secret, err := eng.LoadJWTSecret(*jwtPath)
			if err != nil {
				fmt.Fprintln(os.Stderr, "engine jwt:", err)
				os.Exit(2)
			}
			client, err := eng.NewClient(*engineEndpoint, secret)
			if err != nil {
				fmt.Fprintln(os.Stderr, "engine client:", err)
				os.Exit(2)
			}
			sink = eng.ClientSink{Client: client}
		} else if *engineStatePath != "" {
			sink = dev.NewFileEngineSink(*engineStatePath)
		}
		n, err := dev.New(dev.Config{
			NodeID: *nodeID, Seat: uint16(*seat), Bus: *bus, Seed: seed,
			FaultPrimary: *primaryDown, FaultFB1: *fb1Down, MaxSlots: *maxSlots,
			SlotDuration: time.Duration(*slotMS) * time.Millisecond,
			StatePath:    *statePath, EngineSink: sink,
		})
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if err := n.Run(ctx); err != nil && err != context.Canceled {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		return
	}
	fmt.Println("fourtwentyd: Step 4.7 scaffold; use --devnet-validator for local multiprocess devnet")
}
