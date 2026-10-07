package reeferreview

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"
)

func testNewsSource() NewsSource {
	return NewsSource{
		ID: "source-a", Name: "Source A", FeedURL: "https://feeds.example.test/rss",
		HomeURL: "https://example.test/", Enabled: true, Category: "cannabis-news",
		Language: "en", PollIntervalMinutes: 30, AllowExcerpt: true, AllowImage: false,
		Attribution: "Source A RSS",
	}
}

func testNewsRegistry() NewsSourceRegistry {
	return NewsSourceRegistry{Schema: "420-reefer-review-news-sources-v1", Sources: []NewsSource{testNewsSource()}}
}

func TestCanonicalNewsURLStableIDAndTrackingRemoval(t *testing.T) {
	a, err := canonicalNewsURL("https://Example.TEST/story?utm_source=x&b=2&a=1#frag")
	if err != nil {
		t.Fatal(err)
	}
	b, err := canonicalNewsURL("https://example.test/story?a=1&b=2")
	if err != nil {
		t.Fatal(err)
	}
	if a != b || stableNewsID(a) != stableNewsID(b) {
		t.Fatalf("canonical identity mismatch: %q %q", a, b)
	}
}

func TestParseRSSAndAtom(t *testing.T) {
	rss := []byte(`<?xml version="1.0"?><rss version="2.0" xmlns:dc="urn:dc"><channel><title>Feed</title><item><title>Cannabis policy update</title><link>https://example.test/a</link><guid>g1</guid><dc:creator>Reporter</dc:creator><description><![CDATA[<p>New marijuana law.</p>]]></description><pubDate>Tue, 06 Oct 2026 12:00:00 +0000</pubDate><category>Policy</category></item></channel></rss>`)
	rows, err := ParseNewsFeed(rss)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].Title != "Cannabis policy update" || rows[0].Author != "Reporter" || rows[0].Summary != "New marijuana law." || rows[0].PublishedAt == nil {
		t.Fatalf("bad rss parse: %+v", rows)
	}
	atom := []byte(`<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><title>Hemp science</title><id>atom-1</id><summary>CBD research</summary><published>2026-10-06T12:00:00Z</published><author><name>Scientist</name></author><link rel="alternate" href="https://example.test/b"/><category term="Science"/></entry></feed>`)
	rows, err = ParseNewsFeed(atom)
	if err != nil {
		t.Fatal(err)
	}
	if len(rows) != 1 || rows[0].GUID != "atom-1" || rows[0].URL != "https://example.test/b" || rows[0].Author != "Scientist" {
		t.Fatalf("bad atom parse: %+v", rows)
	}
}

func TestParseNewsFeedRejectsDocumentType(t *testing.T) {
	_, err := ParseNewsFeed([]byte(`<!DOCTYPE rss><rss><channel></channel></rss>`))
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want invalid input, got %v", err)
	}
}

func TestCannabisRelevanceAndTopicClassification(t *testing.T) {
	relevant := RawNewsEntry{Title: "Senate advances cannabis legalization bill", Summary: "Marijuana policy reform"}
	if !cannabisRelevant(relevant) {
		t.Fatal("expected cannabis relevance")
	}
	topics := classifyNewsTopics(relevant)
	if !containsString(topics, "policy") {
		t.Fatalf("expected policy topic: %v", topics)
	}
	if cannabisRelevant(RawNewsEntry{Title: "Unrelated technology release", Summary: "New database software"}) {
		t.Fatal("unrelated item accepted")
	}
}

func containsString(values []string, want string) bool {
	for _, v := range values {
		if v == want {
			return true
		}
	}
	return false
}

func TestFileNewsStorePersistsDeduplicatesAndUsesCursorBoundary(t *testing.T) {
	ctx := context.Background()
	path := t.TempDir() + "/news.json"
	store, err := OpenFileNewsStore(path)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	source := testNewsSource()
	a, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis A", URL: "https://example.test/a", GUID: "g-a", Summary: "marijuana policy", PublishedAt: ptrTime(now)}, now)
	b, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis B", URL: "https://example.test/b", GUID: "g-b", Summary: "hemp science", PublishedAt: ptrTime(now.Add(-time.Minute))}, now)
	if _, err := store.UpsertMany(ctx, []ExternalNewsItem{a, b}); err != nil {
		t.Fatal(err)
	}
	page1, err := store.List(ctx, NewsListOptions{Limit: 1})
	if err != nil || len(page1.Items) != 1 || page1.Items[0].ID != a.ID || page1.NextCursor == "" {
		t.Fatalf("bad first page: %+v %v", page1, err)
	}
	newer, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis New", URL: "https://example.test/new", GUID: "g-new", Summary: "cannabis business", PublishedAt: ptrTime(now.Add(time.Minute))}, now)
	if _, err := store.UpsertMany(ctx, []ExternalNewsItem{newer}); err != nil {
		t.Fatal(err)
	}
	page2, err := store.List(ctx, NewsListOptions{Limit: 1, Cursor: page1.NextCursor})
	if err != nil || len(page2.Items) != 1 || page2.Items[0].ID != b.ID {
		t.Fatalf("cursor shifted after insert: %+v %v", page2, err)
	}
	reopened, err := OpenFileNewsStore(path)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := reopened.Get(ctx, a.ID); err != nil {
		t.Fatalf("persistence failed: %v", err)
	}
	changedURL, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis A updated", URL: "https://example.test/a-new", GUID: "g-a", Summary: "marijuana policy", PublishedAt: ptrTime(now)}, now.Add(time.Hour))
	stats, err := reopened.UpsertMany(ctx, []ExternalNewsItem{changedURL})
	if err != nil {
		t.Fatal(err)
	}
	if stats.Duplicate != 1 {
		t.Fatalf("expected guid duplicate continuity, got %+v", stats)
	}
	got, err := reopened.Get(ctx, a.ID)
	if err != nil || got.Title != "Cannabis A updated" {
		t.Fatalf("guid continuity did not update original id: %+v %v", got, err)
	}
}

func TestNewsCursorCannotBeReusedAcrossFilters(t *testing.T) {
	ctx := context.Background()
	store, _ := OpenFileNewsStore(t.TempDir() + "/news.json")
	now := time.Now().UTC()
	source := testNewsSource()
	item, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis science", URL: "https://example.test/science", Summary: "CBD study", PublishedAt: ptrTime(now)}, now)
	item2, _ := normalizeNewsEntry(source, RawNewsEntry{Title: "Cannabis policy", URL: "https://example.test/policy", Summary: "marijuana law", PublishedAt: ptrTime(now.Add(-time.Minute))}, now)
	_, _ = store.UpsertMany(ctx, []ExternalNewsItem{item, item2})
	page, err := store.List(ctx, NewsListOptions{Limit: 1, Source: source.ID})
	if err != nil || page.NextCursor == "" {
		t.Fatalf("first page failed: %+v %v", page, err)
	}
	_, err = store.List(ctx, NewsListOptions{Limit: 1, Cursor: page.NextCursor, Topic: "policy"})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected cursor/filter rejection, got %v", err)
	}
}

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestNewsIngestorPersistsRelevantAndRejectsUnrelated(t *testing.T) {
	feed := `<rss version="2.0"><channel><item><title>Cannabis market expands</title><link>https://example.test/cannabis</link><guid>1</guid><description>New marijuana retail data.</description></item><item><title>Database release</title><link>https://example.test/software</link><guid>2</guid><description>Developer tooling.</description></item></channel></rss>`
	hc := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(feed)), Header: make(http.Header)}, nil
	})}
	store, _ := OpenFileNewsStore(t.TempDir() + "/news.json")
	now := time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC)
	ing := NewsIngestor{Store: store, Fetcher: FeedFetcher{HTTP: hc}, Now: func() time.Time { return now }}
	stats, err := ing.SyncSource(context.Background(), testNewsSource())
	if err != nil {
		t.Fatal(err)
	}
	if stats.Visible != 1 || stats.Rejected != 1 {
		t.Fatalf("bad ingestion stats: %+v", stats)
	}
	page, err := store.List(context.Background(), NewsListOptions{Limit: 20})
	if err != nil || len(page.Items) != 1 || page.Items[0].CanonicalURL != "https://example.test/cannabis" {
		t.Fatalf("public feed did not filter: %+v %v", page, err)
	}
}

func TestNewsSourceRegistryRejectsInsecureFeed(t *testing.T) {
	reg := testNewsRegistry()
	reg.Sources[0].FeedURL = "http://example.test/feed"
	if err := ValidateNewsSourceRegistry(reg); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("want invalid input, got %v", err)
	}
}

func ptrTime(t time.Time) *time.Time { return &t }
