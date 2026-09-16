package api

import (
	"encoding/json"
	"errors"
	"net/http"
	"sort"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/appstore/curation"
	"github.com/420integrated/420-integrated/appstore/security"
	"github.com/420integrated/420-integrated/appstore/wallet"
)

var ErrInvalidView = errors.New("invalid appstore application view")

const discoveryDisclaimer = "AppStore discovery, ranking, categories and presentation metadata are non-canonical. Canonical service identity, versions and implementations come from 420Registry and chain state."

type Links struct {
	Registry string `json:"registry,omitempty"`
	Explorer string `json:"explorer,omitempty"`
	Verify   string `json:"verify,omitempty"`
	Direct   string `json:"direct,omitempty"`
}

type ApplicationView struct {
	Listing     curation.Listing       `json:"listing"`
	Security    security.Presentation  `json:"security"`
	Wallet      wallet.Presentation    `json:"wallet"`
	Links       Links                  `json:"links"`
}

type Summary struct {
	ServiceID      string                    `json:"serviceId"`
	Version        uint32                    `json:"version"`
	Implementation string                    `json:"implementation"`
	Active         bool                      `json:"active"`
	Canonical      bool                      `json:"canonical"`
	Curation       curation.Metadata         `json:"curation"`
	WarningCount   int                       `json:"warningCount"`
	Links          Links                     `json:"links"`
}

type ListResponse struct {
	Items      []Summary `json:"items"`
	Page       int       `json:"page"`
	Limit      int       `json:"limit"`
	Total      int       `json:"total"`
	Disclaimer string    `json:"disclaimer"`
}

type DetailResponse struct {
	Application ApplicationView `json:"application"`
	Disclaimer  string          `json:"disclaimer"`
}

type CategoriesResponse struct {
	Categories []string `json:"categories"`
	Disclaimer string   `json:"disclaimer"`
}

type Service struct {
	byID map[string]ApplicationView
}

func New(views []ApplicationView) (*Service, error) {
	s := &Service{byID: make(map[string]ApplicationView, len(views))}
	for _, view := range views {
		id := strings.ToLower(strings.TrimSpace(view.Listing.Canonical.ServiceID))
		if id == "" || view.Listing.Canonical.Version == 0 || !strings.EqualFold(id, view.Listing.Curation.ServiceID) {
			return nil, ErrInvalidView
		}
		if view.Security.ServiceID != "" && (!strings.EqualFold(view.Security.ServiceID, id) || view.Security.Version != view.Listing.Canonical.Version) {
			return nil, ErrInvalidView
		}
		if existing, ok := s.byID[id]; ok && existing.Listing.Canonical.Version >= view.Listing.Canonical.Version {
			return nil, ErrInvalidView
		}
		s.byID[id] = view
	}
	return s, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/apps", s.handleBrowse)
	mux.HandleFunc("GET /v1/apps/search", s.handleSearch)
	mux.HandleFunc("GET /v1/apps/categories", s.handleCategories)
	mux.HandleFunc("GET /v1/apps/{serviceID}", s.handleDetail)
	return mux
}

func (s *Service) handleBrowse(w http.ResponseWriter, r *http.Request) {
	s.writeList(w, r, "")
}

func (s *Service) handleSearch(w http.ResponseWriter, r *http.Request) {
	s.writeList(w, r, strings.TrimSpace(r.URL.Query().Get("q")))
}

func (s *Service) writeList(w http.ResponseWriter, r *http.Request, query string) {
	category := strings.ToLower(strings.TrimSpace(r.URL.Query().Get("category")))
	activeOnly := parseBool(r.URL.Query().Get("active"))
	featuredOnly := parseBool(r.URL.Query().Get("featured"))
	sponsoredOnly := parseBool(r.URL.Query().Get("sponsored"))

	items := make([]curation.Listing, 0, len(s.byID))
	views := make(map[string]ApplicationView, len(s.byID))
	for id, view := range s.byID {
		if query != "" && !matches(view, query) { continue }
		if category != "" && !contains(view.Listing.Curation.Categories, category) { continue }
		if activeOnly && !view.Listing.Canonical.Active { continue }
		if featuredOnly && !view.Listing.Curation.Featured { continue }
		if sponsoredOnly && !view.Listing.Curation.Sponsored { continue }
		items = append(items, view.Listing)
		views[id] = view
	}
	items = curation.Rank(items)

	page := positiveInt(r.URL.Query().Get("page"), 1)
	limit := positiveInt(r.URL.Query().Get("limit"), 20)
	if limit > 100 { limit = 100 }
	start := (page - 1) * limit
	if start > len(items) { start = len(items) }
	end := start + limit
	if end > len(items) { end = len(items) }

	out := make([]Summary, 0, end-start)
	for _, listing := range items[start:end] {
		view := views[strings.ToLower(listing.Canonical.ServiceID)]
		out = append(out, summarize(view))
	}
	writeJSON(w, http.StatusOK, ListResponse{Items: out, Page: page, Limit: limit, Total: len(items), Disclaimer: discoveryDisclaimer})
}

func (s *Service) handleDetail(w http.ResponseWriter, r *http.Request) {
	id := strings.ToLower(strings.TrimSpace(r.PathValue("serviceID")))
	view, ok := s.byID[id]
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "application not found"})
		return
	}
	writeJSON(w, http.StatusOK, DetailResponse{Application: view, Disclaimer: discoveryDisclaimer})
}

func (s *Service) handleCategories(w http.ResponseWriter, _ *http.Request) {
	seen := map[string]struct{}{}
	for _, view := range s.byID {
		for _, category := range view.Listing.Curation.Categories { seen[strings.ToLower(category)] = struct{}{} }
	}
	categories := make([]string, 0, len(seen))
	for category := range seen { categories = append(categories, category) }
	sort.Strings(categories)
	writeJSON(w, http.StatusOK, CategoriesResponse{Categories: categories, Disclaimer: discoveryDisclaimer})
}

func summarize(view ApplicationView) Summary {
	r := view.Listing.Canonical
	return Summary{
		ServiceID: r.ServiceID,
		Version: r.Version,
		Implementation: r.Implementation,
		Active: r.Active,
		Canonical: true,
		Curation: view.Listing.Curation,
		WarningCount: len(view.Security.Warnings),
		Links: view.Links,
	}
}

func matches(view ApplicationView, query string) bool {
	q := strings.ToLower(strings.TrimSpace(query))
	if q == "" { return true }
	fields := []string{view.Listing.Canonical.ServiceID, view.Listing.Curation.Description}
	fields = append(fields, view.Listing.Curation.Categories...)
	for _, field := range fields { if strings.Contains(strings.ToLower(field), q) { return true } }
	return false
}

func contains(values []string, want string) bool {
	for _, v := range values { if strings.EqualFold(strings.TrimSpace(v), want) { return true } }
	return false
}

func parseBool(raw string) bool {
	v, _ := strconv.ParseBool(strings.TrimSpace(raw))
	return v
}

func positiveInt(raw string, fallback int) int {
	v, err := strconv.Atoi(strings.TrimSpace(raw))
	if err != nil || v < 1 { return fallback }
	return v
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
