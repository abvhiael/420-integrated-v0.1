package main

import (
	"context"
	"crypto/sha256"
	"flag"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/telemetry"
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

	settlement := flag.Bool("certified-settlement", false, "consume verified quorum-certified blocks and persist execution settlement/history")
	trustPath := flag.String("settlement-trust", "", "independently provisioned consensus genesis/committee checkpoint")
	trustPin := flag.String("settlement-trust-sha256", "", "required SHA-256 of trusted checkpoint file")
	settlementDir := flag.String("settlement-dir", "", "persistent certified history and sequence directory")
	repairSequence := flag.Bool("recover-sequence", false, "explicitly repair a sequence journal from verified certified history")
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
	protectedSigning := flag.Bool("protected-signing", false, "sign typed production duties exclusively through an authenticated protected remote signer")
	signerEndpoint := flag.String("signer", "", "HTTPS remote validator signer")
	signingPolicy := flag.String("signing-policy", "", "independently pinned validator signing policy")
	signingPolicyPin := flag.String("signing-policy-sha256", "", "required signing policy SHA-256")
	signingHistory := flag.String("signing-history", "", "existing private local slashing journal")
	signingCert := flag.String("signer-client-cert", "", "dedicated P-256 validator client TLS certificate")
	signingKey := flag.String("signer-client-key", "", "private validator transport key, never a Wallet/owner key")
	signingCA := flag.String("signer-ca", "", "remote signer CA")
	signingPeer := flag.String("signer-spki-sha256", "", "remote signer transport public-key pin")
	flag.Parse()
	if *protectedSigning {
		if *devnet || *settlement || *engineProbe || *engineEndpoint != "" {
			fmt.Fprintln(os.Stderr, "protected signing excludes simulator/settlement/Engine credential modes")
			os.Exit(2)
		}
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if err := runProtectedSigning(ctx, *signerEndpoint, *signingPolicy, *signingPolicyPin, *signingHistory, *signingCert, *signingKey, *signingCA, *signingPeer); err != nil {
			fmt.Fprintln(os.Stderr, "STAKE_VALIDATOR_SIGNING_HALTED")
			os.Exit(1)
		}
		return
	}

	if *showVersion {
		fmt.Printf("fourtwentyd %s\n", version)
		return
	}
	if *showProtocol {
		fmt.Printf("chain_id=%d slot_seconds=%d slots_per_epoch=%d epochs_per_rotation=%d slots_per_rotation=%d\n",
			protocol.ChainID, protocol.SlotSeconds, protocol.SlotsPerEpoch, protocol.EpochsPerRotation, protocol.SlotsPerRotation)
		return
	}
	if *settlement {
		if *devnet || *engineProbe || *engineEndpoint == "" || *settlementDir == "" {
			fmt.Fprintln(os.Stderr, "certified settlement requires Engine/state and excludes devnet/probe modes")
			os.Exit(2)
		}
		ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
		defer stop()
		if err := runSettlement(ctx, *engineEndpoint, *jwtPath, *trustPath, *trustPin, *settlementDir, *repairSequence); err != nil {
			code, _ := telemetry.SettlementCode(err)
			fmt.Fprintln(os.Stderr, "STAKE_SETTLEMENT_HALTED", code)
			os.Exit(1)
		}
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
