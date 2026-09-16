package model

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/architecture"
	"github.com/420integrated/420-integrated/analytics/indexerclient"
)

func fixtureProvenance() Provenance {
	return ProvenanceFromIndexer(indexerclient.SnapshotProvenance{
		ChainID:         420,
		IndexedHeight:   100,
		IndexedHeadHash: "0xabc",
		SafeHeight:      98,
		IndexedAt:       time.Unix(2_000_000_000, 0).UTC(),
	})
}

func fixtureMethodology() Methodology {
	return Methodology{ID: "tx-count", Version: "v1", Description: "count indexed transactions in the selected window"}
}

func TestMetricContractQualifies(t *testing.T) {
	m, err := NewMetric(
		"network.tx_count",
		architecture.MetricNetwork,
		"Transactions",
		"42",
		"transactions",
		fixtureMethodology(),
		Window{Kind: WindowBlock, StartHeight: 90, EndHeight: 100},
		fixtureProvenance(),
	)
	if err != nil { t.Fatal(err) }
	if m.SchemaVersion != MetricSchemaVersion || m.Canonical { t.Fatalf("unexpected metric contract: %+v", m) }
}

func TestAllGenesisMetricClassesAreAccepted(t *testing.T) {
	for _, class := range architecture.GenesisProfile().MetricClasses {
		_, err := NewMetric("metric."+string(class), class, string(class), "1", "count", fixtureMethodology(), Window{Kind: WindowPoint}, fixtureProvenance())
		if err != nil { t.Fatalf("class %s rejected: %v", class, err) }
	}
}

func TestMetricRejectsUnknownClass(t *testing.T) {
	_, err := NewMetric("metric.secret", architecture.MetricClass("secret"), "Secret", "1", "count", fixtureMethodology(), Window{Kind: WindowPoint}, fixtureProvenance())
	if err == nil { t.Fatal("expected unsupported metric class failure") }
}

func TestMetricRequiresVersionedMethodology(t *testing.T) {
	_, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "1", "transactions", Methodology{ID:"tx-count"}, Window{Kind: WindowPoint}, fixtureProvenance())
	if err == nil { t.Fatal("expected incomplete methodology failure") }
}

func TestBlockWindowCannotExceedIndexerSnapshot(t *testing.T) {
	_, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "1", "transactions", fixtureMethodology(), Window{Kind:WindowBlock, StartHeight:90, EndHeight:101}, fixtureProvenance())
	if err == nil { t.Fatal("expected future block window failure") }
}

func TestTimeWindowCannotExceedIndexedTime(t *testing.T) {
	start := time.Unix(1_999_999_000, 0).UTC()
	end := time.Unix(2_000_000_001, 0).UTC()
	_, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "1", "transactions", fixtureMethodology(), Window{Kind:WindowTime, StartTime:&start, EndTime:&end}, fixtureProvenance())
	if err == nil { t.Fatal("expected future time window failure") }
}

func TestMetricRejectsNonIndexerProvenance(t *testing.T) {
	p := fixtureProvenance()
	p.Source = "node420"
	_, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "1", "transactions", fixtureMethodology(), Window{Kind:WindowPoint}, p)
	if err == nil { t.Fatal("expected direct-source provenance failure") }
}

func TestSnapshotBindsMetricsToOneProvenance(t *testing.T) {
	p := fixtureProvenance()
	m, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "42", "transactions", fixtureMethodology(), Window{Kind:WindowPoint}, p)
	if err != nil { t.Fatal(err) }
	s, err := NewSnapshot(time.Unix(2_000_000_010, 0), p, []Metric{m})
	if err != nil { t.Fatal(err) }
	if s.SchemaVersion != SnapshotSchemaVersion || s.Canonical || !s.Rebuildable || s.ID == "" { t.Fatalf("unexpected snapshot: %+v", s) }
	if err := ValidateSnapshot(s); err != nil { t.Fatalf("snapshot should validate: %v", err) }
}

func TestSnapshotRejectsMixedProvenance(t *testing.T) {
	p := fixtureProvenance()
	m, err := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "42", "transactions", fixtureMethodology(), Window{Kind:WindowPoint}, p)
	if err != nil { t.Fatal(err) }
	m.Provenance.IndexedHeight = 99
	if _, err := NewSnapshot(time.Unix(2_000_000_010, 0), p, []Metric{m}); err == nil { t.Fatal("expected mixed provenance failure") }
}

func TestSnapshotIdentityIsDeterministicAndTamperEvident(t *testing.T) {
	p := fixtureProvenance()
	m, _ := NewMetric("network.tx_count", architecture.MetricNetwork, "Transactions", "42", "transactions", fixtureMethodology(), Window{Kind:WindowPoint}, p)
	at := time.Unix(2_000_000_010, 0)
	a, err := NewSnapshot(at, p, []Metric{m})
	if err != nil { t.Fatal(err) }
	b, err := NewSnapshot(at, p, []Metric{m})
	if err != nil { t.Fatal(err) }
	if a.ID != b.ID { t.Fatalf("snapshot identity is not deterministic: %s != %s", a.ID, b.ID) }
	a.ID = "anl_tampered"
	if err := ValidateSnapshot(a); err == nil { t.Fatal("expected tampered snapshot identity failure") }
}
