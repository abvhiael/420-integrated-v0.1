package storage

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"sort"
	"strings"
	"time"
)

var ErrProductionTestnetEvidence = errors.New("production testnet evidence failure")

const ProductionTestnetEvidenceSchema = "storage-testnet-evidence-v1"

type ProductionTestnetCheck struct {
	Name     string `json:"name"`
	Passed   bool   `json:"passed"`
	Evidence string `json:"evidence"`
}

type ProductionTestnetFaultDrill struct {
	Name             string        `json:"name"`
	Recovered        bool          `json:"recovered"`
	RecoveryDuration time.Duration `json:"recovery_duration"`
	Evidence         string        `json:"evidence"`
}

type ProductionLaunchBlocker struct {
	Code     string `json:"code"`
	Critical bool   `json:"critical"`
	Resolved bool   `json:"resolved"`
	Evidence string `json:"evidence"`
}

type ProductionTestnetEvidence struct {
	SchemaVersion       string                        `json:"schema_version"`
	CapturedAt          time.Time                     `json:"captured_at"`
	CommitSHA           string                        `json:"commit_sha"`
	ConfigFingerprint   string                        `json:"config_fingerprint"`
	TopologyFingerprint string                        `json:"topology_fingerprint"`
	APIVersion          string                        `json:"api_version"`
	TopologySchema      string                        `json:"topology_schema"`
	Checks              []ProductionTestnetCheck      `json:"checks"`
	FaultDrills         []ProductionTestnetFaultDrill `json:"fault_drills"`
	SLO                 ProductionSLOEvidence         `json:"slo"`
	LaunchBlockers      []ProductionLaunchBlocker     `json:"launch_blockers"`
	Fingerprint         string                        `json:"fingerprint"`
}

var requiredProductionTestnetChecks = []string{
	"upload",
	"manifest",
	"verified_retrieval",
	"cache_route",
	"gateway_route",
	"repair_reconstruction",
}

var requiredProductionFaultDrills = []string{
	"provider_loss_recovery",
	"discovery_degradation_recovery",
	"credential_revocation_recovery",
}

func BuildProductionTestnetEvidence(e ProductionTestnetEvidence) (ProductionTestnetEvidence, error) {
	e.SchemaVersion = ProductionTestnetEvidenceSchema
	e.CommitSHA = strings.ToLower(strings.TrimSpace(e.CommitSHA))
	e.ConfigFingerprint = strings.ToLower(strings.TrimSpace(e.ConfigFingerprint))
	e.TopologyFingerprint = strings.ToLower(strings.TrimSpace(e.TopologyFingerprint))
	e.APIVersion = strings.TrimSpace(e.APIVersion)
	e.TopologySchema = strings.TrimSpace(e.TopologySchema)
	if e.CapturedAt.IsZero() || !validProductionEvidenceDigest(e.CommitSHA) || !validProductionEvidenceDigest(e.ConfigFingerprint) || !validProductionEvidenceDigest(e.TopologyFingerprint) || e.APIVersion != DeveloperAPIVersion || e.TopologySchema != ProductionConfigSchemaVersion || !e.SLO.Met {
		return ProductionTestnetEvidence{}, ErrProductionTestnetEvidence
	}
	checks, err := normalizeProductionTestnetChecks(e.Checks)
	if err != nil {
		return ProductionTestnetEvidence{}, err
	}
	drills, err := normalizeProductionFaultDrills(e.FaultDrills)
	if err != nil {
		return ProductionTestnetEvidence{}, err
	}
	blockers, err := normalizeProductionLaunchBlockers(e.LaunchBlockers)
	if err != nil {
		return ProductionTestnetEvidence{}, err
	}
	e.Checks, e.FaultDrills, e.LaunchBlockers = checks, drills, blockers
	e.Fingerprint = productionTestnetEvidenceFingerprint(e)
	return e, nil
}

func ValidateProductionTestnetEvidence(e ProductionTestnetEvidence, expectedCommitSHA, expectedConfigFingerprint, expectedTopologyFingerprint string) error {
	normalized, err := BuildProductionTestnetEvidence(e)
	if err != nil {
		return err
	}
	if !strings.EqualFold(normalized.CommitSHA, strings.TrimSpace(expectedCommitSHA)) || !strings.EqualFold(normalized.ConfigFingerprint, strings.TrimSpace(expectedConfigFingerprint)) || !strings.EqualFold(normalized.TopologyFingerprint, strings.TrimSpace(expectedTopologyFingerprint)) {
		return ErrProductionTestnetEvidence
	}
	if strings.TrimSpace(e.Fingerprint) == "" || !strings.EqualFold(normalized.Fingerprint, strings.TrimSpace(e.Fingerprint)) {
		return ErrProductionTestnetEvidence
	}
	return nil
}

func normalizeProductionTestnetChecks(in []ProductionTestnetCheck) ([]ProductionTestnetCheck, error) {
	byName := make(map[string]ProductionTestnetCheck, len(in))
	for _, check := range in {
		check.Name = strings.ToLower(strings.TrimSpace(check.Name))
		check.Evidence = strings.TrimSpace(check.Evidence)
		if check.Name == "" || check.Evidence == "" || !check.Passed {
			return nil, ErrProductionTestnetEvidence
		}
		if _, exists := byName[check.Name]; exists {
			return nil, ErrProductionTestnetEvidence
		}
		byName[check.Name] = check
	}
	out := make([]ProductionTestnetCheck, 0, len(requiredProductionTestnetChecks))
	for _, name := range requiredProductionTestnetChecks {
		check, ok := byName[name]
		if !ok {
			return nil, ErrProductionTestnetEvidence
		}
		out = append(out, check)
	}
	return out, nil
}

func normalizeProductionFaultDrills(in []ProductionTestnetFaultDrill) ([]ProductionTestnetFaultDrill, error) {
	byName := make(map[string]ProductionTestnetFaultDrill, len(in))
	for _, drill := range in {
		drill.Name = strings.ToLower(strings.TrimSpace(drill.Name))
		drill.Evidence = strings.TrimSpace(drill.Evidence)
		if drill.Name == "" || drill.Evidence == "" || !drill.Recovered || drill.RecoveryDuration < 0 {
			return nil, ErrProductionTestnetEvidence
		}
		if _, exists := byName[drill.Name]; exists {
			return nil, ErrProductionTestnetEvidence
		}
		byName[drill.Name] = drill
	}
	out := make([]ProductionTestnetFaultDrill, 0, len(requiredProductionFaultDrills))
	for _, name := range requiredProductionFaultDrills {
		drill, ok := byName[name]
		if !ok {
			return nil, ErrProductionTestnetEvidence
		}
		out = append(out, drill)
	}
	return out, nil
}

func normalizeProductionLaunchBlockers(in []ProductionLaunchBlocker) ([]ProductionLaunchBlocker, error) {
	out := append([]ProductionLaunchBlocker(nil), in...)
	for i := range out {
		out[i].Code = strings.ToLower(strings.TrimSpace(out[i].Code))
		out[i].Evidence = strings.TrimSpace(out[i].Evidence)
		if out[i].Code == "" || out[i].Evidence == "" || (out[i].Critical && !out[i].Resolved) {
			return nil, ErrProductionTestnetEvidence
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Code < out[j].Code })
	return out, nil
}

func productionTestnetEvidenceFingerprint(e ProductionTestnetEvidence) string {
	parts := []string{e.SchemaVersion, e.CapturedAt.UTC().Format(time.RFC3339Nano), e.CommitSHA, e.ConfigFingerprint, e.TopologyFingerprint, e.APIVersion, e.TopologySchema}
	for _, check := range e.Checks {
		parts = append(parts, "check", check.Name, check.Evidence)
	}
	for _, drill := range e.FaultDrills {
		parts = append(parts, "drill", drill.Name, drill.RecoveryDuration.String(), drill.Evidence)
	}
	parts = append(parts,
		"slo",
		uintString(e.SLO.AvailabilityBasisPoints),
		uintString(e.SLO.IntegrityBasisPoints),
		e.SLO.RecoveryDuration.String(),
	)
	for _, blocker := range e.LaunchBlockers {
		parts = append(parts, "blocker", blocker.Code, boolString(blocker.Critical), boolString(blocker.Resolved), blocker.Evidence)
	}
	sum := sha256.Sum256([]byte(strings.Join(parts, "\n")))
	return hex.EncodeToString(sum[:])
}

func validProductionEvidenceDigest(value string) bool {
	value = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "0x")
	if len(value) != 40 && len(value) != 64 {
		return false
	}
	_, err := hex.DecodeString(value)
	return err == nil
}

func uintString(v uint64) string {
	const digits = "0123456789"
	if v == 0 {
		return "0"
	}
	buf := make([]byte, 0, 20)
	for v > 0 {
		buf = append(buf, digits[v%10])
		v /= 10
	}
	for i, j := 0, len(buf)-1; i < j; i, j = i+1, j-1 {
		buf[i], buf[j] = buf[j], buf[i]
	}
	return string(buf)
}

func boolString(v bool) string {
	if v {
		return "true"
	}
	return "false"
}
