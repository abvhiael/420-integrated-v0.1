package architecture

import "testing"

func TestGenesisProfileAuthorityBoundary(t *testing.T) {
	p := GenesisProfile()
	if p.Service != "420Analytics" || p.ServiceID != "420/service/analytics/v1" || p.Phase != "ANALYTICS-0" {
		t.Fatalf("unexpected service identity: %+v", p)
	}
	if p.ContractsRequired || p.CanonicalStateAuthority || p.AnalyticsOwnsChainIngest || p.AnalyticsMayUseDirectRPC || p.AnalyticsDatabaseCanonical || p.ForecastsCanonical {
		t.Fatalf("analytics must remain contract-free, non-canonical and non-RPC: %+v", p)
	}
	if !p.DerivedDataRebuildable {
		t.Fatal("derived analytics must be rebuildable")
	}
}

func TestGenesisProfileOnlyQualifiedIndexerSource(t *testing.T) {
	p := GenesisProfile()
	if len(p.Sources) != 1 || !p.AllowsSource(SourceIndexer) {
		t.Fatalf("unexpected source boundary: %+v", p.Sources)
	}
	if p.AllowsSource(SourceBoundary("node420")) || p.AllowsSource(SourceBoundary("rpc")) {
		t.Fatal("direct node/RPC source must not be admitted")
	}
}

func TestGenesisProfileMetricClasses(t *testing.T) {
	p := GenesisProfile()
	want := []MetricClass{MetricNetwork, MetricValidator, MetricProtocol, MetricEconomic, MetricCohort, MetricRanking, MetricForecast, MetricAnomaly}
	if len(p.MetricClasses) != len(want) {
		t.Fatalf("metric class count=%d want=%d", len(p.MetricClasses), len(want))
	}
	for _, class := range want {
		found := false
		for _, got := range p.MetricClasses {
			if got == class { found = true; break }
		}
		if !found { t.Fatalf("missing metric class %q", class) }
	}
}

func TestGenesisProfilePrivacyExclusions(t *testing.T) {
	p := GenesisProfile()
	for _, class := range []PrivacyExclusion{PrivateMessenger, PrivateCommons, PrivateIdentity, EncryptedResource, RawAttentionTelemetry} {
		if !p.Excludes(class) { t.Fatalf("missing privacy exclusion %q", class) }
	}
}
