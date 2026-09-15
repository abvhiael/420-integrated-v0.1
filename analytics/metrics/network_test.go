package metrics

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/analytics/indexerclient"
	"github.com/420integrated/420-integrated/analytics/model"
)

func networkFixture() (indexerclient.Status, model.Provenance) {
	var status indexerclient.Status
	status.ChainID = "420"
	status.IndexedHead = "100"
	status.IndexedHeadHash = "0xabc"
	status.IndexedHeadTimestamp = "2000000000"
	status.Lag = "3"
	status.Authoritative = false
	status.Finality.Mode = "confirmations"
	status.Finality.Confirmations = "2"
	status.Finality.SafeHead = "98"
	p := model.Provenance{
		Source:          "420Indexer",
		ChainID:         420,
		IndexedHeight:   100,
		IndexedHeadHash: "0xabc",
		SafeHeight:      98,
		IndexedAt:       time.Unix(2_000_000_000, 0).UTC(),
	}
	return status, p
}

func TestBuildNetworkMetrics(t *testing.T) {
	status, p := networkFixture()
	got, err := BuildNetworkMetrics(NetworkInput{Status: status}, p)
	if err != nil { t.Fatal(err) }
	if len(got) != 4 { t.Fatalf("expected 4 metrics, got %d", len(got)) }
	want := map[string]string{
		MetricIndexedHeight: "100",
		MetricSafeHeight: "98",
		MetricFinalityDepth: "2",
		MetricProjectionLag: "3",
	}
	for _, m := range got {
		if m.Class != "network" { t.Fatalf("unexpected metric class: %s", m.Class) }
		if m.Canonical { t.Fatalf("metric %s became canonical", m.ID) }
		if want[m.ID] != m.Value { t.Fatalf("metric %s value=%s want=%s", m.ID, m.Value, want[m.ID]) }
		if m.Provenance != p { t.Fatalf("metric %s lost provenance", m.ID) }
	}
}

func TestNetworkMetricsRejectAuthoritativeIndexer(t *testing.T) {
	status, p := networkFixture()
	status.Authoritative = true
	if _, err := BuildNetworkMetrics(NetworkInput{Status: status}, p); err == nil { t.Fatal("expected authority failure") }
}

func TestNetworkMetricsRejectMixedChain(t *testing.T) {
	status, p := networkFixture()
	p.ChainID = 421
	if _, err := BuildNetworkMetrics(NetworkInput{Status: status}, p); err == nil { t.Fatal("expected chain mismatch failure") }
}

func TestNetworkMetricsRejectHeadHashMismatch(t *testing.T) {
	status, p := networkFixture()
	p.IndexedHeadHash = "0xdef"
	if _, err := BuildNetworkMetrics(NetworkInput{Status: status}, p); err == nil { t.Fatal("expected hash mismatch failure") }
}

func TestNetworkMetricsRejectSafeHeadBeyondIndexedHead(t *testing.T) {
	status, p := networkFixture()
	status.Finality.SafeHead = "101"
	p.SafeHeight = 101
	if _, err := BuildNetworkMetrics(NetworkInput{Status: status}, p); err == nil { t.Fatal("expected invalid safe-head failure") }
}

func TestNetworkMetricsRejectNonNumericLag(t *testing.T) {
	status, p := networkFixture()
	status.Lag = "unknown"
	if _, err := BuildNetworkMetrics(NetworkInput{Status: status}, p); err == nil { t.Fatal("expected lag parse failure") }
}

func TestNetworkMetricsTreatMissingLagAsZero(t *testing.T) {
	status, p := networkFixture()
	status.Lag = ""
	got, err := BuildNetworkMetrics(NetworkInput{Status: status}, p)
	if err != nil { t.Fatal(err) }
	for _, m := range got {
		if m.ID == MetricProjectionLag && m.Value != "0" { t.Fatalf("missing lag should render zero, got %s", m.Value) }
	}
}
