package api

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestSecurityMutationBodyAndIdempotencyKeyAreBounded(t *testing.T) {
	server, _, _ := apiFixture(t)

	oversized := `{"ID":"post:9","ContentRef":"` + strings.Repeat("x", maxRequestBytes) + `","SHA256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","Visibility":"PUBLIC"}`
	req := httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewBufferString(oversized))
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "bounded")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("oversized body code=%d body=%s", res.Code, res.Body.String())
	}

	payload := []byte(`{"ID":"post:9","ContentRef":"storage://9","SHA256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","Visibility":"PUBLIC"}`)
	req = httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", strings.Repeat("k", 257))
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("oversized idempotency key code=%d body=%s", res.Code, res.Body.String())
	}
}

func TestSecurityAuthenticationDoesNotAcceptMalformedBearerVariants(t *testing.T) {
	server, _, _ := apiFixture(t)
	payload := []byte(`{"ID":"post:9","ContentRef":"storage://9","SHA256":"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc","Visibility":"PUBLIC"}`)

	for _, auth := range []string{"good", "Bearer", "Bearer bad", "Basic good"} {
		req := httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewReader(payload))
		req.Header.Set("Authorization", auth)
		req.Header.Set("Idempotency-Key", "idem-security")
		res := httptest.NewRecorder()
		server.Handler().ServeHTTP(res, req)
		if res.Code != http.StatusUnauthorized {
			t.Fatalf("auth=%q code=%d body=%s", auth, res.Code, res.Body.String())
		}
	}
}
