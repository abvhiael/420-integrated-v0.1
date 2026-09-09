package main

import (
	"bytes"
	"context"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	storage "github.com/420integrated/420-integrated/execution/storage"
)

const (
	version      = "0.1.0-dev"
	gethBaseline = "v1.17.5"
)

var errStorageServiceExited = errors.New("storage service exited unexpectedly")

func findGeth(explicit string) (string, error) {
	if explicit != "" { return explicit, nil }
	if env := os.Getenv("NODE420_GETH"); env != "" { return env, nil }
	return exec.LookPath("geth")
}

func verifyBaseline(path string) error {
	out, err := exec.Command(path, "version").CombinedOutput()
	if err != nil { return fmt.Errorf("geth version: %w: %s", err, string(out)) }
	if !bytes.Contains(out, []byte("1.17.5")) { return fmt.Errorf("node420 requires go-ethereum %s; got: %s", gethBaseline, strings.TrimSpace(string(out))) }
	return nil
}

type serviceRunner interface { Run(context.Context) error }

type managedProcess interface {
	Wait() error
	Signal(os.Signal) error
	Kill() error
}

type commandProcess struct { cmd *exec.Cmd }
func (p commandProcess) Wait() error { return p.cmd.Wait() }
func (p commandProcess) Signal(sig os.Signal) error {
	if p.cmd == nil || p.cmd.Process == nil { return os.ErrInvalid }
	return p.cmd.Process.Signal(sig)
}
func (p commandProcess) Kill() error {
	if p.cmd == nil || p.cmd.Process == nil { return os.ErrInvalid }
	return p.cmd.Process.Kill()
}

func stopProcess(proc managedProcess, processErr <-chan error, timeout time.Duration) error {
	if timeout <= 0 { timeout = 10 * time.Second }
	if err := proc.Signal(syscall.SIGTERM); err != nil && !errors.Is(err, os.ErrProcessDone) {
		_ = proc.Kill()
	}
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	select {
	case err := <-processErr:
		return err
	case <-timer.C:
		if err := proc.Kill(); err != nil && !errors.Is(err, os.ErrProcessDone) { return err }
		return <-processErr
	}
}

func supervise(ctx context.Context, proc managedProcess, service serviceRunner, shutdownTimeout time.Duration) error {
	if proc == nil || service == nil { return errors.New("invalid node420 supervisor") }
	runCtx, cancel := context.WithCancel(ctx)
	defer cancel()

	serviceErr := make(chan error, 1)
	go func() { serviceErr <- service.Run(runCtx) }()
	processErr := make(chan error, 1)
	go func() { processErr <- proc.Wait() }()

	select {
	case err := <-processErr:
		cancel()
		select {
		case serviceRunErr := <-serviceErr:
			if err != nil { return fmt.Errorf("geth: %w", err) }
			if serviceRunErr != nil && !errors.Is(serviceRunErr, context.Canceled) { return fmt.Errorf("storage service: %w", serviceRunErr) }
			return nil
		case <-time.After(shutdownTimeout):
			if err != nil { return fmt.Errorf("geth: %w", err) }
			return errors.New("storage service did not stop after geth exit")
		}
	case err := <-serviceErr:
		cancel()
		stopErr := stopProcess(proc, processErr, shutdownTimeout)
		if err != nil && !errors.Is(err, context.Canceled) { return fmt.Errorf("storage service: %w", err) }
		if ctx.Err() == nil {
			if stopErr != nil { return fmt.Errorf("%w; geth shutdown: %v", errStorageServiceExited, stopErr) }
			return errStorageServiceExited
		}
		return nil
	case <-ctx.Done():
		cancel()
		stopErr := stopProcess(proc, processErr, shutdownTimeout)
		select {
		case err := <-serviceErr:
			if err != nil && !errors.Is(err, context.Canceled) { return fmt.Errorf("storage service shutdown: %w", err) }
		case <-time.After(shutdownTimeout):
			return errors.New("storage service shutdown timed out")
		}
		if stopErr != nil { return fmt.Errorf("geth shutdown: %w", stopErr) }
		return nil
	}
}

func main() {
	showVersion := flag.Bool("version", false, "print node420 version and pinned Geth baseline")
	gethPath := flag.String("geth", "", "path to pinned geth binary; defaults to NODE420_GETH or PATH")
	dryRun := flag.Bool("dry-run", false, "print command without launching")
	verify := flag.Bool("verify-geth", false, "verify pinned Geth version and exit")
	initGenesis := flag.String("init-genesis", "", "initialize datadir from execution genesis and exit")
	datadir := flag.String("datadir", "./data/node420", "node420 data directory")
	jwtSecret := flag.String("jwt-secret", "./jwt.hex", "Engine API JWT secret")
	authAddr := flag.String("authrpc.addr", "127.0.0.1", "Engine API listen address")
	authPort := flag.Int("authrpc.port", 8551, "Engine API port")
	httpAddr := flag.String("http.addr", "127.0.0.1", "JSON-RPC listen address")
	httpPort := flag.Int("http.port", 8545, "JSON-RPC port")
	p2pPort := flag.Int("port", 30303, "execution P2P port")

	storageEnabled := flag.Bool("storage", false, "enable 420Store provider service")
	storageNodeID := flag.String("storage.node-id", "", "canonical storage node bytes32 id")
	storageCapacity := flag.Uint64("storage.capacity-bytes", 0, "local storage capacity in bytes")
	storageListen := flag.String("storage.listen", "127.0.0.1:8420", "storage provider HTTP listen address")
	storageRPC := flag.String("storage.rpc", "", "execution JSON-RPC URL; defaults to local node420 HTTP RPC")
	storageStartBlock := flag.Uint64("storage.start-block", 0, "first block to scan for storage events")
	storageConfirmations := flag.Uint64("storage.confirmations", 2, "confirmed blocks required before projection")
	storageSyncInterval := flag.Duration("storage.sync-interval", 5*time.Second, "storage chain synchronization interval")
	storageAgreement := flag.String("storage.contract.agreement", "", "StorageAgreementRegistry420 address")
	storageCommitment := flag.String("storage.contract.commitment", "", "StorageCommitmentRegistry420 address")
	storageCapacityContract := flag.String("storage.contract.capacity", "", "StorageCapacityRegistry420 address")
	storageSettlement := flag.String("storage.contract.settlement", "", "StorageSettlementRegistry420 address")
	storageScheme := flag.String("storage.contract.scheme", "", "StorageProofSchemeRegistry420 address")
	storageManifest := flag.String("storage.contract.manifest", "", "StorageObjectManifestRegistry420 address")
	flag.Parse()

	if *showVersion { fmt.Printf("node420 %s (go-ethereum baseline %s)\n", version, gethBaseline); return }
	path, err := findGeth(*gethPath)
	if err != nil { fmt.Fprintln(os.Stderr, "node420: pinned geth binary not found"); os.Exit(1) }
	if err := verifyBaseline(path); err != nil { fmt.Fprintln(os.Stderr, err); os.Exit(2) }
	if *verify { fmt.Printf("node420: verified go-ethereum %s\n", gethBaseline); return }

	if *initGenesis != "" {
		args := []string{"--datadir", *datadir, "init", *initGenesis}
		if *dryRun { fmt.Printf("%s %s\n", filepath.Clean(path), strings.Join(args, " ")); return }
		cmd := exec.Command(path, args...); cmd.Stdin=os.Stdin; cmd.Stdout=os.Stdout; cmd.Stderr=os.Stderr
		if err := cmd.Run(); err != nil { fmt.Fprintln(os.Stderr, "node420 init:", err); os.Exit(1) }
		return
	}

	args := []string{
		"--datadir", *datadir,
		"--authrpc.addr", *authAddr, "--authrpc.port", fmt.Sprintf("%d", *authPort),
		"--authrpc.jwtsecret", *jwtSecret, "--authrpc.vhosts", "localhost",
		"--http", "--http.addr", *httpAddr, "--http.port", fmt.Sprintf("%d", *httpPort),
		"--http.api", "eth,net,web3",
		"--port", fmt.Sprintf("%d", *p2pPort),
		"--syncmode", "full",
	}
	args = append(args, flag.Args()...)
	if *dryRun {
		fmt.Printf("%s %s\n", filepath.Clean(path), strings.Join(args, " "))
		if *storageEnabled { fmt.Printf("node420 storage listen=%s data=%s\n", *storageListen, filepath.Join(*datadir,"storage")) }
		return
	}

	cmd := exec.Command(path,args...); cmd.Stdin=os.Stdin; cmd.Stdout=os.Stdout; cmd.Stderr=os.Stderr
	if !*storageEnabled {
		if err := cmd.Run(); err != nil { fmt.Fprintln(os.Stderr,"node420:",err); os.Exit(1) }
		return
	}

	rpcURL := *storageRPC
	if rpcURL == "" { rpcURL = fmt.Sprintf("http://%s:%d", *httpAddr, *httpPort) }
	service, err := storage.NewService(storage.ServiceConfig{
		NodeID:*storageNodeID, CapacityBytes:*storageCapacity, DataDir:filepath.Join(*datadir,"storage"), ListenAddr:*storageListen,
		RPCURL:rpcURL, StartBlock:*storageStartBlock, Confirmations:*storageConfirmations, SyncInterval:*storageSyncInterval,
		Contracts:storage.RPCStorageContracts{Agreement:*storageAgreement,Commitment:*storageCommitment,Capacity:*storageCapacityContract,Settlement:*storageSettlement,Scheme:*storageScheme,Manifest:*storageManifest},
	})
	if err != nil { fmt.Fprintln(os.Stderr,"node420 storage config:",err); os.Exit(2) }

	ctx,cancel:=signal.NotifyContext(context.Background(),os.Interrupt,syscall.SIGTERM)
	defer cancel()
	if err:=cmd.Start(); err!=nil { fmt.Fprintln(os.Stderr,"node420:",err); os.Exit(1) }
	if err:=supervise(ctx, commandProcess{cmd:cmd}, service, 10*time.Second); err!=nil {
		fmt.Fprintln(os.Stderr,"node420:",err)
		os.Exit(1)
	}
}
