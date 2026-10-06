package mail

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func securityHTTPHandler() (HTTPHandler, *securityAuthorityStub) {
	authority := &securityAuthorityStub{state: validSecurityState()}
	return HTTPHandler{
		Service:  &Service{},
		Security: NewSecurityService(authority),
		Authenticate: func(r *http.Request) (string, error) {
			return r.Header.Get("X-Test-Actor"), nil
		},
	}, authority
}

func performSecurityRequest(t *testing.T, h HTTPHandler, method, path, actor string, body any) *httptest.ResponseRecorder {
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

func TestHTTPSecuritySnapshotAndManagementRoutes(t *testing.T) {
	cases := []struct {
		name   string
		method string
		path   string
		body   any
		call   string
	}{
		{"snapshot", http.MethodGet, "/v1/security", nil, "snapshot"},
		{"enroll-passkey", http.MethodPost, "/v1/security/passkeys", PasskeyEnrollmentRequest{Attestation: "attestation", DeviceID: "dev-1", Label: "laptop"}, "enroll-passkey"},
		{"revoke-passkey", http.MethodDelete, "/v1/security/passkeys/pk-1", nil, "revoke-passkey"},
		{"enroll-device", http.MethodPost, "/v1/security/devices", DeviceEnrollmentRequest{Proof: "device-proof", Label: "laptop", Platform: "web"}, "enroll-device"},
		{"revoke-device", http.MethodDelete, "/v1/security/devices/dev-1", nil, "revoke-device"},
		{"recovery", http.MethodPost, "/v1/security/recovery", RecoveryRequest{
			Action: RecoveryCancel, Account: "0x1111111111111111111111111111111111111111",
		}, "recovery"},
		{"revoke-session", http.MethodPost, "/v1/security/sessions/session-1/revoke", nil, "revoke-session"},
		{"ack-alert", http.MethodPost, "/v1/security/alerts/alert-1/ack", nil, "ack-alert"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			h, authority := securityHTTPHandler()
			rec := performSecurityRequest(t, h, tc.method, tc.path, "alice.420", tc.body)
			if rec.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
			var got SecurityState
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.Identity != "alice.420" || got.AuthorizationEpoch != 7 {
				t.Fatalf("unexpected security state: %+v", got)
			}
			if len(authority.calls) != 1 || authority.calls[0] != tc.call {
				t.Fatalf("wrong authority call: %+v", authority.calls)
			}
		})
	}
}

func TestHTTPSecurityRequiresAuthenticatedMailIdentity(t *testing.T) {
	h, authority := securityHTTPHandler()
	rec := performSecurityRequest(t, h, http.MethodGet, "/v1/security", "", nil)
	if rec.Code != http.StatusUnauthorized {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
	if len(authority.calls) != 0 {
		t.Fatalf("unauthenticated request reached authority: %+v", authority.calls)
	}
}

func TestHTTPSecurityRejectsUnknownSecretFields(t *testing.T) {
	h, authority := securityHTTPHandler()
	for _, tc := range []struct {
		path string
		body string
	}{
		{"/v1/security/passkeys", `{"attestation":"public-attestation","device_id":"dev-1","private_key":"secret"}`},
		{"/v1/security/passkeys", `{"attestation":"public-attestation","device_id":"dev-1","seed_phrase":"secret"}`},
		{"/v1/security/devices", `{"proof":"device-proof","passkey_private_material":"secret"}`},
		{"/v1/security/recovery", `{"action":"CANCEL","account":"0x1111111111111111111111111111111111111111","recovery_secret":"secret"}`},
	} {
		req := httptest.NewRequest(http.MethodPost, tc.path, bytes.NewBufferString(tc.body))
		req.Header.Set("X-Test-Actor", "alice.420")
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("path=%s status=%d body=%s", tc.path, rec.Code, rec.Body.String())
		}
	}
	if len(authority.calls) != 0 {
		t.Fatalf("secret-bearing requests reached authority: %+v", authority.calls)
	}
}

func TestHTTPSecurityFailsClosedOnAuthorityStateMismatch(t *testing.T) {
	h, authority := securityHTTPHandler()
	authority.state.Identity = "mallory.420"
	rec := performSecurityRequest(t, h, http.MethodGet, "/v1/security", "alice.420", nil)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPSecurityRejectsInvalidRouteShapes(t *testing.T) {
	h, authority := securityHTTPHandler()
	for _, tc := range []struct {
		method string
		path   string
	}{
		{http.MethodGet, "/v1/security/passkeys"},
		{http.MethodPost, "/v1/security/passkeys/pk-1"},
		{http.MethodPost, "/v1/security/sessions/session-1"},
		{http.MethodPost, "/v1/security/alerts/alert-1"},
	} {
		rec := performSecurityRequest(t, h, tc.method, tc.path, "alice.420", nil)
		if rec.Code != http.StatusMethodNotAllowed && rec.Code != http.StatusNotFound {
			t.Fatalf("%s %s status=%d body=%s", tc.method, tc.path, rec.Code, rec.Body.String())
		}
	}
	if len(authority.calls) != 0 {
		t.Fatalf("invalid routes reached authority: %+v", authority.calls)
	}
}
