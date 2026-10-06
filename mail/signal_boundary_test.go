package mail

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCanonicalSignalIntegrationBoundaryAllowsNotificationsOnly(t *testing.T) {
	b := CanonicalSignalIntegrationBoundary()
	if err := validateSignalIntegrationBoundary(b); err != nil {
		t.Fatal(err)
	}
	if b.Provider != SignalProvider || b.Status != "NOTIFICATIONS_ONLY" || !b.OutboundNotifications {
		t.Fatalf("unexpected boundary: %+v", b)
	}
	if b.AccountLinking || b.ShareAndForward || b.InboundSync ||
		b.WebhookIngestion || b.DeepSync || b.PublicIndexing || b.MessageBodiesOnChain ||
		b.ProviderRegistrationAllowed || b.MailStoresProviderSecrets || b.MailOwnsSignalIdentity {
		t.Fatalf("Signal boundary enabled unsupported capability: %+v", b)
	}
	if b.DeepSyncCondition != "STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED" {
		t.Fatalf("unexpected deep-sync condition: %q", b.DeepSyncCondition)
	}
}

func TestSignalBoundaryRejectsCapabilityPromotion(t *testing.T) {
	base := CanonicalSignalIntegrationBoundary()
	cases := []func(*SignalIntegrationBoundary){
		func(b *SignalIntegrationBoundary) { b.AccountLinking = true },
		func(b *SignalIntegrationBoundary) { b.OutboundNotifications = false },
		func(b *SignalIntegrationBoundary) { b.ShareAndForward = true },
		func(b *SignalIntegrationBoundary) { b.InboundSync = true },
		func(b *SignalIntegrationBoundary) { b.WebhookIngestion = true },
		func(b *SignalIntegrationBoundary) { b.DeepSync = true },
		func(b *SignalIntegrationBoundary) { b.ProviderRegistrationAllowed = true },
		func(b *SignalIntegrationBoundary) { b.MailStoresProviderSecrets = true },
		func(b *SignalIntegrationBoundary) { b.PublicIndexing = true },
		func(b *SignalIntegrationBoundary) { b.MessageBodiesOnChain = true },
	}
	for _, mutate := range cases {
		got := base
		mutate(&got)
		if err := validateSignalIntegrationBoundary(got); err == nil {
			t.Fatalf("unsafe Signal boundary accepted: %+v", got)
		}
	}
}

func TestSignalIsNotRegisteredAsOperationalConnectorAtBoundaryStep(t *testing.T) {
	reg, err := NewConnectorRegistry(testConnectorAdapter("example", ConnectorCapabilityLink))
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range reg.Descriptors() {
		if d.Provider == SignalProvider {
			t.Fatalf("Signal unexpectedly registered before a supported operational capability: %+v", d)
		}
	}
}

func TestHTTPSignalBoundaryRequiresAuthenticationAndIsReadOnly(t *testing.T) {
	h := HTTPHandler{
		Service: &Service{},
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/signal/boundary", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status=%d body=%s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/connectors/signal/boundary", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("write status=%d body=%s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/connectors/signal/boundary", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("read status=%d body=%s", rec.Code, rec.Body.String())
	}
}
