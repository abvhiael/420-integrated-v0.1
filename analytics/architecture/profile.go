package architecture

import "slices"

const (
	ServiceName = "420Analytics"
	ServiceID   = "420/service/analytics/v1"
	Phase       = "ANALYTICS-0"
)

type MetricClass string

const (
	MetricNetwork   MetricClass = "network"
	MetricValidator MetricClass = "validator"
	MetricProtocol  MetricClass = "protocol"
	MetricEconomic  MetricClass = "economic"
	MetricCohort    MetricClass = "cohort"
	MetricRanking   MetricClass = "ranking"
	MetricForecast  MetricClass = "forecast"
	MetricAnomaly   MetricClass = "anomaly"
)

type SourceBoundary string

const (
	SourceIndexer SourceBoundary = "420Indexer"
)

type PrivacyExclusion string

const (
	PrivateMessenger       PrivacyExclusion = "private_messenger"
	PrivateCommons         PrivacyExclusion = "private_commons"
	PrivateIdentity        PrivacyExclusion = "private_identity"
	EncryptedResource      PrivacyExclusion = "encrypted_resource_payload"
	RawAttentionTelemetry  PrivacyExclusion = "raw_attention_telemetry"
)

type Profile struct {
	Service                    string
	ServiceID                  string
	Phase                      string
	ContractsRequired          bool
	CanonicalStateAuthority    bool
	AnalyticsOwnsChainIngest   bool
	AnalyticsMayUseDirectRPC   bool
	AnalyticsDatabaseCanonical bool
	DerivedDataRebuildable     bool
	ForecastsCanonical         bool
	Sources                    []SourceBoundary
	MetricClasses              []MetricClass
	PrivacyExclusions          []PrivacyExclusion
}

func GenesisProfile() Profile {
	return Profile{
		Service:                    ServiceName,
		ServiceID:                  ServiceID,
		Phase:                      Phase,
		ContractsRequired:          false,
		CanonicalStateAuthority:    false,
		AnalyticsOwnsChainIngest:   false,
		AnalyticsMayUseDirectRPC:   false,
		AnalyticsDatabaseCanonical: false,
		DerivedDataRebuildable:     true,
		ForecastsCanonical:         false,
		Sources:                    []SourceBoundary{SourceIndexer},
		MetricClasses: []MetricClass{
			MetricNetwork, MetricValidator, MetricProtocol, MetricEconomic,
			MetricCohort, MetricRanking, MetricForecast, MetricAnomaly,
		},
		PrivacyExclusions: []PrivacyExclusion{
			PrivateMessenger, PrivateCommons, PrivateIdentity,
			EncryptedResource, RawAttentionTelemetry,
		},
	}
}

func (p Profile) AllowsSource(source SourceBoundary) bool {
	return slices.Contains(p.Sources, source)
}

func (p Profile) Excludes(class PrivacyExclusion) bool {
	return slices.Contains(p.PrivacyExclusions, class)
}
