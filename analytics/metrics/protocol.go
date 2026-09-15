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
	MetricProtocolEventCount = "protocol.event_count"
	MetricProtocolObjectCount = "protocol.object_count"
	MetricProtocolActiveObjectCount = "protocol.active_object_count"
	MetricProtocolCount = "protocol.distinct_count"
)

type ProtocolEventProjection struct {
	ChainID uint64
	BlockNumber uint64
	TransactionHash string
	LogIndex uint64
	Protocol string
	EventName string
}

type ProtocolObjectProjection struct {
	ChainID uint64
	BlockNumber uint64
	Protocol string
	ObjectKey string
	LifecycleState string
}

type ProtocolInput struct {
	Source string
	Events []ProtocolEventProjection
	Objects []ProtocolObjectProjection
}

func BuildProtocolMetrics(input ProtocolInput, provenance model.Provenance) ([]model.Metric, error) {
	if input.Source != string(architecture.SourceIndexer) || provenance.Source != string(architecture.SourceIndexer) {
		return nil, errors.New("protocol analytics require qualified 420Indexer provenance")
	}
	if len(input.Events) == 0 && len(input.Objects) == 0 {
		return nil, errors.New("protocol analytics require indexed protocol events or objects")
	}

	protocols := map[string]struct{}{}
	events := map[string]struct{}{}
	for i, event := range input.Events {
		if err := validateProtocolCoordinates(event.ChainID, event.BlockNumber, provenance); err != nil {
			return nil, fmt.Errorf("event %d: %w", i, err)
		}
		protocol := strings.ToLower(strings.TrimSpace(event.Protocol))
		if protocol == "" || strings.TrimSpace(event.EventName) == "" || strings.TrimSpace(event.TransactionHash) == "" {
			return nil, fmt.Errorf("event %d missing stable protocol identity", i)
		}
		id := strings.ToLower(strings.TrimSpace(event.TransactionHash)) + ":" + strconv.FormatUint(event.LogIndex, 10)
		if _, exists := events[id]; exists {
			return nil, fmt.Errorf("duplicate protocol event projection: %s", id)
		}
		events[id] = struct{}{}
		protocols[protocol] = struct{}{}
	}

	objects := map[string]struct{}{}
	var active uint64
	for i, object := range input.Objects {
		if err := validateProtocolCoordinates(object.ChainID, object.BlockNumber, provenance); err != nil {
			return nil, fmt.Errorf("object %d: %w", i, err)
		}
		protocol := strings.ToLower(strings.TrimSpace(object.Protocol))
		key := strings.TrimSpace(object.ObjectKey)
		if protocol == "" || key == "" {
			return nil, fmt.Errorf("object %d missing stable protocol identity", i)
		}
		id := protocol + ":" + key
		if _, exists := objects[id]; exists {
			return nil, fmt.Errorf("duplicate protocol object projection: %s", id)
		}
		objects[id] = struct{}{}
		protocols[protocol] = struct{}{}
		if protocolLifecycleActive(object.LifecycleState) {
			active++
		}
	}

	defs := []struct {
		id string
		label string
		unit string
		method string
		description string
		value uint64
	}{
		{MetricProtocolEventCount, "Protocol events", "events", "protocol-event-count", "count of unique typed protocol events exposed through qualified 420Indexer at or before the analytics snapshot", uint64(len(events))},
		{MetricProtocolObjectCount, "Protocol objects", "objects", "protocol-object-count", "count of unique latest protocol-object projections exposed through qualified 420Indexer", uint64(len(objects))},
		{MetricProtocolActiveObjectCount, "Active protocol objects", "objects", "protocol-active-object-count", "count of latest protocol objects whose lifecycle state is active or enabled", active},
		{MetricProtocolCount, "Distinct protocols", "protocols", "distinct-protocol-count", "count of distinct protocol identifiers represented by indexed event and object projections", uint64(len(protocols))},
	}

	out := make([]model.Metric, 0, len(defs))
	for _, def := range defs {
		metric, err := model.NewMetric(def.id, architecture.MetricProtocol, def.label, strconv.FormatUint(def.value, 10), def.unit, model.Methodology{ID: def.method, Version: "v1", Description: def.description}, model.Window{Kind: model.WindowPoint}, provenance)
		if err != nil {
			return nil, fmt.Errorf("build %s: %w", def.id, err)
		}
		out = append(out, metric)
	}
	return out, nil
}

func validateProtocolCoordinates(chainID, blockNumber uint64, provenance model.Provenance) error {
	if chainID == 0 || chainID != provenance.ChainID {
		return errors.New("protocol projection chain provenance mismatch")
	}
	if blockNumber == 0 || blockNumber > provenance.IndexedHeight {
		return errors.New("protocol projection exceeds qualified indexed height")
	}
	return nil
}

func protocolLifecycleActive(state string) bool {
	switch strings.ToLower(strings.TrimSpace(state)) {
	case "active", "enabled":
		return true
	default:
		return false
	}
}
