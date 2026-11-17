// Package monitoring observes operational evidence. It never changes settlement,
// eligibility, finality, signing protection or accounting authority.
package monitoring

import (
	"encoding/json"
	"errors"
	"fmt"
	"github.com/420integrated/420-integrated/notifications/delivery"
	"math"
	"net"
	"regexp"
	"strings"
	"time"
)

const Schema = "420-stake-monitor-v1"

var token = regexp.MustCompile(`^[a-zA-Z0-9_-]{1,64}$`)
var severities = map[string]string{"finality_degraded": "MAJOR", "safety_halt": "CRITICAL", "conflicting_qc": "CRITICAL", "eligible_pool_low": "MAJOR", "active_seats_low": "CRITICAL", "engine_errors": "MAJOR", "explorer_lag": "WARN", "randomness_degraded": "MAJOR", "peer_count_low": "MAJOR", "consensus_evidence_unavailable": "CRITICAL", "execution_divergence": "CRITICAL", "gateway_sequence_mismatch": "CRITICAL", "sequence_state_unavailable": "CRITICAL", "sequence_state_mismatch": "CRITICAL", "signing_protection_failure": "CRITICAL", "persistence_failure": "CRITICAL", "signing_health_unavailable": "CRITICAL", "settlement_health_unavailable": "MAJOR", "accounting_evidence_unavailable": "MAJOR", "accounting_discrepancy": "CRITICAL", "indexer_reconciliation_discrepancy": "MAJOR", "canary_evidence_unavailable": "MAJOR", "delivery_failure": "MAJOR"}

type Condition struct {
	Rule  string `json:"rule"`
	State string `json:"state"`
}

func (c Condition) Validate() error {
	if severities[c.Rule] == "" || (c.State != "FIRING" && c.State != "OK" && c.State != "UNKNOWN") {
		return errors.New("invalid operational condition")
	}
	return nil
}
func condition(rule string, failed bool) Condition {
	s := "OK"
	if failed {
		s = "FIRING"
	}
	return Condition{rule, s}
}

type Snapshot struct {
	Schema     string             `json:"schema"`
	ObservedAt time.Time          `json:"observedAt"`
	Conditions []Condition        `json:"conditions"`
	Metrics    map[string]float64 `json:"metrics"`
}

var metricNames = map[string]bool{"current_slot": true, "head_slot": true, "finalized_slot": true, "finality_lag_slots": true, "uncertified_slots": true, "active_seats": true, "committee_seats": true, "eligible_validators": true, "attestation_participation_pct": true, "qc_signers": true, "qc_quorum": true, "execution_block": true, "gateway_sequence": true, "consensus_sequence": true, "indexer_height": true, "indexer_lag_blocks": true, "accounting_discrepancies": true, "gross_scheduled_issuance": true, "realized_issuance_accrual": true, "security_accrual": true, "attention_accrual": true, "development_accrual": true, "owned_custody": true, "protocol_credit_custody": true, "protocol_credit_recycled": true, "owned_slashed": true, "owned_withdrawn": true, "primary_proposals": true, "fallback1_proposals": true, "fallback2_proposals": true, "peer_count": true, "engine_errors_total": true}

func (s Snapshot) Validate() error {
	if _, err := s.ObservedAt.MarshalJSON(); err != nil {
		return errors.New("invalid observation time")
	}
	if s.Schema != Schema || s.ObservedAt.IsZero() {
		return errors.New("invalid observation")
	}
	seen := map[string]bool{}
	for _, c := range s.Conditions {
		if err := c.Validate(); err != nil || seen[c.Rule] {
			return errors.New("invalid or duplicated condition")
		}
		seen[c.Rule] = true
	}
	for k, v := range s.Metrics {
		if !metricNames[k] || math.IsNaN(v) || math.IsInf(v, 0) || v < 0 {
			return errors.New("invalid metric")
		}
	}
	return nil
}

type Alarm struct {
	Schema     string    `json:"schema"`
	ID         string    `json:"id"`
	Node       string    `json:"node"`
	Rule       string    `json:"rule"`
	Severity   string    `json:"severity"`
	Transition string    `json:"transition"`
	Episode    uint64    `json:"episode"`
	ObservedAt time.Time `json:"observedAt"`
}
type Destination struct {
	ID         string `json:"id"`
	URL        string `json:"url"`
	BearerFile string `json:"bearerFile,omitempty"`
}
type Config struct {
	Node                  string        `json:"node"`
	StateDir              string        `json:"stateDir"`
	Listen                string        `json:"listen"`
	IntervalSeconds       int           `json:"intervalSeconds"`
	FreshSeconds          int           `json:"freshSeconds"`
	MaxAttempts           int           `json:"maxAttempts"`
	BaseBackoffSeconds    int           `json:"baseBackoffSeconds"`
	MaxBackoffSeconds     int           `json:"maxBackoffSeconds"`
	AllowExternalDelivery bool          `json:"allowExternalDelivery"`
	Destinations          []Destination `json:"destinations"`
	Trust                 string        `json:"trust"`
	TrustSHA256           string        `json:"trustSHA256"`
	ConsensusDir          string        `json:"consensusDir"`
	EngineURL             string        `json:"engineURL"`
	EngineJWTFile         string        `json:"engineJWTFile"`
	IndexerStore          string        `json:"indexerStore"`
	AccountingReport      string        `json:"accountingReport"`
	CanarySnapshot        string        `json:"canarySnapshot"`
	SignerHealth          string        `json:"signerHealth"`
	ValidatorHealth       string        `json:"validatorHealth"`
	SettlementHealth      string        `json:"settlementHealth"`
	BaselinePolicy        string        `json:"baselinePolicy"`
}

func (c Config) RetryPolicy() delivery.Policy {
	return delivery.Policy{MaxAttempts: c.MaxAttempts, BaseBackoff: time.Duration(c.BaseBackoffSeconds) * time.Second, MaxBackoff: time.Duration(c.MaxBackoffSeconds) * time.Second}
}
func (c Config) Validate() error {
	host, port, listenErr := net.SplitHostPort(c.Listen)
	if listenErr != nil || net.ParseIP(host) == nil || port == "" {
		return errors.New("explicit IP telemetry listener required")
	}
	if !token.MatchString(c.Node) || c.StateDir == "" || c.IntervalSeconds < 1 || c.IntervalSeconds > 300 || c.FreshSeconds < 2*c.IntervalSeconds || c.FreshSeconds > 3600 || len(c.Destinations) == 0 || len(c.Destinations) > 16 {
		return errors.New("invalid monitor configuration")
	}
	if err := c.RetryPolicy().Validate(); err != nil || c.MaxAttempts > 100 || c.MaxBackoffSeconds > 86400 || c.MaxBackoffSeconds < 1 || c.BaseBackoffSeconds < 1 || c.BaseBackoffSeconds > c.MaxBackoffSeconds {
		return errors.New("invalid delivery retry policy")
	}
	ids := map[string]bool{}
	for _, d := range c.Destinations {
		if !token.MatchString(d.ID) || ids[strings.ToLower(d.ID)] {
			return errors.New("invalid destination identity")
		}
		ids[strings.ToLower(d.ID)] = true
		if err := validateEndpoint(d.URL, c.AllowExternalDelivery); err != nil {
			return err
		}
	}
	return nil
}
func ValidateBaseline(raw []byte) error {
	var p struct {
		Schema    string
		Alerts    []struct{ Name, Trigger, Severity string }
		Retention map[string]int
	}
	if err := json.Unmarshal(raw, &p); err != nil {
		return errors.New("invalid baseline policy")
	}
	if p.Schema != "420-public-monitoring-v1" {
		return errors.New("unknown baseline policy")
	}
	required := map[string][2]string{"finality_degraded": {"42 consecutive slots without certification", "MAJOR"}, "safety_halt": {"SAFETY_HALT active", "CRITICAL"}, "conflicting_qc": {"any conflicting valid QC", "CRITICAL"}, "eligible_pool_low": {"eligible validators < 60", "MAJOR"}, "active_seats_low": {"active seats < 15", "CRITICAL"}, "engine_errors": {"persistent Engine API errors", "MAJOR"}, "explorer_lag": {"indexing lag > 3 blocks", "WARN"}, "randomness_degraded": {"RANDOMNESS_DEGRADED", "MAJOR"}}
	seen := map[string]bool{}
	for _, a := range p.Alerts {
		if seen[a.Name] {
			return errors.New("duplicate baseline rule")
		}
		seen[a.Name] = true
		if want, ok := required[a.Name]; ok {
			if a.Trigger != want[0] || a.Severity != want[1] {
				return fmt.Errorf("baseline threshold drift: %s", a.Name)
			}
			delete(required, a.Name)
		}
	}
	if len(required) != 0 {
		return errors.New("incomplete baseline policy")
	}
	return nil
}
