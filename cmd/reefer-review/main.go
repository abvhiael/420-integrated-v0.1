package main

import (
	"log"
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
	if mode != "development" {
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
	mem := reeferreview.NewMemory()
	svc := reeferreview.Service{Identity: reeferreview.AllowIdentity{}, Auth: reeferreview.DevAuthorizer{}, Rights: reeferreview.DevRights{}, Blobs: reeferreview.MemoryBlob{M: mem}, Store: mem, Search: reeferreview.NoopSearch{}, Notifications: reeferreview.NoopNotifications{}, Mail: reeferreview.NoopMail{}}
	server := &http.Server{Addr: addr, Handler: reeferreview.HTTP{Service: svc, News: news}.Handler(), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second}
	log.Printf("Reefer Review development service listening on %s; production modes intentionally blocked", addr)
	log.Fatal(server.ListenAndServe())
}
