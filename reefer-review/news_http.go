package reeferreview

import (
	"net/http"
	"strconv"
	"strings"
)

func (h HTTP) newsUnavailable(w http.ResponseWriter) bool {
	if h.News == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "NEWS_UNAVAILABLE"})
		return true
	}
	return false
}

func (h HTTP) news(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.newsUnavailable(w) {
		return
	}
	limit := 20
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "BAD_LIMIT"})
			return
		}
		limit = n
	}
	page, err := h.News.List(r.Context(), NewsListOptions{
		Limit: limit, Cursor: r.URL.Query().Get("cursor"), Source: r.URL.Query().Get("source"),
		Topic: r.URL.Query().Get("topic"), Query: r.URL.Query().Get("q"),
	})
	if err != nil {
		h.respond(w, nil, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, page)
}

func (h HTTP) newsItem(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.newsUnavailable(w) {
		return
	}
	id := strings.Trim(strings.TrimPrefix(r.URL.Path, "/v1/news/"), "/")
	if id == "" || strings.Contains(id, "/") {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "NOT_FOUND"})
		return
	}
	item, err := h.News.Get(r.Context(), id)
	if err != nil {
		h.respond(w, nil, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": item})
}

func (h HTTP) newsSources(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.newsUnavailable(w) {
		return
	}
	sources, err := h.News.PublicSources()
	if err != nil {
		h.respond(w, nil, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"sources": sources})
}

func (h HTTP) newsTopics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if h.newsUnavailable(w) {
		return
	}
	topics, err := h.News.Topics(r.Context())
	if err != nil {
		h.respond(w, nil, nil, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"topics": topics})
}
