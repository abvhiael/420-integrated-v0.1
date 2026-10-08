package reeferreview

import (
	"context"
	"crypto/subtle"
	"net/http"
)

type newsAdminContextKey struct{}

func withNewsAdmin(ctx context.Context) context.Context {
	return context.WithValue(ctx, newsAdminContextKey{}, true)
}

func isNewsAdmin(ctx context.Context) bool {
	authorized, _ := ctx.Value(newsAdminContextKey{}).(bool)
	return authorized
}

// NewsOnlyHandler exposes only read-only RSS news APIs and one separately gated
// source-administration API. It never mounts publishing, moderation, Wallet,
// Identity, Rights or other blockchain-facing routes.
func (h HTTP) NewsOnlyHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/readyz", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}
		if h.News == nil || h.News.validate() != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"status": "not_ready"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"status": "ready", "service": "reefer-review-news-only"})
	})
	mux.HandleFunc("/v1/news", h.news)
	mux.HandleFunc("/v1/news/sources", h.newsSources)
	mux.HandleFunc("/v1/news/topics", h.newsTopics)
	mux.HandleFunc("/v1/news/", h.newsItem)
	mux.HandleFunc("/v1/admin/news/sources", func(w http.ResponseWriter, r *http.Request) {
		if len(h.NewsAdminKey) < 32 {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SOURCE_ADMIN_DISABLED"})
			return
		}
		token := bearerToken(r.Header.Get("Authorization"))
		if len(token) != len(h.NewsAdminKey) || subtle.ConstantTimeCompare([]byte(token), h.NewsAdminKey) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "SOURCE_ADMIN_REQUIRED"})
			return
		}
		h.newsAdminSources(w, r.WithContext(withNewsAdmin(r.Context())))
	})
	return securityResponseHeaders((&HTTPMetrics{}).Middleware(newAPIRateLimiter(120, 1, 4096).wrap(mux)))
}
