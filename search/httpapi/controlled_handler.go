package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
)

type controlledHandler struct {
	next     http.Handler
	controls Controls
}

// NewControlled wraps the versioned Search API with resource and abuse
// controls. Runtime/deployment should use this constructor; rate policy itself
// remains injected and non-canonical.
func NewControlled(backend Backend, controls Controls) (http.Handler, error) {
	next, err := New(backend)
	if err != nil {
		return nil, err
	}
	return &controlledHandler{next: next, controls: normalizeControls(controls)}, nil
}

func (h *controlledHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")

	if err := validateRequestShape(r); err != nil {
		writeError(w, http.StatusRequestURITooLong, "request_too_large", "request URI exceeds maximum length")
		return
	}
	if isQueryEndpoint(r.URL.Path) {
		if err := validateQueryComplexity(r.URL.Query().Get("q")); err != nil {
			writeError(w, http.StatusBadRequest, "query_too_complex", err.Error())
			return
		}
	}
	if h.controls.RateLimiter != nil {
		if err := h.controls.RateLimiter.Allow(r.Context(), r, endpointName(r.URL.Path)); err != nil {
			if errors.Is(err, ErrRateLimited) {
				writeError(w, http.StatusTooManyRequests, "rate_limited", "search request rate limited")
				return
			}
			writeError(w, http.StatusServiceUnavailable, "rate_limit_unavailable", "search admission control unavailable")
			return
		}
	}

	ctx, cancel := context.WithTimeout(r.Context(), h.controls.BackendTimeout)
	defer cancel()
	h.next.ServeHTTP(w, r.WithContext(ctx))
}

func isQueryEndpoint(path string) bool {
	switch path {
	case BasePath + "/search", BasePath + "/suggest", BasePath + "/resolve":
		return true
	default:
		return false
	}
}

func endpointName(path string) string {
	return strings.TrimPrefix(path, BasePath+"/")
}
