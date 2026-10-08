package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"strings"
	"time"

	reeferreview "github.com/420integrated/420-integrated/reefer-review"
)

func main() {
	if strings.EqualFold(strings.TrimSpace(os.Getenv("REEFER_REVIEW_EMBEDDED_POLLING")), "true") {
		log.Print("standalone RSS poller disabled; API process owns shared in-memory store")
		return
	}
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
		Fetcher: reeferreview.FeedFetcher{},
	}
	mode := strings.ToLower(strings.TrimSpace(os.Getenv("REEFER_REVIEW_FEED_MODE")))
	if mode == "poll" || mode == "health" {
		statePath := strings.TrimSpace(os.Getenv("REEFER_REVIEW_FEED_CHECKPOINT"))
		if statePath == "" {
			statePath = ".reefer-review/feed-operations.json"
		}
		operations := &reeferreview.FeedOperations{
			Path: statePath, Sources: registry, SourcesPath: sourcePath, Ingestor: ingestor,
		}
		if mode == "health" {
			health, err := operations.Health(context.Background())
			if err != nil {
				log.Fatal(err)
			}
			if err := json.NewEncoder(os.Stdout).Encode(health); err != nil {
				log.Fatal(err)
			}
			return
		}
		log.Print("RR-8 polling enabled; checkpoints and source health persisted")
		if err := operations.Run(context.Background(), 30*time.Second); err != nil {
			log.Fatal(err)
		}
		return
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
