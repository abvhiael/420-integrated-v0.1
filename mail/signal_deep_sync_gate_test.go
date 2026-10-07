package mail

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCanonicalSignalDeepSyncStatusKeepsConditionUnsatisfied(t *testing.T) {
	status := CanonicalSignalDeepSyncStatus()
	if err := validateSignalDeepSyncStatus(status); err != nil {
		t.Fatal(err)
	}
	if status.Provider != SignalProvider ||
		status.Status != SignalDeepSyncStatusConditionUnsatisfied ||
		status.Enabled ||
		status.SupportedSurfaceFound ||
		status.InboundSync ||
		status.WebhookIngestion ||
		status.ProviderRegistration {
		t.Fatalf("unexpected Signal deep-sync status: %+v", status)
	}
	if status.Condition != SignalDeepSyncRequirementStableSurface {
		t.Fatalf("unexpected deep-sync condition: %q", status.Condition)
	}
	if len(status.MissingEvidence) != 5 {
		t.Fatalf("missing evidence inventory drifted: %+v", status.MissingEvidence)
	}
}

func TestSignalDeepSyncGateRejectsFalsePromotion(t *testing.T) {
	base := CanonicalSignalDeepSyncStatus()
	cases := []func(*SignalDeepSyncStatus){
		func(s *SignalDeepSyncStatus) { s.Enabled = true },
		func(s *SignalDeepSyncStatus) { s.SupportedSurfaceFound = true },
		func(s *SignalDeepSyncStatus) { s.InboundSync = true },
		func(s *SignalDeepSyncStatus) { s.WebhookIngestion = true },
		func(s *SignalDeepSyncStatus) { s.ProviderRegistration = true },
		func(s *SignalDeepSyncStatus) { s.Status = "ENABLED" },
		func(s *SignalDeepSyncStatus) { s.Condition = "" },
		func(s *SignalDeepSyncStatus) { s.MissingEvidence = nil },
	}
	for _, mutate := range cases {
		got := base
		got.MissingEvidence = append([]string(nil), base.MissingEvidence...)
		mutate(&got)
		if err := validateSignalDeepSyncStatus(got); err == nil {
			t.Fatalf("unsafe deep-sync promotion accepted: %+v", got)
		}
	}
}

func TestSignalDeepSyncGateRequiresCompleteMissingEvidenceInventory(t *testing.T) {
	base := CanonicalSignalDeepSyncStatus()
	for i := range base.MissingEvidence {
		got := base
		got.MissingEvidence = append([]string(nil), base.MissingEvidence...)
		got.MissingEvidence = append(got.MissingEvidence[:i], got.MissingEvidence[i+1:]...)
		if err := validateSignalDeepSyncStatus(got); err == nil {
			t.Fatalf("incomplete missing-evidence inventory accepted: %+v", got.MissingEvidence)
		}
	}
}

func TestSignalDeepSyncStatusIsAuthenticatedAndReadOnly(t *testing.T) {
	h := HTTPHandler{
		Service: &Service{},
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/connectors/signal/deep-sync/status", nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated status=%d body=%s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/connectors/signal/deep-sync/status", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusMethodNotAllowed {
		t.Fatalf("write status=%d body=%s", rec.Code, rec.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/connectors/signal/deep-sync/status", nil)
	req.Header.Set("X-Test-Actor", "alice.420")
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("read status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestSignalDeepSyncRemainsAbsentFromOperationalConnectorRegistry(t *testing.T) {
	reg, err := NewConnectorRegistry(testConnectorAdapter("example", ConnectorCapabilityLink))
	if err != nil {
		t.Fatal(err)
	}
	for _, d := range reg.Descriptors() {
		if d.Provider == SignalProvider {
			t.Fatalf("Signal unexpectedly registered as operational connector: %+v", d)
		}
	}
}
