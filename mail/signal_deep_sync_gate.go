package mail

import (
	"strings"
)

const (
	SignalDeepSyncStatusConditionUnsatisfied = "CONDITION_UNSATISFIED"
	SignalDeepSyncRequirementStableSurface   = "STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED"
)

type SignalDeepSyncStatus struct {
	Provider              string   `json:"provider"`
	Status                string   `json:"status"`
	Enabled               bool     `json:"enabled"`
	Condition             string   `json:"condition"`
	SupportedSurfaceFound bool     `json:"supported_surface_found"`
	MissingEvidence       []string `json:"missing_evidence"`
	InboundSync           bool     `json:"inbound_sync"`
	WebhookIngestion      bool     `json:"webhook_ingestion"`
	ProviderRegistration  bool     `json:"provider_registration"`
}

func CanonicalSignalDeepSyncStatus() SignalDeepSyncStatus {
	return SignalDeepSyncStatus{
		Provider:              SignalProvider,
		Status:                SignalDeepSyncStatusConditionUnsatisfied,
		Enabled:               false,
		Condition:             SignalDeepSyncRequirementStableSurface,
		SupportedSurfaceFound: false,
		MissingEvidence: []string{
			"SUPPORTED_SIGNAL_API_OR_CLIENT_CONTRACT",
			"STABLE_INBOUND_SYNC_TRANSPORT",
			"ACCOUNT_OR_DEVICE_BINDING_AUTHORITY",
			"REPLAY_AND_CURSOR_SEMANTICS",
			"PROVIDER_LIFECYCLE_AND_RATE_LIMIT_CONTRACT",
		},
		InboundSync:          false,
		WebhookIngestion:    false,
		ProviderRegistration: false,
	}
}

func validateSignalDeepSyncStatus(status SignalDeepSyncStatus) error {
	status.Provider = normalizeProvider(status.Provider)
	status.Status = strings.TrimSpace(status.Status)
	status.Condition = strings.TrimSpace(status.Condition)
	if status.Provider != SignalProvider ||
		status.Status != SignalDeepSyncStatusConditionUnsatisfied ||
		status.Enabled ||
		status.Condition != SignalDeepSyncRequirementStableSurface ||
		status.SupportedSurfaceFound ||
		len(status.MissingEvidence) == 0 ||
		status.InboundSync ||
		status.WebhookIngestion ||
		status.ProviderRegistration {
		return ErrConnectorInvalidResult
	}
	required := map[string]bool{
		"SUPPORTED_SIGNAL_API_OR_CLIENT_CONTRACT":   false,
		"STABLE_INBOUND_SYNC_TRANSPORT":             false,
		"ACCOUNT_OR_DEVICE_BINDING_AUTHORITY":       false,
		"REPLAY_AND_CURSOR_SEMANTICS":               false,
		"PROVIDER_LIFECYCLE_AND_RATE_LIMIT_CONTRACT": false,
	}
	for _, item := range status.MissingEvidence {
		item = strings.TrimSpace(item)
		if _, ok := required[item]; !ok {
			return ErrConnectorInvalidResult
		}
		required[item] = true
	}
	for _, present := range required {
		if !present {
			return ErrConnectorInvalidResult
		}
	}
	return nil
}
