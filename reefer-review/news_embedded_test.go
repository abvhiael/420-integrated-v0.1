package reeferreview

import (
	"context"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// This exercises the single-process production composition: the scheduler and
// the HTTP read handler hold exactly the same FileNewsStore instance.
func TestRR11EmbeddedPollerSharesAPIStore(t *testing.T) {
	store, err := OpenFileNewsStore(filepath.Join(t.TempDir(), "news.json"))
	if err != nil {
		t.Fatal(err)
	}
	registry := testNewsRegistry()
	client := &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(`<rss><channel><item><title>Cannabis retail market</title><link>https://example.test/new-story</link><description>Marijuana sales</description></item></channel></rss>`)), Request: req}, nil
	})}
	op := &FeedOperations{
		Path: filepath.Join(t.TempDir(), "checkpoint.json"), Sources: registry,
		Ingestor: NewsIngestor{Store: store, Fetcher: FeedFetcher{HTTP: client}},
		Now:      func() time.Time { return time.Date(2026, 10, 8, 12, 0, 0, 0, time.UTC) },
	}
	api := HTTP{News: &NewsService{Store: store, Sources: registry}}.NewsOnlyHandler()
	before := httptest.NewRecorder()
	api.ServeHTTP(before, httptest.NewRequest(http.MethodGet, "/v1/news?limit=5", nil))
	if before.Code != 200 || strings.Contains(before.Body.String(), "new-story") {
		t.Fatalf("bad initial response: %d %s", before.Code, before.Body.String())
	}
	stats, err := op.PollDue(context.Background())
	if err != nil || len(stats) == 0 || stats[0].Visible != 1 {
		t.Fatalf("poll: %+v %v", stats, err)
	}
	after := httptest.NewRecorder()
	api.ServeHTTP(after, httptest.NewRequest(http.MethodGet, "/v1/news?limit=5", nil))
	if after.Code != 200 || !strings.Contains(after.Body.String(), "Cannabis retail market") {
		t.Fatalf("API did not see poll results: %d %s", after.Code, after.Body.String())
	}
}
