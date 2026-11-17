package main

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/accounting"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/recovery"
	"github.com/420integrated/420-integrated/indexer/store"
	"os"
	"path/filepath"
	"time"
)

func run() (accounting.Report, error) {
	trustPath := flag.String("trust", "", "pinned consensus trust file")
	trustPin := flag.String("trust-sha256", "", "independent trust digest")
	dir := flag.String("consensus-dir", "", "certified settlement directory (read-only)")
	indexPath := flag.String("indexer-store", "", "persistent Indexer file snapshot (read-only)")
	engineURL := flag.String("engine", "", "authenticated paired Engine endpoint")
	rpcURL := flag.String("rpc", "", "paired ordinary execution RPC")
	jwt := flag.String("jwt-secret", "", "paired Engine credential")
	output := flag.String("output", "", "optional atomic machine-readable report output")
	flag.Parse()
	report := accounting.Report{Schema: "420-stake-accounting-reconciliation-v1", Status: "DISCREPANCY", Discrepancies: []accounting.Discrepancy{}}
	finish := func(err error) (accounting.Report, error) {
		if err != nil {
			report.Status = "DISCREPANCY"
			report.Discrepancies = append(report.Discrepancies, accounting.Discrepancy{Code: "INPUT_UNAVAILABLE_OR_INVALID", Path: "source", Expected: "coherent authenticated accounting inputs", Actual: err.Error()})
		}
		if *output != "" {
			raw, _ := json.MarshalIndent(report, "", "  ")
			if writeErr := writeAtomic(*output, append(raw, '\n')); writeErr != nil {
				report.Status = "DISCREPANCY"
				report.Discrepancies = append(report.Discrepancies, accounting.Discrepancy{Code: "REPORT_WRITE_FAILED", Actual: writeErr.Error()})
				return report, writeErr
			}
		}
		return report, err
	}
	raw, err := os.ReadFile(*trustPath)
	if err != nil {
		return finish(err)
	}
	hash := sha256.Sum256(raw)
	if len(*trustPin) != 64 || hex.EncodeToString(hash[:]) != *trustPin {
		return finish(fmt.Errorf("consensus trust pin mismatch"))
	}
	var trust recovery.Trust
	if err = recovery.Decode(raw, &trust); err != nil {
		return finish(err)
	}
	snapshot, err := recovery.ReadCertifiedSnapshot(trust, *dir)
	if err != nil {
		return finish(err)
	}
	before, err := os.ReadFile(*indexPath)
	if err != nil {
		return finish(err)
	}
	var document map[string]json.RawMessage
	if err = recovery.Decode(before, &document); err != nil {
		return finish(err)
	}
	index, err := store.NewFileStore(*indexPath)
	if err != nil {
		return finish(err)
	}
	cp, ok, err := index.Checkpoint()
	if err != nil {
		return finish(err)
	}
	if !ok {
		return finish(fmt.Errorf("missing Indexer checkpoint"))
	}
	logs, err := index.LogsByAddresses(accounting.Addresses...)
	if err != nil {
		return finish(err)
	}
	view := accounting.Index{ChainID: cp.ChainID, Height: cp.IndexedHeight, Hash: cp.IndexedHash, FinalizedHeight: cp.FinalizedHeight, FinalizedHash: cp.FinalizedHash, Logs: logs, Blocks: map[uint64]string{}}
	for n := uint64(0); n <= cp.IndexedHeight; n++ {
		block, exists, err := index.Block(n)
		if err != nil {
			return finish(err)
		}
		if exists {
			view.Blocks[n] = block.Hash
		}
		if n == cp.IndexedHeight {
			break
		}
	}
	secret, err := eng.LoadJWTSecret(*jwt)
	if err != nil {
		return finish(err)
	}
	client, err := eng.NewClient(*engineURL, secret)
	if err != nil {
		return finish(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	report = accounting.Reconcile(ctx, snapshot, accounting.NewRPCSource(*rpcURL, client, snapshot), view)
	after, err := os.ReadFile(*indexPath)
	if err != nil {
		return finish(err)
	}
	if sha256.Sum256(before) != sha256.Sum256(after) {
		report.Status = "DISCREPANCY"
		return finish(fmt.Errorf("Indexer snapshot changed during audit"))
	}
	current, err := recovery.ReadCertifiedSnapshot(trust, *dir)
	if err != nil {
		return finish(err)
	}
	if current.Head != snapshot.Head || current.Finalized != snapshot.Finalized || current.Anchor != snapshot.Anchor {
		report.Status = "DISCREPANCY"
		return finish(fmt.Errorf("consensus changed during audit"))
	}
	return finish(nil)
}
func writeAtomic(path string, data []byte) error {
	dir := filepath.Dir(path)
	f, err := os.CreateTemp(dir, ".stake-accounting-report-")
	if err != nil {
		return err
	}
	name := f.Name()
	defer os.Remove(name)
	defer f.Close()
	if _, err = f.Write(data); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	d, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer d.Close()
	return d.Sync()
}
func main() {
	report, err := run()
	_ = json.NewEncoder(os.Stdout).Encode(report)
	if err != nil || report.Status != "RECONCILED" {
		os.Exit(1)
	}
}
