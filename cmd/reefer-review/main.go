package main

import (
	"log"
	"context"
	"net/http"
	"os"
	"strings"
	"time"

	reeferreview "github.com/420integrated/420-integrated/reefer-review"
)

func main() {
	mode := strings.TrimSpace(os.Getenv("REEFER_REVIEW_DEPLOYMENT_MODE"))
	if mode == "" {
		mode = "development"
	}
	if mode != "development" && mode != "news-only" {
		log.Fatal("Reefer Review live adapters are not configured; staging/production fail closed")
	}
	newsDB := strings.TrimSpace(os.Getenv("REEFER_REVIEW_NEWS_DB"))
	if newsDB == "" {
		newsDB = ".reefer-review/news.json"
	}
	newsSources := strings.TrimSpace(os.Getenv("REEFER_REVIEW_NEWS_SOURCES"))
	if newsSources == "" {
		newsSources = "config/reefer-review-news-sources.json"
	}
	newsStore, err := reeferreview.OpenFileNewsStore(newsDB)
	if err != nil {
		log.Fatal(err)
	}
	newsRegistry, err := reeferreview.LoadNewsSourceRegistry(newsSources)
	if err != nil {
		log.Fatal(err)
	}
	news := &reeferreview.NewsService{Store: newsStore, Sources: newsRegistry, SourcesPath: newsSources}

	addr := strings.TrimSpace(os.Getenv("REEFER_REVIEW_LISTEN_ADDR"))
	if addr == "" {
		addr = "127.0.0.1:8096"
	}
	if mode == "news-only" {
		secret := strings.TrimSpace(os.Getenv("REEFER_REVIEW_NEWS_ADMIN_KEY"))
		if secret != "" && len(secret) < 32 {
			log.Fatal("news-only admin secret must be at least 32 characters")
		}
		checkpoint := strings.TrimSpace(os.Getenv("REEFER_REVIEW_FEED_CHECKPOINT"))
		if checkpoint == "" {
			checkpoint = ".reefer-review/feed-operations.json"
		}
		if strings.EqualFold(strings.TrimSpace(os.Getenv("REEFER_REVIEW_FEED_MODE")), "poll") {
			operations := &reeferreview.FeedOperations{
				Path: checkpoint, Sources: newsRegistry, SourcesPath: newsSources,
				Ingestor: reeferreview.NewsIngestor{Store: newsStore, Fetcher: reeferreview.FeedFetcher{}},
			}
			go func() {
				if err := operations.Run(context.Background(), 30*time.Second); err != nil {
					log.Printf("RSS polling stopped: %v", err)
				}
			}()
			log.Print("RSS polling enabled in API process using one shared news store")
		}
		server := &http.Server{Addr: addr, Handler: (reeferreview.HTTP{News: news, NewsAdminKey: []byte(secret), NewsFeedCheckpointPath: checkpoint}).NewsOnlyHandler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
		log.Printf("ReeferReview standalone RSS news service listening on %s; editorial/chain endpoints disabled", addr)
		log.Fatal(server.ListenAndServe())
		return
	}
	mem := reeferreview.NewMemory()
	svc := reeferreview.Service{Identity: reeferreview.AllowIdentity{}, Auth: reeferreview.DevAuthorizer{}, Rights: reeferreview.DevRights{}, Blobs: reeferreview.MemoryBlob{M: mem}, Store: mem, Search: reeferreview.NoopSearch{}, Notifications: reeferreview.NoopNotifications{}, Mail: reeferreview.NoopMail{}}
	server := &http.Server{Addr: addr, Handler: reeferreview.HTTP{Service: svc, News: news}.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	log.Printf("Reefer Review development service listening on %s; production modes intentionally blocked", addr)
	log.Fatal(server.ListenAndServe())
}
