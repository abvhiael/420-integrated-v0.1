package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	reeferreview "github.com/420integrated/420-integrated/reefer-review"
)

func main() {
	db := strings.TrimSpace(os.Getenv("REEFER_REVIEW_NEWS_DB"))
	if db == "" {
		db = ".reefer-review/news.json"
	}
	sourcePath := strings.TrimSpace(os.Getenv("REEFER_REVIEW_NEWS_SOURCES"))
	if sourcePath == "" {
		sourcePath = "config/reefer-review-news-sources.json"
	}
	registry, err := reeferreview.LoadNewsSourceRegistry(sourcePath)
	if err != nil {
		log.Fatal(err)
	}
	store, err := reeferreview.OpenFileNewsStore(db)
	if err != nil {
		log.Fatal(err)
	}
	ingestor := reeferreview.NewsIngestor{
		Store:   store,
		Fetcher: reeferreview.FeedFetcher{HTTP: &http.Client{Timeout: 20 * time.Second}},
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	failed := 0
	for _, source := range registry.EnabledSources() {
		stats, err := ingestor.SyncSource(ctx, source)
		if err != nil {
			failed++
			log.Printf("source %s failed: %v", source.ID, err)
			continue
		}
		fmt.Printf("%s fetched=%d visible=%d rejected=%d inserted=%d updated=%d duplicate=%d\n",
			source.ID, stats.Fetched, stats.Visible, stats.Rejected, stats.Inserted, stats.Updated, stats.Duplicate)
	}
	if failed > 0 {
		log.Fatalf("%d news source(s) failed", failed)
	}
}
