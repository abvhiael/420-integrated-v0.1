package reeferreview

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRR3HTTPEditorialJourney(t *testing.T) {
	s := testService()
	h := rr4HTTP(t, s).Handler()
	ctx := context.Background()
	p, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "http-rr3", Title: "Draft", Summary: "sum", Body: "first", Visibility: VisibilityPrivate,
	})
	if err != nil {
		t.Fatal(err)
	}

	req := httptest.NewRequest(http.MethodGet, "/v1/editorial/publications?limit=20", nil)
	req.Header.Set("Authorization", "Bearer writer")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("editorial list %d %s", rr.Code, rr.Body.String())
	}

	update := []byte(`{"title":"Edited","summary":"new","body":"second","visibility":"PUBLIC"}`)
	req = httptest.NewRequest(http.MethodPut, "/v1/publications/"+p.ID, bytes.NewReader(update))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("edit %d %s", rr.Code, rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+p.ID+"/revisions", nil)
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("revisions %d %s", rr.Code, rr.Body.String())
	}
	var revisions map[string]any
	if err := json.Unmarshal(rr.Body.Bytes(), &revisions); err != nil {
		t.Fatal(err)
	}
	if len(revisions["items"].([]any)) != 2 {
		t.Fatalf("want 2 revisions: %s", rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/publications/"+p.ID+"/publish", nil)
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("publish %d %s", rr.Code, rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+p.ID, nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("public read %d %s", rr.Code, rr.Body.String())
	}
}

func TestRR3HTTPPrivateReadUsesSessionBoundary(t *testing.T) {
	s := testService()
	h := rr4HTTP(t, s).Handler()
	p, _ := s.CreateDraft(context.Background(), "writer.420", CreateDraftRequest{
		IdempotencyKey: "http-private", Title: "Private", Body: "secret", Visibility: VisibilityPrivate,
	})
	p, _, _ = s.Publish(context.Background(), "writer.420", p.ID)

	req := httptest.NewRequest(http.MethodGet, "/v1/publications/"+p.ID, nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusNotFound {
		t.Fatalf("anonymous private leak: %d", rr.Code)
	}
	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+p.ID, nil)
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("owner private read %d %s", rr.Code, rr.Body.String())
	}
}

func TestRR3HTTPModerationHistoryAndTombstone(t *testing.T) {
	s := testService()
	h := rr4HTTP(t, s).Handler()
	p, _ := s.CreateDraft(context.Background(), "writer.420", CreateDraftRequest{
		IdempotencyKey: "http-mod", Title: "Moderate", Body: "body", Visibility: VisibilityPublic,
	})
	p, _, _ = s.Publish(context.Background(), "writer.420", p.ID)

	req := httptest.NewRequest(http.MethodPost, "/v1/publications/"+p.ID+"/moderate", bytes.NewReader([]byte(`{"action":"HIDE","reason":"policy"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer moderator")
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("moderate %d %s", rr.Code, rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/publications/"+p.ID+"/moderation", nil)
	req.Header.Set("Authorization", "Bearer moderator")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK || !bytes.Contains(rr.Body.Bytes(), []byte("policy")) {
		t.Fatalf("history %d %s", rr.Code, rr.Body.String())
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/publications/"+p.ID+"/tombstone", bytes.NewReader([]byte(`{"reason":"withdraw"}`)))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer writer")
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("tombstone %d %s", rr.Code, rr.Body.String())
	}
}

func TestRR3HTTPEditorialListRequiresSession(t *testing.T) {
	h := rr4HTTP(t, testService()).Handler()
	req := httptest.NewRequest(http.MethodGet, "/v1/editorial/publications?limit=20", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("want 401, got %d %s", rr.Code, rr.Body.String())
	}
}
