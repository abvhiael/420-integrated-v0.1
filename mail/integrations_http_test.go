package mail

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func connectorHTTPHandler(adapter *connectorAdapterStub) HTTPHandler {
	reg, err := NewConnectorRegistry(adapter)
	if err != nil {
		panic(err)
	}
	return HTTPHandler{
		Service:    &Service{},
		Connectors: NewConnectorService(reg),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}
}

func performConnectorRequest(t *testing.T, h HTTPHandler, method, path, actor string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var raw []byte
	if body != nil {
		var err error
		raw, err = json.Marshal(body)
		if err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, bytes.NewReader(raw))
	if actor != "" {
		req.Header.Set("X-Test-Actor", actor)
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func TestHTTPConnectorProviderAndLifecycleRoutes(t *testing.T) {
	adapter := testConnectorAdapter("example",
		ConnectorCapabilityLink, ConnectorCapabilityPull, ConnectorCapabilityPush, ConnectorCapabilityWebhook)
	h := connectorHTTPHandler(adapter)

	rec := performConnectorRequest(t, h, http.MethodGet, "/v1/connectors/providers", "alice.420", nil)
	if rec.Code != http.StatusOK {
		t.Fatalf("providers status=%d body=%s", rec.Code, rec.Body.String())
	}
	var descriptors []ConnectorDescriptor
	if err := json.Unmarshal(rec.Body.Bytes(), &descriptors); err != nil {
		t.Fatal(err)
	}
	if len(descriptors) != 1 || descriptors[0].Provider != "example" {
		t.Fatalf("unexpected descriptors: %+v", descriptors)
	}

	rec = performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/link", "alice.420",
		ConnectorLinkRequest{Provider: "example", AuthorizationRef: "vault:opaque-ref", AccountHint: "alice@example"})
	if rec.Code != http.StatusOK {
		t.Fatalf("link status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/pull", "alice.420",
		ConnectorPullRequest{Provider: "example", ConnectionID: "conn-1"})
	if rec.Code != http.StatusOK {
		t.Fatalf("pull status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/push", "alice.420",
		ConnectorPushRequest{Provider: "example", ConnectionID: "conn-1", Kind: "MESSAGE", Payload: "payload", IdempotencyKey: "idem-1"})
	if rec.Code != http.StatusOK {
		t.Fatalf("push status=%d body=%s", rec.Code, rec.Body.String())
	}

	rec = performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/unlink", "alice.420",
		map[string]string{"provider": "example", "connection_id": "conn-1"})
	if rec.Code != http.StatusNoContent {
		t.Fatalf("unlink status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPConnectorOwnerOperationsRequireAuthentication(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
	h := connectorHTTPHandler(adapter)
	rec := performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/link", "",
		ConnectorLinkRequest{Provider: "example", AuthorizationRef: "vault:ref"})
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(adapter.calls) != 0 {
		t.Fatalf("unauthenticated request reached adapter: %+v", adapter.calls)
	}
}

func TestHTTPConnectorRejectsRawSecretFields(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
	h := connectorHTTPHandler(adapter)
	for _, body := range []string{
		`{"provider":"example","authorization_ref":"vault:ref","access_token":"secret"}`,
		`{"provider":"example","authorization_ref":"vault:ref","refresh_token":"secret"}`,
		`{"provider":"example","authorization_ref":"vault:ref","client_secret":"secret"}`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/v1/connectors/link", bytes.NewBufferString(body))
		req.Header.Set("X-Test-Actor", "alice.420")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("body=%q status=%d response=%s", body, rec.Code, rec.Body.String())
		}
	}
	if len(adapter.calls) != 0 {
		t.Fatalf("secret-bearing link reached adapter: %+v", adapter.calls)
	}
}

func TestHTTPConnectorWebhookUsesTransportHeadersAndNoMailSession(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityWebhook)
	h := connectorHTTPHandler(adapter)
	h.Authenticate = func(*http.Request) (string, error) {
		t.Fatal("webhook must not use normal Mail authentication")
		return "", nil
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/webhooks/example", bytes.NewBufferString("signed-payload"))
	req.Header.Set("X-Provider-Signature", "sig-123")
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(adapter.calls) != 1 || adapter.calls[0] != "webhook" {
		t.Fatalf("wrong adapter calls: %+v", adapter.calls)
	}
}

func TestHTTPConnectorWebhookRejectsSpoofedHeaderJSON(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityWebhook)
	h := connectorHTTPHandler(adapter)
	req := httptest.NewRequest(http.MethodPost, "/v1/connectors/webhooks/example",
		bytes.NewBufferString(`{"headers":{"x-provider-signature":"fake"},"payload":"x"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("raw webhook payload should be opaque to Mail: status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPConnectorUnsupportedCapabilityFailsBeforeAdapter(t *testing.T) {
	adapter := testConnectorAdapter("example", ConnectorCapabilityLink)
	h := connectorHTTPHandler(adapter)
	rec := performConnectorRequest(t, h, http.MethodPost, "/v1/connectors/pull", "alice.420",
		ConnectorPullRequest{Provider: "example", ConnectionID: "conn-1"})
	if rec.Code != http.StatusConflict {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(adapter.calls) != 0 {
		t.Fatalf("unsupported operation reached adapter: %+v", adapter.calls)
	}
}
