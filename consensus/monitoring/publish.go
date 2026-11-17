package monitoring

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/420integrated/420-integrated/consensus/accounting"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/consensus/telemetry"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/store"
	"math/big"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// PublishPublicInputs is run by each source owner. It exports only approved
// public projections into a separate directory, not whole private directories.
// The unprivileged monitor then needs neither a signer key nor journal access.
func PublishPublicInputs(c Config, destination, component string, now time.Time) error {
	if destination == "" {
		return errors.New("PUBLIC_VIEW_DESTINATION_REQUIRED")
	}
	type view struct {
		path     string
		data     []byte
		modified time.Time
	}
	views := []view{}
	add := func(source, target string, object any) error {
		info, err := os.Stat(source)
		if err != nil || !info.Mode().IsRegular() {
			return errors.New("PUBLIC_VIEW_SOURCE_UNAVAILABLE")
		}
		raw, err := json.Marshal(object)
		if err != nil {
			return errors.New("PUBLIC_VIEW_INVALID")
		}
		views = append(views, view{target, append(raw, '\n'), info.ModTime()})
		return nil
	}
	read := func(path string, v any) error {
		raw, err := os.ReadFile(path)
		if err != nil || len(raw) > 64<<20 || rec.Decode(raw, v) != nil {
			return errors.New("PUBLIC_VIEW_SOURCE_INVALID")
		}
		return nil
	}
	switch component {
	case "consensus":
		raw, err := os.ReadFile(c.Trust)
		if err != nil {
			return errors.New("PUBLIC_TRUST_UNAVAILABLE")
		}
		sum := sha256.Sum256(raw)
		if hex.EncodeToString(sum[:]) != c.TrustSHA256 {
			return errors.New("PUBLIC_TRUST_PIN_MISMATCH")
		}
		var trust rec.Trust
		if rec.Decode(raw, &trust) != nil {
			return errors.New("PUBLIC_TRUST_INVALID")
		}
		snapshot, err := rec.ReadCertifiedSnapshot(trust, c.ConsensusDir)
		if err != nil {
			return errors.New("PUBLIC_CERTIFIED_HISTORY_UNAVAILABLE")
		}
		anchor, exists, err := (sys.FileSequenceStore{Path: filepath.Join(c.ConsensusDir, "sequence.json")}).Load()
		if err != nil || !exists || anchor != snapshot.Anchor {
			return errors.New("PUBLIC_SEQUENCE_RECONCILIATION_REQUIRED")
		}
		if err = add(c.Trust, "consensus/trust.json", trust); err != nil {
			return err
		}
		// Preserve the original trust bytes because the operator pins that exact file.
		views[len(views)-1].data = raw
		for _, name := range []string{"history.json", "checkpoint.json", "sequence.json"} {
			source := filepath.Join(c.ConsensusDir, name)
			var object map[string]json.RawMessage
			if err = read(source, &object); err != nil {
				return err
			}
			if err = add(source, "consensus/settlement/"+name, object); err != nil {
				return err
			}
		}
		again, err := rec.ReadCertifiedSnapshot(trust, c.ConsensusDir)
		if err != nil || again.Head != snapshot.Head || again.Finalized != snapshot.Finalized || again.Anchor != snapshot.Anchor {
			return errors.New("PUBLIC_CONSENSUS_INPUT_CHANGED")
		}
	case "indexer":
		source, err := store.NewFileStore(c.IndexerStore)
		if err != nil {
			return errors.New("PUBLIC_INDEXER_UNAVAILABLE")
		}
		cp, exists, err := source.Checkpoint()
		if err != nil || !exists {
			return errors.New("PUBLIC_INDEXER_CHECKPOINT_UNAVAILABLE")
		}
		for _, hash := range []string{cp.IndexedHash, cp.FinalizedHash, cp.SafeHash} {
			if hash != "" {
				if _, err = ct.ParseRoot(hash); err != nil {
					return errors.New("PUBLIC_INDEXER_CHECKPOINT_HASH_INVALID")
				}
			}
		}
		cp.SchemaVersion = "420-indexer-v1"
		blocks := map[uint64]model.BlockRecord{}
		for _, n := range []uint64{cp.IndexedHeight, cp.FinalizedHeight, cp.SafeHeight} {
			b, exists, err := source.Block(n)
			if err != nil {
				return errors.New("PUBLIC_INDEXER_BLOCK_UNAVAILABLE")
			}
			if !exists {
				continue
			}
			if _, err = ct.ParseRoot(b.Hash); err != nil {
				return errors.New("PUBLIC_INDEXER_HASH_INVALID")
			}
			parent := b.ParentHash
			if parent != "" {
				if _, err = ct.ParseRoot(parent); err != nil {
					return errors.New("PUBLIC_INDEXER_PARENT_INVALID")
				}
			}
			blocks[n] = model.BlockRecord{ChainID: b.ChainID, Number: b.Number, Hash: b.Hash, ParentHash: parent, Timestamp: b.Timestamp, SchemaVersion: "420-indexer-v1"}
		}
		object := struct {
			Version    uint64                       `json:"version"`
			Checkpoint model.ChainCheckpoint        `json:"checkpoint"`
			Blocks     map[uint64]model.BlockRecord `json:"blocks"`
		}{1, cp, blocks}
		if err = add(c.IndexerStore, "indexer/index.json", object); err != nil {
			return err
		}
	case "accounting":
		var r accounting.Report
		if err := read(c.AccountingReport, &r); err != nil {
			return err
		}
		if r.Schema != "420-stake-accounting-reconciliation-v1" || r.CanonicalAuthority || r.ChainID != 420 || (r.Status != "RECONCILED" && r.Status != "DISCREPANCY") {
			return errors.New("PUBLIC_ACCOUNTING_REPORT_INVALID")
		}
		for _, h := range []string{r.BlockHash, r.ConsensusRoot, r.FinalizedRoot} {
			if _, err := ct.ParseRoot(h); err != nil {
				return errors.New("PUBLIC_ACCOUNTING_ANCHOR_INVALID")
			}
		}
		exact := func(value string) string {
			n, ok := new(big.Int).SetString(value, 10)
			if !ok || n.Sign() < 0 || n.BitLen() > 256 {
				return ""
			}
			return n.String()
		}
		state := accounting.State{}
		for _, key := range []string{"eligibleValidatorCount", "totalOwnedCustody", "totalProtocolCreditCustody", "totalProtocolCreditRecycled", "totalOwnedSlashed", "totalOwnedWithdrawn"} {
			if v := exact(r.State[key]); v != "" {
				state[key] = v
			}
		}
		r.State = state
		r.Issuance = accounting.Issuance{GrossScheduled: exact(r.Issuance.GrossScheduled), Realized: exact(r.Issuance.Realized), NonIssued: exact(r.Issuance.NonIssued), Security: exact(r.Issuance.Security), Attention: exact(r.Issuance.Attention), Development: exact(r.Issuance.Development), Basis: "RewardController accrual accounting; not native minting proof"}
		for i, d := range r.Discrepancies {
			code := "ACCOUNTING_DISCREPANCY"
			if strings.Contains(d.Code, "INDEXER") {
				code = "INDEXER_DISCREPANCY"
			}
			r.Discrepancies[i] = accounting.Discrepancy{Code: code, Block: d.Block}
		}
		if err := add(c.AccountingReport, "accounting/report.json", r); err != nil {
			return err
		}
	case "canary":
		snapshot := Snapshot{Metrics: map[string]float64{}}
		conditions := map[string]string{}
		collector := &Collector{config: c}
		collector.canary(&snapshot, conditions, now, time.Duration(c.FreshSeconds)*time.Second)
		if conditions["canary_evidence_unavailable"] != "OK" {
			return errors.New("PUBLIC_CANARY_UNAVAILABLE")
		}
		var input struct {
			Timestamp time.Time `json:"timestamp_utc"`
		}
		raw, err := os.ReadFile(c.CanarySnapshot)
		if err != nil || json.Unmarshal(raw, &input) != nil {
			return errors.New("PUBLIC_CANARY_INVALID")
		}
		out := map[string]any{"schema": "420-canary-health-snapshot-v1", "timestamp_utc": input.Timestamp, "status": "OBSERVED"}
		for key, metric := range map[string]string{"active_seats": "active_seats", "attestation_participation_pct": "attestation_participation_pct", "primary_proposals": "primary_proposals", "fallback1_proposals": "fallback1_proposals", "fallback2_proposals": "fallback2_proposals", "peer_count_min": "peer_count", "engine_errors_total": "engine_errors_total"} {
			out[key] = snapshot.Metrics[metric]
		}
		for key, rule := range map[string]string{"safety_halt": "safety_halt", "conflicting_qc_detected": "conflicting_qc", "randomness_degraded": "randomness_degraded"} {
			out[key] = conditions[rule] == "FIRING"
		}
		if err = add(c.CanarySnapshot, "canary/snapshot.json", out); err != nil {
			return err
		}
	case "signer-health", "validator-health", "settlement-health":
		role := strings.TrimSuffix(component, "-health")
		source := map[string]string{"signer": c.SignerHealth, "validator": c.ValidatorHealth, "settlement": c.SettlementHealth}[role]
		var h telemetry.Health
		if err := read(source, &h); err != nil {
			return err
		}
		if h.Validate() != nil || h.Component != role {
			return errors.New("PUBLIC_RUNTIME_HEALTH_INVALID")
		}
		if err := add(source, "health/"+role+"/"+role+".json", h); err != nil {
			return err
		}
	default:
		return errors.New("UNKNOWN_PUBLIC_VIEW_COMPONENT")
	}
	for _, v := range views {
		path := filepath.Join(destination, v.path)
		if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
			return errors.New("PUBLIC_VIEW_PERSISTENCE_FAILURE")
		}
		if err := telemetry.AtomicPublicSnapshot(path, v.data, v.modified); err != nil {
			return errors.New("PUBLIC_VIEW_PERSISTENCE_FAILURE")
		}
	}
	return nil
}
