package reeferreview

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestNewsHTTPFeedItemSourcesAndTopics(t *testing.T) {
	store, err := OpenFileNewsStore(t.TempDir() + "/news.json")
	if err != nil {
		t.Fatal(err)
	}
	source := testNewsSource()
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	visible, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis science", URL: "https://example.test/a", Summary: "CBD research study", PublishedAt: ptrTime(now)}, now)
	rejected, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Unrelated software", URL: "https://example.test/b", Summary: "database release", PublishedAt: ptrTime(now.Add(-time.Minute))}, now)
	if _, err := store.UpsertMany(context.Background(), []ExternalNewsItem{visible, rejected}); err != nil {
		t.Fatal(err)
	}
	news := &NewsService{Store: store, Sources: testNewsRegistry()}
	h := HTTP{Service: testService(), News: news}.Handler()

	req := httptest.NewRequest(http.MethodGet, "/v1/news?limit=20&topic=science", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("news list %d %s", rr.Code, rr.Body.String())
	}
	var page NewsPage
	if err := json.Unmarshal(rr.Body.Bytes(), &page); err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != visible.ID {
		t.Fatalf("unexpected feed: %+v", page)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/news/"+visible.ID, nil)
	rr = httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("news item %d %s", rr.Code, rr.Body.String())
	}

	for _, path := range []string{"/v1/news/sources", "/v1/news/topics"} {
		req = httptest.NewRequest(http.MethodGet, path, nil)
		rr = httptest.NewRecorder()
		h.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("%s: %d %s", path, rr.Code, rr.Body.String())
		}
	}
}

func TestNewsHTTPFailsClosedWithoutNewsService(t *testing.T) {
	h := HTTP{Service: testService()}.Handler()
	req := httptest.NewRequest(http.MethodGet, "/v1/news", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 503, got %d", rr.Code)
	}
}

func TestNewsHTTPRejectsBadLimit(t *testing.T) {
	store, _ := OpenFileNewsStore(t.TempDir() + "/news.json")
	h := HTTP{Service: testService(), News: &NewsService{Store: store, Sources: testNewsRegistry()}}.Handler()
	req := httptest.NewRequest(http.MethodGet, "/v1/news?limit=nope", nil)
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req)
	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected 400, got %d", rr.Code)
	}
}
