package metrics

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/model"
)

const (
	MetricValidatorCount       = "validator.registered_count"
	MetricActiveValidatorCount = "validator.active_count"
	MetricNativeCollateral     = "validator.native_collateral"
	MetricCommunityCollateral  = "validator.community_collateral"
	MetricAccruedRewards       = "validator.accrued_rewards"
)

type ValidatorLifecycle string

const (
	ValidatorRegistered ValidatorLifecycle = "registered"
	ValidatorActive     ValidatorLifecycle = "active"
	ValidatorExiting    ValidatorLifecycle = "exiting"
	ValidatorCooldown   ValidatorLifecycle = "cooldown"
)

// ValidatorProjection is a normalized, public 420Indexer-derived validator view.
// It is deliberately not a canonical staking object and carries no delegation or
// governance weight fields at Genesis.
type ValidatorProjection struct {
	Validator           string
	Lifecycle           ValidatorLifecycle
	NativeCollateral    uint64
	CommunityCollateral uint64
	AccruedRewards      uint64
}

type ValidatorInput struct {
	Source     string
	Validators []ValidatorProjection
}

func BuildValidatorMetrics(input ValidatorInput, provenance model.Provenance) ([]model.Metric, error) {
	if input.Source != string(architecture.SourceIndexer) || provenance.Source != string(architecture.SourceIndexer) {
		return nil, errors.New("validator analytics require qualified 420Indexer provenance")
	}
	if len(input.Validators) == 0 {
		return nil, errors.New("validator analytics require at least one indexed validator projection")
	}

	seen := map[string]struct{}{}
	var registered, active, native, community, rewards uint64
	for i, validator := range input.Validators {
		address := strings.ToLower(strings.TrimSpace(validator.Validator))
		if address == "" {
			return nil, fmt.Errorf("validator %d address required", i)
		}
		if _, exists := seen[address]; exists {
			return nil, fmt.Errorf("duplicate validator projection: %s", address)
		}
		seen[address] = struct{}{}
		if !validValidatorLifecycle(validator.Lifecycle) {
			return nil, fmt.Errorf("validator %s lifecycle unsupported", address)
		}
		registered++
		if validator.Lifecycle == ValidatorActive {
			active++
		}
		var overflow bool
		if native, overflow = addUint64(native, validator.NativeCollateral); overflow {
			return nil, errors.New("native validator collateral overflow")
		}
		if community, overflow = addUint64(community, validator.CommunityCollateral); overflow {
			return nil, errors.New("community validator collateral overflow")
		}
		if rewards, overflow = addUint64(rewards, validator.AccruedRewards); overflow {
			return nil, errors.New("validator accrued rewards overflow")
		}
	}

	defs := []struct {
		id, label, unit string
		value           uint64
	}{
		{MetricValidatorCount, "Registered validators", "validators", registered},
		{MetricActiveValidatorCount, "Active validators", "validators", active},
		{MetricNativeCollateral, "Native validator collateral", "base_units", native},
		{MetricCommunityCollateral, "Community validator collateral", "base_units", community},
		{MetricAccruedRewards, "Accrued validator rewards", "base_units", rewards},
	}

	out := make([]model.Metric, 0, len(defs))
	for _, def := range defs {
		method, err := registeredMethodology(def.id)
		if err != nil {
			return nil, err
		}
		metric, err := model.NewMetric(
			def.id,
			architecture.MetricValidator,
			def.label,
			strconv.FormatUint(def.value, 10),
			def.unit,
			method,
			model.Window{Kind: model.WindowPoint},
			provenance,
		)
		if err != nil {
			return nil, fmt.Errorf("build %s: %w", def.id, err)
		}
		out = append(out, metric)
	}
	return out, nil
}

func validValidatorLifecycle(lifecycle ValidatorLifecycle) bool {
	switch lifecycle {
	case ValidatorRegistered, ValidatorActive, ValidatorExiting, ValidatorCooldown:
		return true
	default:
		return false
	}
}

func addUint64(a, b uint64) (uint64, bool) {
	c := a + b
	return c, c < a
}
