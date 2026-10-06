package mail

import "strings"

const SignalProvider = "signal"

type SignalIntegrationBoundary struct {
	Provider                    string `json:"provider"`
	Status                      string `json:"status"`
	Architecture                string `json:"architecture"`
	TransportAuthority          string `json:"transport_authority"`
	MailStoresProviderSecrets   bool   `json:"mail_stores_provider_secrets"`
	MailOwnsSignalIdentity      bool   `json:"mail_owns_signal_identity"`
	AccountLinking              bool   `json:"account_linking"`
	OutboundNotifications       bool   `json:"outbound_notifications"`
	ShareAndForward             bool   `json:"share_and_forward"`
	InboundSync                 bool   `json:"inbound_sync"`
	WebhookIngestion            bool   `json:"webhook_ingestion"`
	DeepSync                    bool   `json:"deep_sync"`
	DeepSyncCondition           string `json:"deep_sync_condition"`
	PublicIndexing              bool   `json:"public_indexing"`
	MessageBodiesOnChain        bool   `json:"message_bodies_on_chain"`
	ProviderRegistrationAllowed bool   `json:"provider_registration_allowed"`
}

func CanonicalSignalIntegrationBoundary() SignalIntegrationBoundary {
	return SignalIntegrationBoundary{
		Provider:                    SignalProvider,
		Status:                      "SHARE_FORWARD_ENABLED",
		Architecture:                "EXTERNAL_SIGNAL_TRANSPORT_ADAPTER",
		TransportAuthority:          "SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY",
		MailStoresProviderSecrets:   false,
		MailOwnsSignalIdentity:      false,
		AccountLinking:              false,
		OutboundNotifications:       true,
		ShareAndForward:             true,
		InboundSync:                 false,
		WebhookIngestion:            false,
		DeepSync:                    false,
		DeepSyncCondition:           "STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED",
		PublicIndexing:              false,
		MessageBodiesOnChain:        false,
		ProviderRegistrationAllowed: false,
	}
}

func validateSignalIntegrationBoundary(boundary SignalIntegrationBoundary) error {
	boundary.Provider = normalizeProvider(boundary.Provider)
	boundary.Status = strings.TrimSpace(boundary.Status)
	boundary.Architecture = strings.TrimSpace(boundary.Architecture)
	boundary.TransportAuthority = strings.TrimSpace(boundary.TransportAuthority)
	boundary.DeepSyncCondition = strings.TrimSpace(boundary.DeepSyncCondition)
	if boundary.Provider != SignalProvider ||
		boundary.Status != "SHARE_FORWARD_ENABLED" ||
		boundary.Architecture != "EXTERNAL_SIGNAL_TRANSPORT_ADAPTER" ||
		boundary.TransportAuthority != "SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY" ||
		boundary.DeepSyncCondition != "STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED" ||
		boundary.MailStoresProviderSecrets ||
		boundary.MailOwnsSignalIdentity ||
		boundary.AccountLinking ||
		!boundary.OutboundNotifications ||
		!boundary.ShareAndForward ||
		boundary.InboundSync ||
		boundary.WebhookIngestion ||
		boundary.DeepSync ||
		boundary.PublicIndexing ||
		boundary.MessageBodiesOnChain ||
		boundary.ProviderRegistrationAllowed {
		return ErrConnectorInvalidResult
	}
	return nil
}
