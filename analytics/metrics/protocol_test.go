package metrics

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/model"
)

func protocolProvenance() model.Provenance {
	return model.Provenance{Source: "420Indexer", ChainID: 420, IndexedHeight: 100, IndexedHeadHash: "0xabc", SafeHeight: 98, IndexedAt: time.Unix(2000000000, 0).UTC()}
}

func TestProtocolMetricsQualify(t *testing.T) {
	metrics, err := BuildProtocolMetrics(ProtocolInput{
		Source: "420Indexer",
		Events: []ProtocolEventProjection{
			{ChainID: 420, BlockNumber: 90, TransactionHash: "0x1", LogIndex: 0, Protocol: "registry", EventName: "Registered"},
			{ChainID: 420, BlockNumber: 91, TransactionHash: "0x2", LogIndex: 1, Protocol: "pay", EventName: "Settled"},
		},
		Objects: []ProtocolObjectProjection{
			{ChainID: 420, BlockNumber: 95, Protocol: "registry", ObjectKey: "alice", LifecycleState: "active"},
			{ChainID: 420, BlockNumber: 96, Protocol: "pay", ObjectKey: "invoice-1", LifecycleState: "settled"},
		},
	}, protocolProvenance())
	if err != nil { t.Fatalf("unexpected error: %v", err) }
	if len(metrics) != 4 { t.Fatalf("expected 4 metrics, got %d", len(metrics)) }
	want := map[string]string{MetricProtocolEventCount: "2", MetricProtocolObjectCount: "2", MetricProtocolActiveObjectCount: "1", MetricProtocolCount: "2"}
	for _, metric := range metrics {
		if got := want[metric.ID]; got != metric.Value { t.Fatalf("%s: expected %s got %s", metric.ID, got, metric.Value) }
	}
}

func TestProtocolMetricsRejectWrongSource(t *testing.T) {
	_, err := BuildProtocolMetrics(ProtocolInput{Source: "rpc", Events: []ProtocolEventProjection{{ChainID: 420, BlockNumber: 90, TransactionHash: "0x1", Protocol: "registry", EventName: "Registered"}}}, protocolProvenance())
	if err == nil { t.Fatal("expected source rejection") }
}

func TestProtocolMetricsRejectFutureProjection(t *testing.T) {
	_, err := BuildProtocolMetrics(ProtocolInput{Source: "420Indexer", Events: []ProtocolEventProjection{{ChainID: 420, BlockNumber: 101, TransactionHash: "0x1", Protocol: "registry", EventName: "Registered"}}}, protocolProvenance())
	if err == nil { t.Fatal("expected height rejection") }
}

func TestProtocolMetricsRejectDuplicateEvent(t *testing.T) {
	input := ProtocolInput{Source: "420Indexer", Events: []ProtocolEventProjection{
		{ChainID: 420, BlockNumber: 90, TransactionHash: "0x1", LogIndex: 2, Protocol: "registry", EventName: "Registered"},
		{ChainID: 420, BlockNumber: 91, TransactionHash: "0x1", LogIndex: 2, Protocol: "registry", EventName: "Updated"},
	}}
	if _, err := BuildProtocolMetrics(input, protocolProvenance()); err == nil { t.Fatal("expected duplicate event rejection") }
}

func TestProtocolMetricsRejectDuplicateObject(t *testing.T) {
	input := ProtocolInput{Source: "420Indexer", Objects: []ProtocolObjectProjection{
		{ChainID: 420, BlockNumber: 90, Protocol: "registry", ObjectKey: "alice", LifecycleState: "active"},
		{ChainID: 420, BlockNumber: 91, Protocol: "registry", ObjectKey: "alice", LifecycleState: "enabled"},
	}}
	if _, err := BuildProtocolMetrics(input, protocolProvenance()); err == nil { t.Fatal("expected duplicate object rejection") }
}
