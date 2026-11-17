//go:build blst

package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"flag"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/accounting"
	"github.com/420integrated/420-integrated/consensus/crypto/bls"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	ct "github.com/420integrated/420-integrated/consensus/types"
	ethhash "github.com/420integrated/420-integrated/execution/storage"
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/store"
	"net/http"
	"net/http/httptest"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

func hashJSONTest(v any) string {
	raw, _ := json.Marshal(v)
	h := sha256.Sum256(raw)
	return hex.EncodeToString(h[:])
}
func TestAccountingCommandProcess(t *testing.T) {
	if raw := os.Getenv("STAKE_RECONCILE_TEST_ARGS"); raw != "" {
		var args []string
		json.Unmarshal([]byte(raw), &args)
		os.Args = append([]string{"stake-reconcile"}, args...)
		flag.CommandLine = flag.NewFlagSet("stake-reconcile", flag.ContinueOnError)
		main()
		os.Exit(0)
		return
	}
	dir := t.TempDir()
	trust := rec.Trust{ChainID: 420, ProtocolVersion: 1, Genesis: ct.Checkpoint{Root: [32]byte{1}}, Execution: sys.SequenceAnchor{ChainID: 420, BlockHash: [32]byte{2}}, CommitteeRoot: [32]byte{3}}
	for i := 0; i < 15; i++ {
		seed := sha256.Sum256([]byte(fmt.Sprint("accounting-command-fixture-", i)))
		sk, pk, err := bls.SecretFromIKM(seed[:])
		if err != nil {
			t.Fatal(err)
		}
		pop, err := sk.ProofOfPossession(pk)
		if err != nil {
			t.Fatal(err)
		}
		trust.Members = append(trust.Members, rec.Member{PublicKey: pk, Proof: pop})
	}
	write := func(name string, v any) {
		t.Helper()
		raw, err := json.Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(filepath.Join(dir, name), raw, 0600); err != nil {
			t.Fatal(err)
		}
	}
	h := struct {
		Schema, TrustHash string
		Entries           []rec.Record
		Pending           *rec.Record
		Checksum          string
	}{Schema: "420-certified-settlement-history-v1", TrustHash: hashJSONTest(trust)}
	h.Checksum = hashJSONTest(h)
	c := struct {
		Schema, TrustHash string
		Head, Finalized   ct.Checkpoint
		Settlement        sys.SequenceAnchor
		Checksum          string
	}{Schema: "420-settlement-checkpoint-v1", TrustHash: h.TrustHash, Head: trust.Genesis, Finalized: trust.Genesis, Settlement: trust.Execution}
	c.Checksum = hashJSONTest(c)
	write("trust.json", trust)
	write("history.json", h)
	write("checkpoint.json", c)
	if err := os.WriteFile(filepath.Join(dir, "jwt"), []byte(strings.Repeat("42", 32)), 0600); err != nil {
		t.Fatal(err)
	}
	hash := fmt.Sprintf("0x%x", trust.Execution.BlockHash)
	index, err := store.NewFileStore(filepath.Join(dir, "index.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err = index.PutBundle(model.BlockRecord{ChainID: 420, Hash: hash}, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if err = index.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHash: hash, FinalizedHash: hash}); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var q struct {
			ID     any
			Method string
			Params []json.RawMessage
		}
		json.NewDecoder(r.Body).Decode(&q)
		if !strings.HasPrefix(r.Header.Get("Authorization"), "Bearer ") {
			t.Error("missing auth")
		}
		var result any = "0x" + strings.Repeat("0", 64)
		switch q.Method {
		case "eth_chainId":
			result = "0x1a4"
		case "eth_getBlockByNumber":
			result = map[string]string{"hash": hash, "number": "0x0"}
		case "eth_getBalance":
			result = "0x0"
		case "eth_call":
			var call struct{ To, Data string }
			json.Unmarshal(q.Params[0], &call)
			var pin struct {
				BlockHash        string
				RequireCanonical bool
			}
			json.Unmarshal(q.Params[1], &pin)
			if pin.BlockHash != hash || !pin.RequireCanonical {
				t.Error("unbound getter")
			}
			if call.Data == ethhash.EventTopic("protocolVersion()")[:10] {
				v := 2
				if call.To == accounting.Registry {
					v = 3
				}
				result = fmt.Sprintf("0x%064x", v)
			}
		default:
			t.Error("unexpected method", q.Method)
		}
		json.NewEncoder(w).Encode(map[string]any{"jsonrpc": "2.0", "id": q.ID, "result": result})
	}))
	defer server.Close()
	args := []string{"--trust", filepath.Join(dir, "trust.json"), "--trust-sha256", hashJSONTest(trust), "--consensus-dir", dir, "--indexer-store", filepath.Join(dir, "index.json"), "--engine", server.URL, "--rpc", server.URL, "--jwt-secret", filepath.Join(dir, "jwt"), "--output", filepath.Join(dir, "report.json")}
	execute := func(args []string) (accounting.Report, error) {
		t.Helper()
		raw, _ := json.Marshal(args)
		cmd := exec.Command(os.Args[0], "-test.run=^TestAccountingCommandProcess$")
		cmd.Env = append(os.Environ(), "STAKE_RECONCILE_TEST_ARGS="+string(raw))
		out, err := cmd.Output()
		var report accounting.Report
		if decodeErr := json.Unmarshal(out, &report); decodeErr != nil {
			t.Fatalf("invalid machine report: %s %v", out, decodeErr)
		}
		return report, err
	}
	for i := 0; i < 3; i++ {
		report, err := execute(args)
		if err != nil || report.Status != "RECONCILED" || report.CanonicalAuthority {
			t.Fatal(report, err)
		}
	}
	args[3] = strings.Repeat("0", 64)
	report, err := execute(args)
	if err == nil || report.Status != "DISCREPANCY" {
		t.Fatal("wrong trust pin accepted", report)
	}
	args[3] = hashJSONTest(trust)
	args[len(args)-1] = filepath.Join(dir, "missing", "report.json")
	report, err = execute(args)
	if err == nil || report.Status != "DISCREPANCY" {
		t.Fatal("report write failure concealed", report)
	}
}
