package monitoring

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/accounting"
	eng "github.com/420integrated/420-integrated/consensus/engine"
	"github.com/420integrated/420-integrated/consensus/finality"
	rec "github.com/420integrated/420-integrated/consensus/recovery"
	sys "github.com/420integrated/420-integrated/consensus/systemcall"
	"github.com/420integrated/420-integrated/consensus/telemetry"
	ct "github.com/420integrated/420-integrated/consensus/types"
	"github.com/420integrated/420-integrated/indexer/store"
	"math"
	"math/big"
	"math/bits"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type Engine interface {
	CanonicalSequenceAnchor(context.Context, uint64, uint64, [32]byte) (sys.SequenceAnchor, error)
}
type Collector struct {
	config         Config
	trust          rec.Trust
	engine         Engine
	readSnapshot   func() (rec.CertifiedSnapshot, error)
	engineFailures int
}

func NewCollector(c Config) (*Collector, error) {
	baseline, err := os.ReadFile(c.BaselinePolicy)
	if err != nil || ValidateBaseline(baseline) != nil {
		return nil, errors.New("monitoring baseline unavailable or changed")
	}
	raw, err := os.ReadFile(c.Trust)
	if err != nil {
		return nil, errors.New("consensus trust unavailable")
	}
	sum := sha256.Sum256(raw)
	if hex.EncodeToString(sum[:]) != c.TrustSHA256 {
		return nil, errors.New("consensus trust pin mismatch")
	}
	var trust rec.Trust
	if rec.Decode(raw, &trust) != nil {
		return nil, errors.New("invalid consensus trust")
	}
	secret, err := eng.LoadJWTSecret(c.EngineJWTFile)
	if err != nil {
		return nil, errors.New("Engine credential unavailable")
	}
	client, err := eng.NewClient(c.EngineURL, secret)
	if err != nil {
		return nil, errors.New("Engine configuration invalid")
	}
	return &Collector{config: c, trust: trust, engine: client, readSnapshot: func() (rec.CertifiedSnapshot, error) { return rec.ReadCertifiedSnapshot(trust, c.ConsensusDir) }}, nil
}
func freshFile(path string, now time.Time, age time.Duration, dst any) error {
	info, err := os.Stat(path)
	if err != nil || !info.Mode().IsRegular() || now.Sub(info.ModTime()) > age || info.ModTime().After(now.Add(5*time.Second)) || info.Size() > 32<<20 {
		return errors.New("operational evidence unavailable")
	}
	raw, err := os.ReadFile(path)
	if err != nil {
		return errors.New("operational evidence unavailable")
	}
	if err = rec.Decode(raw, dst); err != nil {
		return errors.New("operational evidence invalid")
	}
	return nil
}
func (c *Collector) Collect(ctx context.Context, now time.Time) Snapshot {
	s := Snapshot{Schema: Schema, ObservedAt: now, Metrics: map[string]float64{}, Conditions: []Condition{}}
	conditions := map[string]string{}
	for rule := range severities {
		conditions[rule] = "UNKNOWN"
	}
	set := func(rule string, b bool) { conditions[rule] = condition(rule, b).State }
	m := func(k string, v uint64) { s.Metrics[k] = float64(v) }
	age := time.Duration(c.config.FreshSeconds) * time.Second
	snapshot, err := c.readSnapshot()
	set("consensus_evidence_unavailable", err != nil)
	if err == nil {
		head := snapshot.Head.Slot
		current := head
		if now.Unix() >= 0 && uint64(now.Unix()) >= c.trust.Timestamp {
			current = (uint64(now.Unix()) - c.trust.Timestamp) / ct.SlotSeconds
		} else {
			set("consensus_evidence_unavailable", true)
		}
		if current < head {
			set("consensus_evidence_unavailable", true)
		} else {
			m("current_slot", current)
			m("uncertified_slots", current-head)
			set("finality_degraded", current-head >= 42)
		}
		m("head_slot", head)
		m("finalized_slot", snapshot.Finalized.Slot)
		m("finality_lag_slots", head-snapshot.Finalized.Slot)
		m("committee_seats", uint64(len(snapshot.Trust.Members)))
		m("qc_quorum", uint64(finality.QuorumThreshold(len(snapshot.Trust.Members))))
		m("execution_block", snapshot.Anchor.ExecutionBlock)
		m("consensus_sequence", snapshot.Anchor.LastSequence)
		if len(snapshot.Canonical) > 0 {
			qc := snapshot.Canonical[len(snapshot.Canonical)-1].Certificate
			count := 0
			for _, b := range qc.SignerBitmap {
				count += bits.OnesCount8(b)
			}
			m("qc_signers", uint64(count))
		}
		anchor, engineErr := c.engine.CanonicalSequenceAnchor(ctx, 420, snapshot.Anchor.ExecutionBlock, snapshot.Anchor.BlockHash)
		if engineErr != nil {
			c.engineFailures++
			msg := engineErr.Error()
			if strings.Contains(msg, "chain mismatch") || strings.Contains(msg, "canonical checkpoint mismatch") || strings.Contains(msg, "gateway sequence") {
				set("execution_divergence", true)
			}
		} else {
			c.engineFailures = 0
			set("execution_divergence", false)
			set("gateway_sequence_mismatch", anchor.LastSequence != snapshot.Anchor.LastSequence)
			m("gateway_sequence", anchor.LastSequence)
		}
		if engineErr == nil {
			set("engine_errors", false)
		} else if c.engineFailures >= 3 {
			set("engine_errors", true)
		}
		journal, exists, journalErr := (sys.FileSequenceStore{Path: filepath.Join(c.config.ConsensusDir, "sequence.json")}).Load()
		set("sequence_state_unavailable", journalErr != nil || !exists)
		if journalErr == nil && exists {
			set("sequence_state_mismatch", journal != snapshot.Anchor)
		}
		indexAtHead := false
		indexed, indexErr := store.NewFileStore(c.config.IndexerStore)
		if indexErr == nil {
			cp, exists, e := indexed.Checkpoint()
			if e == nil && exists {
				indexAtHead = cp.IndexedHeight == snapshot.Anchor.ExecutionBlock && strings.EqualFold(cp.IndexedHash, fmt.Sprintf("0x%x", snapshot.Anchor.BlockHash))
				m("indexer_height", cp.IndexedHeight)
				lag := uint64(0)
				if snapshot.Anchor.ExecutionBlock >= cp.IndexedHeight {
					lag = snapshot.Anchor.ExecutionBlock - cp.IndexedHeight
				}
				m("indexer_lag_blocks", lag)
				set("explorer_lag", lag > 3)
				known := map[uint64]string{snapshot.Trust.Execution.ExecutionBlock: fmt.Sprintf("0x%x", snapshot.Trust.Execution.BlockHash)}
				for _, r := range snapshot.Canonical {
					n, _ := strconv.ParseUint(strings.TrimPrefix(r.Payload.BlockNumber, "0x"), 16, 64)
					known[n] = string(r.Payload.BlockHash)
				}
				known[snapshot.Anchor.ExecutionBlock] = fmt.Sprintf("0x%x", snapshot.Anchor.BlockHash)
				bad := cp.ChainID != 420 || cp.IndexedHeight > snapshot.Anchor.ExecutionBlock || !strings.EqualFold(known[cp.IndexedHeight], cp.IndexedHash)
				if cp.IndexedHeight == snapshot.Anchor.ExecutionBlock {
					bad = bad || !strings.EqualFold(cp.IndexedHash, fmt.Sprintf("0x%x", snapshot.Anchor.BlockHash))
				}
				set("indexer_reconciliation_discrepancy", bad)
			} else {
				indexErr = errors.New("missing index checkpoint")
			}
		}
		if indexErr != nil {
			set("indexer_reconciliation_discrepancy", true)
		}
		var report accounting.Report
		reportErr := freshFile(c.config.AccountingReport, now, age, &report)
		if reportErr == nil && (report.Schema != "420-stake-accounting-reconciliation-v1" || report.ChainID != 420 || report.CanonicalAuthority || report.Block != snapshot.Anchor.ExecutionBlock || report.BlockHash != fmt.Sprintf("0x%x", snapshot.Anchor.BlockHash) || report.ConsensusRoot != fmt.Sprintf("0x%x", snapshot.Head.Root) || (report.Status != "RECONCILED" && report.Status != "DISCREPANCY")) {
			reportErr = errors.New("unbound accounting report")
		}
		if reportErr == nil && report.Status == "RECONCILED" && !indexAtHead {
			reportErr = errors.New("accounting Indexer observation changed")
			set("indexer_reconciliation_discrepancy", true)
		}
		set("accounting_evidence_unavailable", reportErr != nil)
		if (reportErr != nil || report.Status != "RECONCILED") && conditions["indexer_reconciliation_discrepancy"] == "OK" {
			conditions["indexer_reconciliation_discrepancy"] = "UNKNOWN"
		}
		if reportErr == nil {
			set("accounting_discrepancy", report.Status != "RECONCILED" || len(report.Discrepancies) > 0)
			m("accounting_discrepancies", uint64(len(report.Discrepancies)))
			indexBad := false
			for _, d := range report.Discrepancies {
				if strings.Contains(d.Code, "INDEXER") {
					indexBad = true
				}
			}
			if indexBad {
				set("indexer_reconciliation_discrepancy", true)
			}
			for key, value := range map[string]string{"gross_scheduled_issuance": report.Issuance.GrossScheduled, "realized_issuance_accrual": report.Issuance.Realized, "security_accrual": report.Issuance.Security, "attention_accrual": report.Issuance.Attention, "development_accrual": report.Issuance.Development, "owned_custody": report.State["totalOwnedCustody"], "protocol_credit_custody": report.State["totalProtocolCreditCustody"], "protocol_credit_recycled": report.State["totalProtocolCreditRecycled"], "owned_slashed": report.State["totalOwnedSlashed"], "owned_withdrawn": report.State["totalOwnedWithdrawn"]} {
				if n, ok := new(big.Int).SetString(value, 10); ok && n.Sign() >= 0 && n.BitLen() <= 256 {
					v, _ := new(big.Float).Quo(new(big.Float).SetInt(n), big.NewFloat(1e18)).Float64()
					s.Metrics[key] = v
				}
			}
			if value, ok := report.State["eligibleValidatorCount"]; ok {
				if n, ok := new(big.Int).SetString(value, 10); ok && n.IsUint64() {
					m("eligible_validators", n.Uint64())
					set("eligible_pool_low", n.Uint64() < 60)
				}
			}
		}
	}
	if err == nil {
		after, againErr := c.readSnapshot()
		if againErr != nil || after.Head != snapshot.Head || after.Finalized != snapshot.Finalized || after.Anchor != snapshot.Anchor {
			conditions["consensus_evidence_unavailable"] = "FIRING"
			for _, rule := range []string{"execution_divergence", "gateway_sequence_mismatch", "sequence_state_unavailable", "sequence_state_mismatch", "accounting_evidence_unavailable", "accounting_discrepancy", "indexer_reconciliation_discrepancy", "eligible_pool_low", "explorer_lag"} {
				conditions[rule] = "UNKNOWN"
			}
		}
	}
	// Runtime health contains only a closed categorical vocabulary and timestamps.
	persistence := false
	signFailure := false
	signUnknown := false
	settlementUnknown := false
	allHealthValid := true
	allSigningValid := true
	for component, path := range map[string]string{"signer": c.config.SignerHealth, "validator": c.config.ValidatorHealth, "settlement": c.config.SettlementHealth} {
		var h telemetry.Health
		e := freshFile(path, now, age, &h)
		valid := e == nil && h.Validate() == nil && h.Component == component && !h.ObservedAt.After(now.Add(5*time.Second)) && now.Sub(h.ObservedAt) <= age
		allHealthValid = allHealthValid && valid
		if component != "settlement" {
			allSigningValid = allSigningValid && valid
		}
		if component == "settlement" {
			settlementUnknown = !valid || h.Status != "READY"
		} else {
			signUnknown = signUnknown || !valid || h.Status == "STARTING" || h.Status == "STOPPED"
		}
		if valid {
			persistence = persistence || h.Status == "PERSISTENCE_FAILURE"
			signFailure = signFailure || h.Status == "SIGNING_PROTECTION_FAILURE"
		}
	}
	allReady := allHealthValid && !signUnknown && !settlementUnknown && !signFailure && !persistence
	if persistence || allReady {
		set("persistence_failure", persistence)
	}
	if signFailure || (allSigningValid && !signUnknown && !persistence) {
		set("signing_protection_failure", signFailure)
	}
	set("signing_health_unavailable", signUnknown)
	set("settlement_health_unavailable", settlementUnknown)
	c.canary(&s, conditions, now, age)
	for rule, state := range conditions {
		s.Conditions = append(s.Conditions, Condition{rule, state})
	}
	sortConditions(s.Conditions)
	return s
}
func sortConditions(v []Condition) {
	for i := 1; i < len(v); i++ {
		for j := i; j > 0 && v[j].Rule < v[j-1].Rule; j-- {
			v[j], v[j-1] = v[j-1], v[j]
		}
	}
}
func (c *Collector) canary(s *Snapshot, conditions map[string]string, now time.Time, age time.Duration) {
	var raw map[string]json.RawMessage
	if freshFile(c.config.CanarySnapshot, now, age, &raw) != nil {
		conditions["canary_evidence_unavailable"] = "FIRING"
		return
	}
	var schema, status string
	var at time.Time
	json.Unmarshal(raw["schema"], &schema)
	json.Unmarshal(raw["status"], &status)
	json.Unmarshal(raw["timestamp_utc"], &at)
	if schema != "420-canary-health-snapshot-v1" || status == "TEMPLATE" || at.IsZero() || now.Sub(at) > age || at.After(now.Add(5*time.Second)) {
		conditions["canary_evidence_unavailable"] = "FIRING"
		return
	}
	stagedConditions := map[string]string{}
	stagedMetrics := map[string]float64{}
	invalid := func() { conditions["canary_evidence_unavailable"] = "FIRING" }
	for key, rule := range map[string]string{"safety_halt": "safety_halt", "conflicting_qc_detected": "conflicting_qc", "randomness_degraded": "randomness_degraded"} {
		var b bool
		if string(raw[key]) != "true" && string(raw[key]) != "false" {
			invalid()
			return
		}
		if json.Unmarshal(raw[key], &b) != nil {
			invalid()
			return
		}
		stagedConditions[rule] = condition(rule, b).State
	}
	for key, name := range map[string]string{"active_seats": "active_seats", "attestation_participation_pct": "attestation_participation_pct", "primary_proposals": "primary_proposals", "fallback1_proposals": "fallback1_proposals", "fallback2_proposals": "fallback2_proposals", "peer_count_min": "peer_count", "engine_errors_total": "engine_errors_total"} {
		var value float64
		if len(raw[key]) == 0 || string(raw[key]) == "null" || json.Unmarshal(raw[key], &value) != nil || value < 0 || (key == "attestation_participation_pct" && value > 100) || (key != "attestation_participation_pct" && math.Trunc(value) != value) || (key == "active_seats" && value > 30) {
			invalid()
			return
		}
		stagedMetrics[name] = value
		if key == "peer_count_min" {
			stagedConditions["peer_count_low"] = condition("peer_count_low", value < 3).State
		}
		if key == "active_seats" {
			stagedConditions["active_seats_low"] = condition("active_seats_low", value < 15).State
		}
	}
	conditions["canary_evidence_unavailable"] = "OK"
	for k, v := range stagedConditions {
		conditions[k] = v
	}
	for k, v := range stagedMetrics {
		s.Metrics[k] = v
	}
}
