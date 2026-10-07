package mail

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func onboardingHTTPHandler(method OnboardingMethod) (HTTPHandler, *onboardingAuthorityStub) {
	authority := &onboardingAuthorityStub{result: validOnboardingResult(method)}
	onboarding := NewOnboardingService(authority)
	onboarding.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	return HTTPHandler{Onboarding: onboarding}, authority
}

func TestHTTPOnboardingRoutesArePublicAndMethodSpecific(t *testing.T) {
	cases := []struct {
		path   string
		method OnboardingMethod
		body   any
	}{
		{"/v1/onboarding/google", OnboardingGoogle, GoogleOnboardingRequest{IDToken: "google-token"}},
		{"/v1/onboarding/apple", OnboardingApple, AppleOnboardingRequest{IDToken: "apple-token"}},
		{"/v1/onboarding/passkey", OnboardingPasskey, PasskeyOnboardingRequest{Assertion: "assertion"}},
		{"/v1/onboarding/wallet", OnboardingExistingWallet, WalletOnboardingRequest{
			Address: "0x1111111111111111111111111111111111111111", Challenge: "challenge", Signature: "signature",
		}},
	}
	for _, tc := range cases {
		t.Run(tc.path, func(t *testing.T) {
			h, authority := onboardingHTTPHandler(tc.method)
			raw, err := json.Marshal(tc.body)
			if err != nil {
				t.Fatal(err)
			}
			req := httptest.NewRequest(http.MethodPost, tc.path, bytes.NewReader(raw))
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, req)
			if rec.Code != http.StatusOK {
				t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
			}
			var got OnboardingResult
			if err := json.Unmarshal(rec.Body.Bytes(), &got); err != nil {
				t.Fatal(err)
			}
			if got.Method != tc.method || got.SessionToken == "" || !got.NonCustodial {
				t.Fatalf("unexpected onboarding result: %+v", got)
			}
			if len(authority.calls) != 1 || authority.calls[0] != tc.method {
				t.Fatalf("wrong authority call: %+v", authority.calls)
			}
		})
	}
}

func TestHTTPOnboardingRejectsSecretFieldsAndMalformedRequests(t *testing.T) {
	h, authority := onboardingHTTPHandler(OnboardingGoogle)
	for _, body := range []string{
		`{"id_token":"token","private_key":"0xdead"}`,
		`{"id_token":"token","seed_phrase":"never accept this"}`,
		`{"id_token":`,
	} {
		req := httptest.NewRequest(http.MethodPost, "/v1/onboarding/google", bytes.NewBufferString(body))
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, req)
		if rec.Code != http.StatusBadRequest {
			t.Fatalf("body=%q status=%d response=%s", body, rec.Code, rec.Body.String())
		}
	}
	if len(authority.calls) != 0 {
		t.Fatalf("invalid requests reached authority: %+v", authority.calls)
	}
}

func TestHTTPOnboardingFailsClosedOnCustodialOrDependencyResult(t *testing.T) {
	h, authority := onboardingHTTPHandler(OnboardingGoogle)
	authority.result.NonCustodial = false
	req := httptest.NewRequest(http.MethodPost, "/v1/onboarding/google", bytes.NewBufferString(`{"id_token":"token"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("custodial result status=%d body=%s", rec.Code, rec.Body.String())
	}

	h, authority = onboardingHTTPHandler(OnboardingGoogle)
	authority.err = errors.New("provider replay rejected")
	req = httptest.NewRequest(http.MethodPost, "/v1/onboarding/google", bytes.NewBufferString(`{"id_token":"token"}`))
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusBadGateway {
		t.Fatalf("dependency failure status=%d body=%s", rec.Code, rec.Body.String())
	}
}

func TestHTTPOnboardingDoesNotRequirePreexistingMailSession(t *testing.T) {
	h, _ := onboardingHTTPHandler(OnboardingGoogle)
	h.Authenticate = func(*http.Request) (string, error) {
		t.Fatal("onboarding must not call normal Mail authentication")
		return "", nil
	}
	req := httptest.NewRequest(http.MethodPost, "/v1/onboarding/google", bytes.NewBufferString(`{"id_token":"token"}`))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", rec.Code, rec.Body.String())
	}
}
