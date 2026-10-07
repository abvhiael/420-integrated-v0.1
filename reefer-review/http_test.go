package reeferreview

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestHTTPJourney006Baseline(t *testing.T) {
	h := rr4HTTP(t, testService()).Handler()
	body := []byte("{\"idempotency_key\":\"journey-006\",\"title\":\"News\",\"body\":\"hello\",\"visibility\":\"PUBLIC\"}")
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader(body))
	req.Header.Set("Authorization", "Bearer writer")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("draft status %d %s", rr.Code, rr.Body.String())
	}
	var out map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	data := out["data"].(map[string]any)
	id := data["id"].(string)
	req = httptest.NewRequest(http.MethodPost, "/v1/publications/"+id+"/publish", nil)
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("publish %d %s", rr.Code, rr.Body.String())
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/publications?limit=10", nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("list %d", rr.Code)
	}
}

func TestHTTPPublicReadFailsClosedForDraftAndPrivateContent(t *testing.T) {
	s := testService()
	h := rr4HTTP(t, s).Handler()

	private, err := s.CreateDraft(context.Background(), "writer.420", CreateDraftRequest{
		IdempotencyKey: "private-read",
		Title:          "Private",
		Body:           "secret",
		Visibility:     VisibilityPrivate,
	})
	if err != nil {
		t.Fatal(err)
	}
	req := httptest.NewRequest(http.MethodGet, "/v1/publications/"+private.ID, nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("private draft leaked with status %d", rr.Code)
	}

	publicDraft, err := s.CreateDraft(context.Background(), "writer.420", CreateDraftRequest{
		IdempotencyKey: "public-draft-read",
		Title:          "Draft",
		Body:           "not published",
		Visibility:     VisibilityPublic,
	})
	if err != nil {
		t.Fatal(err)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+publicDraft.ID, nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("public draft leaked with status %d", rr.Code)
	}

	published, _, err := s.Publish(context.Background(), "writer.420", publicDraft.ID)
	if err != nil {
		t.Fatal(err)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+published.ID, nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("published public article unreadable: %d %s", rr.Code, rr.Body.String())
	}
}

func TestHTTPRejectsMissingSession(t *testing.T) {
	h := rr4HTTP(t, testService()).Handler()
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader([]byte("{\"idempotency_key\":\"x\",\"title\":\"A\",\"body\":\"b\",\"visibility\":\"PUBLIC\"}")))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected 401 got %d", rr.Code)
	}
}

func TestRR4SpoofedActorHeaderDoesNotAuthenticate(t *testing.T) {
	h := rr4HTTP(t, testService()).Handler()
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader([]byte("{\"idempotency_key\":\"spoof\",\"title\":\"A\",\"body\":\"b\",\"visibility\":\"PUBLIC\"}")))
	req.Header.Set("X-420-Actor", "publisher.420")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("spoofed actor header authenticated: %d %s", rr.Code, rr.Body.String())
	}
}

func TestRR4CapabilityBoundaryAtHTTP(t *testing.T) {
	h := rr4HTTP(t, testService()).Handler()
	body := bytes.NewReader([]byte("{\"idempotency_key\":\"cap-boundary\",\"title\":\"A\",\"body\":\"b\",\"visibility\":\"PUBLIC\"}"))
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", body)
	req.Header.Set("Authorization", "Bearer moderator")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("moderator created draft: %d %s", rr.Code, rr.Body.String())
	}
}

func TestRR4RevokedAndExpiredSessionsFailClosed(t *testing.T) {
	now := time.Now().UTC()
	expired := rr4Claims("writer.420", CapabilityAuthor)
	expired.ExpiresAt = now.Add(-time.Second)
	revoked := rr4Claims("writer.420", CapabilityAuthor)
	revoked.Revoked = true
	h, err := NewIdentityBoundHTTP(testService(), nil, SessionSecurity{
		Verifier: rr4SessionMap{"expired": expired, "revoked": revoked},
		ExpectedChainID: 420, ExpectedNetwork: "testnet", Now: func() time.Time { return now },
	})
	if err != nil {
		t.Fatal(err)
	}
	for _, token := range []string{"expired", "revoked"} {
		req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader([]byte("{\"idempotency_key\":\"x\",\"title\":\"A\",\"body\":\"b\",\"visibility\":\"PUBLIC\"}")))
		req.Header.Set("Authorization", "Bearer "+token)
		rr := httptest.NewRecorder()
		h.Handler().ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("%s status=%d", token, rr.Code)
		}
	}
}
