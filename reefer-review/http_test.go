package reeferreview

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestHTTPJourney006Baseline(t *testing.T) {
	h := HTTP{Service: testService()}.Handler()
	body := []byte("{\"idempotency_key\":\"journey-006\",\"title\":\"News\",\"body\":\"hello\",\"visibility\":\"PUBLIC\"}")
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader(body))
	req.Header.Set("X-420-Actor", "writer.420")
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
	req.Header.Set("X-420-Actor", "writer.420")
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
	h := HTTP{Service: s}.Handler()

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

func TestHTTPRejectsMissingActor(t *testing.T) {
	h := HTTP{Service: testService()}.Handler()
	req := httptest.NewRequest(http.MethodPost, "/v1/publications", bytes.NewReader([]byte("{\"idempotency_key\":\"x\",\"title\":\"A\",\"body\":\"b\",\"visibility\":\"PUBLIC\"}")))
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400 got %d", rr.Code)
	}
}
