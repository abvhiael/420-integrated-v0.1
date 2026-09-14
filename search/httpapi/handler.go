package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/pagination"
	"github.com/420integrated/420-integrated/search/query"
	searchresult "github.com/420integrated/420-integrated/search/result"
	"github.com/420integrated/420-integrated/search/sponsorship"
)

const (
	APIVersion        = "420-search-http-v1"
	BasePath          = "/v1"
	DefaultSearchSize = 25
	DefaultSuggestSize = 10
	MaxSuggestSize    = 20
	MaxQueryBytes     = 512
	MaxCursorBytes    = 4096
)

type SearchRequest struct {
	Plan   query.Plan
	Limit  int
	Cursor string
}

type SearchResponse struct {
	Results     []searchresult.Result    `json:"results"`
	Sponsored   []sponsorship.Placement `json:"sponsored,omitempty"`
	Snapshot    pagination.Snapshot      `json:"snapshot"`
	NextCursor  *string                  `json:"nextCursor"`
}

type SuggestRequest struct {
	Query string
	Limit int
}

type Suggestion struct {
	Text   string                    `json:"text"`
	Domain architecture.ResultDomain `json:"domain,omitempty"`
}

type ResolveRequest struct {
	Plan query.Plan
}

type ResolveResponse struct {
	Result *searchresult.Result `json:"result,omitempty"`
}

type OperationalStatus struct {
	OK              bool   `json:"ok"`
	State           string `json:"state"`
	Reason          string `json:"reason,omitempty"`
	IndexedHeight   uint64 `json:"indexedHeight,omitempty"`
	FinalizedHeight uint64 `json:"finalizedHeight,omitempty"`
}

type Backend interface {
	Search(context.Context, SearchRequest) (SearchResponse, error)
	Suggest(context.Context, SuggestRequest) ([]Suggestion, error)
	Resolve(context.Context, ResolveRequest) (ResolveResponse, error)
	Health(context.Context) (OperationalStatus, error)
	Readiness(context.Context) (OperationalStatus, error)
	Status(context.Context) (OperationalStatus, error)
}

type Handler struct {
	backend Backend
}

func New(backend Backend) (*Handler, error) {
	if backend == nil {
		return nil, errors.New("search HTTP backend required")
	}
	return &Handler{backend: backend}, nil
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "GET required")
		return
	}

	switch r.URL.Path {
	case BasePath + "/search":
		h.handleSearch(w, r)
	case BasePath + "/suggest":
		h.handleSuggest(w, r)
	case BasePath + "/resolve":
		h.handleResolve(w, r)
	case BasePath + "/capabilities":
		h.handleCapabilities(w, r)
	case BasePath + "/health":
		h.handleOperational(w, r, h.backend.Health)
	case BasePath + "/readiness":
		h.handleOperational(w, r, h.backend.Readiness)
	case BasePath + "/status":
		h.handleOperational(w, r, h.backend.Status)
	default:
		writeError(w, http.StatusNotFound, "not_found", "unknown search endpoint")
	}
}

func (h *Handler) handleSearch(w http.ResponseWriter, r *http.Request) {
	if !onlyParams(r, "q", "limit", "cursor") {
		writeError(w, http.StatusBadRequest, "invalid_parameters", "unsupported search parameter")
		return
	}
	plan, ok := parsePlan(w, r.URL.Query().Get("q"))
	if !ok {
		return
	}
	limit, ok := parseLimit(w, r.URL.Query().Get("limit"), DefaultSearchSize, pagination.MaxPageSize)
	if !ok {
		return
	}
	cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
	if len(cursor) > MaxCursorBytes {
		writeError(w, http.StatusBadRequest, "cursor_too_long", "search cursor exceeds maximum length")
		return
	}
	response, err := h.backend.Search(r.Context(), SearchRequest{Plan: plan, Limit: limit, Cursor: cursor})
	if err != nil {
		writeBackendError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) handleSuggest(w http.ResponseWriter, r *http.Request) {
	if !onlyParams(r, "q", "limit") {
		writeError(w, http.StatusBadRequest, "invalid_parameters", "unsupported suggest parameter")
		return
	}
	q := strings.TrimSpace(r.URL.Query().Get("q"))
	if q == "" {
		writeError(w, http.StatusBadRequest, "query_required", "suggest query required")
		return
	}
	if len(q) > MaxQueryBytes {
		writeError(w, http.StatusBadRequest, "query_too_long", "suggest query exceeds maximum length")
		return
	}
	limit, ok := parseLimit(w, r.URL.Query().Get("limit"), DefaultSuggestSize, MaxSuggestSize)
	if !ok {
		return
	}
	response, err := h.backend.Suggest(r.Context(), SuggestRequest{Query: q, Limit: limit})
	if err != nil {
		writeBackendError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, struct {
		Suggestions []Suggestion `json:"suggestions"`
	}{Suggestions: response})
}

func (h *Handler) handleResolve(w http.ResponseWriter, r *http.Request) {
	if !onlyParams(r, "q") {
		writeError(w, http.StatusBadRequest, "invalid_parameters", "unsupported resolve parameter")
		return
	}
	plan, ok := parsePlan(w, r.URL.Query().Get("q"))
	if !ok {
		return
	}
	if plan.Kind == query.KindText {
		writeError(w, http.StatusBadRequest, "exact_identifier_required", "resolver requires an exact identifier")
		return
	}
	response, err := h.backend.Resolve(r.Context(), ResolveRequest{Plan: plan})
	if err != nil {
		writeBackendError(w, err)
		return
	}
	if response.Result == nil {
		writeError(w, http.StatusNotFound, "not_found", "search result not found")
		return
	}
	writeJSON(w, http.StatusOK, response)
}

func (h *Handler) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	if !onlyParams(r) {
		writeError(w, http.StatusBadRequest, "invalid_parameters", "capabilities accepts no parameters")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"api": APIVersion,
		"querySchema": query.SchemaVersion,
		"cursorSchema": pagination.CursorSchema,
		"maxQueryBytes": MaxQueryBytes,
		"maxCursorBytes": MaxCursorBytes,
		"maxSearchResults": pagination.MaxPageSize,
		"maxSuggestions": MaxSuggestSize,
		"endpoints": []string{"search", "suggest", "resolve", "capabilities", "health", "readiness", "status"},
	})
}

func (h *Handler) handleOperational(w http.ResponseWriter, r *http.Request, fn func(context.Context) (OperationalStatus, error)) {
	if !onlyParams(r) {
		writeError(w, http.StatusBadRequest, "invalid_parameters", "operational endpoint accepts no parameters")
		return
	}
	status, err := fn(r.Context())
	if err != nil {
		writeBackendError(w, err)
		return
	}
	code := http.StatusOK
	if !status.OK {
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, status)
}

func parsePlan(w http.ResponseWriter, raw string) (query.Plan, bool) {
	if len(raw) > MaxQueryBytes {
		writeError(w, http.StatusBadRequest, "query_too_long", "search query exceeds maximum length")
		return query.Plan{}, false
	}
	plan, err := query.Parse(raw)
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_query", err.Error())
		return query.Plan{}, false
	}
	return plan, true
}

func parseLimit(w http.ResponseWriter, raw string, fallback, max int) (int, bool) {
	if strings.TrimSpace(raw) == "" {
		return fallback, true
	}
	limit, err := strconv.Atoi(raw)
	if err != nil || limit < 1 || limit > max {
		writeError(w, http.StatusBadRequest, "invalid_limit", "limit outside permitted range")
		return 0, false
	}
	return limit, true
}

func onlyParams(r *http.Request, allowed ...string) bool {
	set := make(map[string]struct{}, len(allowed))
	for _, key := range allowed {
		set[key] = struct{}{}
	}
	for key, values := range r.URL.Query() {
		if _, ok := set[key]; !ok || len(values) != 1 {
			return false
		}
	}
	return true
}

type StatusError struct {
	Status int
	Code   string
	Err    error
}

func (e *StatusError) Error() string {
	if e.Err == nil {
		return e.Code
	}
	return e.Err.Error()
}

func writeBackendError(w http.ResponseWriter, err error) {
	var statusErr *StatusError
	if errors.As(err, &statusErr) {
		code := statusErr.Code
		if strings.TrimSpace(code) == "" {
			code = "backend_error"
		}
		writeError(w, statusErr.Status, code, statusErr.Error())
		return
	}
	writeError(w, http.StatusServiceUnavailable, "backend_unavailable", "search backend unavailable")
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{
		"error": map[string]string{"code": code, "message": message},
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
