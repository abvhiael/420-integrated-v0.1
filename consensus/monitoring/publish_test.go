package monitoring

import (
	"encoding/json"
	"github.com/420integrated/420-integrated/consensus/accounting"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestPublicPublisherRedactsSensitiveSourceAndPreservesFreshness(t *testing.T) {
	c, _, _, now := collectorFixture(t)
	var r accounting.Report
	raw, _ := os.ReadFile(c.config.AccountingReport)
	json.Unmarshal(raw, &r)
	r.FinalizedRoot = "0x" + strings.Repeat("1", 64)
	r.Status = "DISCREPANCY"
	r.Discrepancies = []accounting.Discrepancy{{Code: "MISSING_INDEXER_EVENT", Path: "/private/key", Expected: "secret", Actual: "postgres://private-credential"}}
	r.State["unrelated-private-key"] = "secret"
	writeEvidence(t, c.config.AccountingReport, r, now)
	dest := t.TempDir()
	if err := PublishPublicInputs(c.config, dest, "accounting", now); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(dest, "accounting/report.json")
	public, _ := os.ReadFile(path)
	if strings.Contains(string(public), "secret") || strings.Contains(string(public), "credential") || strings.Contains(string(public), "/private/") {
		t.Fatal("public publisher exported confidential source fields")
	}
	info, _ := os.Stat(path)
	if !info.ModTime().Equal(now) || info.Mode().Perm() != 0644 {
		t.Fatal("public projection changed freshness or read permissions", info.ModTime(), now)
	}
	if err := PublishPublicInputs(c.config, dest, "canary", now); err != nil {
		t.Fatal(err)
	}
	public, _ = os.ReadFile(filepath.Join(dest, "canary/snapshot.json"))
	if strings.Contains(string(public), "do-not-export-secret-version") {
		t.Fatal("version label leaked")
	}
	if err := PublishPublicInputs(c.config, dest, "signer-health", now); err != nil {
		t.Fatal(err)
	}
	if err := PublishPublicInputs(c.config, dest, "bls-key", now); err == nil {
		t.Fatal("unknown privileged publication accepted")
	}
	if err := PublishPublicInputs(c.config, dest, "canary", now.Add(time.Hour)); err == nil {
		t.Fatal("stale view was republished as fresh")
	}
}
