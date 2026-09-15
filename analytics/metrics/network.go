package metrics

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/indexerclient"
	"github.com/420integrated/420-integrated/analytics/model"
)

const (
	MetricIndexedHeight = "network.indexed_height"
	MetricSafeHeight    = "network.safe_height"
	MetricFinalityDepth = "network.finality_depth"
	MetricProjectionLag = "network.projection_lag"
)

type NetworkInput struct {
	Status indexerclient.Status
}

func BuildNetworkMetrics(input NetworkInput, provenance model.Provenance) ([]model.Metric, error) {
	if err := validateNetworkInput(input.Status, provenance); err != nil {
		return nil, err
	}

	indexed, _ := strconv.ParseUint(input.Status.IndexedHead, 10, 64)
	safe, _ := strconv.ParseUint(input.Status.Finality.SafeHead, 10, 64)
	lag := uint64(0)
	if strings.TrimSpace(input.Status.Lag) != "" {
		parsed, err := strconv.ParseUint(input.Status.Lag, 10, 64)
		if err != nil {
			return nil, errors.New("420Indexer projection lag is not numeric")
		}
		lag = parsed
	}
	depth := indexed - safe

	window := model.Window{Kind: model.WindowPoint}
	defs := []struct {
		id    string
		label string
		value uint64
		unit  string
	}{
		{MetricIndexedHeight, "Indexed height", indexed, "blocks"},
		{MetricSafeHeight, "Safe height", safe, "blocks"},
		{MetricFinalityDepth, "Finality depth", depth, "blocks"},
		{MetricProjectionLag, "Projection lag", lag, "blocks"},
	}

	out := make([]model.Metric, 0, len(defs))
	for _, def := range defs {
		method, err := registeredMethodology(def.id)
		if err != nil {
			return nil, err
		}
		metric, err := model.NewMetric(
			def.id,
			architecture.MetricNetwork,
			def.label,
			strconv.FormatUint(def.value, 10),
			def.unit,
			method,
			window,
			provenance,
		)
		if err != nil {
			return nil, fmt.Errorf("build %s: %w", def.id, err)
		}
		out = append(out, metric)
	}
	return out, nil
}

func validateNetworkInput(status indexerclient.Status, provenance model.Provenance) error {
	if status.Authoritative {
		return errors.New("authoritative Indexer status cannot produce analytics metrics")
	}
	chainID, err := strconv.ParseUint(status.ChainID, 10, 64)
	if err != nil || chainID == 0 || chainID != provenance.ChainID {
		return errors.New("network metric chain provenance mismatch")
	}
	indexed, err := strconv.ParseUint(status.IndexedHead, 10, 64)
	if err != nil || indexed == 0 || indexed != provenance.IndexedHeight {
		return errors.New("network metric indexed-head provenance mismatch")
	}
	if strings.TrimSpace(status.IndexedHeadHash) == "" || status.IndexedHeadHash != provenance.IndexedHeadHash {
		return errors.New("network metric indexed-head hash provenance mismatch")
	}
	safe, err := strconv.ParseUint(status.Finality.SafeHead, 10, 64)
	if err != nil || safe > indexed || safe != provenance.SafeHeight {
		return errors.New("network metric safe-head provenance mismatch")
	}
	return nil
}
