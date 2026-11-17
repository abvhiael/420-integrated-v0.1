package monitoring

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/accounting"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/consensus/telemetry"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/store"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

type fakeEngine struct {
	anchor sys.SequenceAnchor
	err    error
}

func (e *fakeEngine) CanonicalSequenceAnchor(context.Context, uint64, uint64, [32]byte) (sys.SequenceAnchor, error) {
	return e.anchor, e.err
}
func writeEvidence(t *testing.T, path string, v any, now time.Time) {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(path, raw, 0600); err != nil {
		t.Fatal(err)
	}
	os.Chtimes(path, now, now)
}
func collectorFixture(t *testing.T) (*Collector, rec.CertifiedSnapshot, *fakeEngine, time.Time) {
	t.Helper()
	now := time.Unix(2000000000, 0).UTC()
	dir := t.TempDir()
	config := testConfig(t, "http://127.0.0.1:1")
	config.ConsensusDir = dir
	config.IndexerStore = filepath.Join(dir, "index.json")
	config.AccountingReport = filepath.Join(dir, "report.json")
	config.CanarySnapshot = filepath.Join(dir, "canary.json")
	config.SignerHealth = filepath.Join(dir, "signer.json")
	config.ValidatorHealth = filepath.Join(dir, "validator.json")
	config.SettlementHealth = filepath.Join(dir, "settlement.json")
	snapshot := rec.CertifiedSnapshot{Trust: rec.Trust{ChainID: 420, Timestamp: uint64(now.Unix()) - 100*ct.SlotSeconds, Members: make([]rec.Member, 15)}, Head: ct.Checkpoint{Slot: 100, Root: [32]byte{1}}, Finalized: ct.Checkpoint{Slot: 99, Root: [32]byte{2}}, Anchor: sys.SequenceAnchor{ChainID: 420, ExecutionBlock: 4, BlockHash: [32]byte{3}, LastSequence: 7}}
	engine := &fakeEngine{anchor: snapshot.Anchor}
	c := &Collector{config: config, trust: snapshot.Trust, engine: engine, readSnapshot: func() (rec.CertifiedSnapshot, error) { return snapshot, nil }}
	if err := (sys.FileSequenceStore{Path: filepath.Join(dir, "sequence.json")}).Store(snapshot.Anchor); err != nil {
		t.Fatal(err)
	}
	indexed, err := store.NewFileStore(config.IndexerStore)
	if err != nil {
		t.Fatal(err)
	}
	hash := fmt.Sprintf("0x%x", snapshot.Anchor.BlockHash)
	if err = indexed.PutBundle(model.BlockRecord{ChainID: 420, Number: 4, Hash: hash}, nil, nil, nil); err != nil {
		t.Fatal(err)
	}
	if err = indexed.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: 4, IndexedHash: hash}); err != nil {
		t.Fatal(err)
	}
	report := accounting.Report{Schema: "420-stake-accounting-reconciliation-v1", ChainID: 420, Block: 4, BlockHash: hash, ConsensusRoot: fmt.Sprintf("0x%x", snapshot.Head.Root), Status: "RECONCILED", State: accounting.State{"eligibleValidatorCount": "60"}}
	writeEvidence(t, config.AccountingReport, report, now)
	for component, path := range map[string]string{"signer": config.SignerHealth, "validator": config.ValidatorHealth, "settlement": config.SettlementHealth} {
		writeEvidence(t, path, telemetry.Health{Schema: telemetry.Schema, Component: component, ObservedAt: now, Status: "READY"}, now)
	}
	writeEvidence(t, config.CanarySnapshot, map[string]any{"schema": "420-canary-health-snapshot-v1", "timestamp_utc": now, "safety_halt": false, "conflicting_qc_detected": false, "randomness_degraded": false, "attestation_participation_pct": 66.666, "active_seats": 15, "primary_proposals": 1, "fallback1_proposals": 1, "fallback2_proposals": 0, "peer_count_min": 3, "engine_errors_total": 0, "node420_version": "do-not-export-secret-version"}, now)
	return c, snapshot, engine, now
}
func state(s Snapshot, rule string) string {
	for _, c := range s.Conditions {
		if c.Rule == rule {
			return c.State
		}
	}
	return ""
}
func TestPolicyBoundariesAndParticipationRemainUnchanged(t *testing.T) {
	raw, err := os.ReadFile("../../testnet/public/monitoring/policy.json")
	if err != nil || ValidateBaseline(raw) != nil {
		t.Fatal(err)
	}
	c, snapshot, _, now := collectorFixture(t)
	s := c.Collect(context.Background(), now)
	if s.Validate() != nil || state(s, "eligible_pool_low") != "OK" || state(s, "active_seats_low") != "OK" || s.Metrics["qc_quorum"] != 11 {
		t.Fatal(s)
	}
	c.trust.Timestamp -= 41 * ct.SlotSeconds
	if state(c.Collect(context.Background(), now), "finality_degraded") != "OK" {
		t.Fatal("41 slots alarm")
	}
	c.trust.Timestamp -= ct.SlotSeconds
	if state(c.Collect(context.Background(), now), "finality_degraded") != "FIRING" {
		t.Fatal("42 slots not detected")
	}
	snapshot.Trust.Members = make([]rec.Member, 30)
	c.readSnapshot = func() (rec.CertifiedSnapshot, error) { return snapshot, nil }
	if c.Collect(context.Background(), now).Metrics["qc_quorum"] != 21 {
		t.Fatal("dynamic quorum changed")
	}
	for _, v := range c.Collect(context.Background(), now).Conditions {
		if v.Rule == "participation_low" {
			t.Fatal("invented participation threshold")
		}
	}
}
func TestDivergenceSequencePersistenceAndUnavailableEvidence(t *testing.T) {
	c, snapshot, engine, now := collectorFixture(t)
	engine.anchor.LastSequence++
	if state(c.Collect(context.Background(), now), "gateway_sequence_mismatch") != "FIRING" {
		t.Fatal("sequence mismatch missed")
	}
	engine.err = errors.New("execution canonical checkpoint mismatch secret=not-exported")
	s := c.Collect(context.Background(), now)
	if state(s, "execution_divergence") != "FIRING" {
		t.Fatal(s)
	}
	c.Collect(context.Background(), now)
	if state(c.Collect(context.Background(), now), "engine_errors") != "FIRING" {
		t.Fatal("persistent errors not detected")
	}
	engine.err = nil
	engine.anchor = snapshot.Anchor
	os.WriteFile(filepath.Join(c.config.ConsensusDir, "sequence.json"), []byte("corrupt secret"), 0600)
	if state(c.Collect(context.Background(), now), "sequence_state_unavailable") != "FIRING" {
		t.Fatal("corruption ignored")
	}
	os.Remove(c.config.SignerHealth)
	s = c.Collect(context.Background(), now)
	if state(s, "signing_health_unavailable") != "FIRING" || state(s, "signing_protection_failure") != "UNKNOWN" {
		t.Fatal("unavailable health cleared failure", s)
	}
	writeEvidence(t, c.config.ValidatorHealth, telemetry.Health{Schema: telemetry.Schema, Component: "validator", ObservedAt: now, Status: "PERSISTENCE_FAILURE"}, now)
	if state(c.Collect(context.Background(), now), "persistence_failure") != "FIRING" {
		t.Fatal("persistence failure missed")
	}
	c.readSnapshot = func() (rec.CertifiedSnapshot, error) { return rec.CertifiedSnapshot{}, errors.New("secret RPC error") }
	s = c.Collect(context.Background(), now)
	if state(s, "consensus_evidence_unavailable") != "FIRING" || state(s, "gateway_sequence_mismatch") != "UNKNOWN" {
		t.Fatal("unknown cleared divergent evidence")
	}
}
func TestAccountingBindingFreshnessAndIndexerDiscrepancy(t *testing.T) {
	c, snapshot, _, now := collectorFixture(t)
	var report accounting.Report
	raw, _ := os.ReadFile(c.config.AccountingReport)
	json.Unmarshal(raw, &report)
	report.Status = "DISCREPANCY"
	report.Discrepancies = []accounting.Discrepancy{{Code: "MISSING_INDEXER_EVENT", Actual: "private-credential-never-copy"}}
	report.State["eligibleValidatorCount"] = "59"
	writeEvidence(t, c.config.AccountingReport, report, now)
	s := c.Collect(context.Background(), now)
	if state(s, "accounting_discrepancy") != "FIRING" || state(s, "indexer_reconciliation_discrepancy") != "FIRING" || state(s, "eligible_pool_low") != "FIRING" {
		t.Fatal(s)
	}
	serialized, _ := json.Marshal(s)
	if strings.Contains(string(serialized), "credential") {
		t.Fatal("raw discrepancy exported")
	}
	report.BlockHash = fmt.Sprintf("0x%x", snapshot.Trust.Execution.BlockHash)
	writeEvidence(t, c.config.AccountingReport, report, now)
	s = c.Collect(context.Background(), now)
	if state(s, "accounting_evidence_unavailable") != "FIRING" || state(s, "accounting_discrepancy") != "UNKNOWN" {
		t.Fatal("orphan report trusted")
	}
	s = c.Collect(context.Background(), now.Add(time.Hour))
	if state(s, "canary_evidence_unavailable") != "FIRING" || state(s, "safety_halt") != "UNKNOWN" {
		t.Fatal("stale canary cleared safety halt")
	}
}

func TestCanaryBoundariesMalformedUnknownAndNoRawLabels(t *testing.T) {
	c, _, _, now := collectorFixture(t)
	var raw map[string]any
	b, _ := os.ReadFile(c.config.CanarySnapshot)
	json.Unmarshal(b, &raw)
	raw["active_seats"] = 14
	raw["peer_count_min"] = 2
	raw["safety_halt"] = true
	writeEvidence(t, c.config.CanarySnapshot, raw, now)
	s := c.Collect(context.Background(), now)
	if state(s, "active_seats_low") != "FIRING" || state(s, "peer_count_low") != "FIRING" || state(s, "safety_halt") != "FIRING" {
		t.Fatal(s)
	}
	raw["safety_halt"] = nil
	writeEvidence(t, c.config.CanarySnapshot, raw, now)
	s = c.Collect(context.Background(), now)
	if state(s, "canary_evidence_unavailable") != "FIRING" || state(s, "safety_halt") != "UNKNOWN" {
		t.Fatal("null recovered safety alarm", s)
	}
}
func TestConcurrentSettlementObservationDoesNotPublishFalseMismatch(t *testing.T) {
	c, snapshot, _, now := collectorFixture(t)
	n := 0
	c.readSnapshot = func() (rec.CertifiedSnapshot, error) {
		n++
		v := snapshot
		if n > 1 {
			v.Anchor.LastSequence++
		}
		return v, nil
	}
	s := c.Collect(context.Background(), now)
	if state(s, "consensus_evidence_unavailable") != "FIRING" || state(s, "sequence_state_mismatch") != "UNKNOWN" {
		t.Fatal("mixed-time observations treated as a settled divergence", s)
	}
}

func TestIndexerLagThresholdAndReconciliationSnapshotBinding(t *testing.T) {
	for _, height := range []uint64{0, 1} {
		t.Run(fmt.Sprint(height), func(t *testing.T) {
			c, snapshot, _, now := collectorFixture(t)
			snapshot.Trust.Execution.BlockHash = [32]byte{4}
			snapshot.Canonical = []rec.Record{{Payload: eng.ExecutionPayloadV3{BlockNumber: "0x1", BlockHash: eng.Hash32(fmt.Sprintf("0x%x", [32]byte{5}))}}}
			c.readSnapshot = func() (rec.CertifiedSnapshot, error) { return snapshot, nil }
			c.config.IndexerStore = filepath.Join(t.TempDir(), "rebuilt-index.json")
			index, err := store.NewFileStore(c.config.IndexerStore)
			if err != nil {
				t.Fatal(err)
			}
			hash := fmt.Sprintf("0x%x", [32]byte{4})
			if height == 1 {
				hash = fmt.Sprintf("0x%x", [32]byte{5})
			}
			index.PutBundle(model.BlockRecord{ChainID: 420, Number: height, Hash: hash}, nil, nil, nil)
			index.SaveCheckpoint(model.ChainCheckpoint{ChainID: 420, IndexedHeight: height, IndexedHash: hash})
			s := c.Collect(context.Background(), now)
			want := "FIRING"
			if height == 1 {
				want = "OK"
			}
			if state(s, "explorer_lag") != want {
				t.Fatal("three-block policy changed", s)
			}
			if state(s, "accounting_evidence_unavailable") != "FIRING" || state(s, "indexer_reconciliation_discrepancy") != "FIRING" {
				t.Fatal("old reconciliation report trusted after Indexer changed", s)
			}
		})
	}
}
