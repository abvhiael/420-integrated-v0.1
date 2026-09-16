package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	MaxQueryBytes       = 2048
	MaxQueryValues      = 16
	MaxQueryValueBytes  = 256
	MaxMetricIDBytes    = 128
	MaxCatalogItems     = 100000
	MaxResponseBytes    = 4 << 20
	MaxRequestDuration  = 2 * time.Second
)

// RateLimiter is an operational hook. Genesis HTTP semantics do not prescribe
// an identity or quota scheme; deployments may inject one without changing API
// handlers or granting Analytics protocol authority.
type RateLimiter interface {
	Allow(*http.Request) (allowed bool, retryAfter time.Duration)
}

type allowAllLimiter struct{}

func (allowAllLimiter) Allow(*http.Request) (bool, time.Duration) { return true, 0 }

func validateQuery(r *http.Request, allowedKeys ...string) error {
	if len(r.URL.RawQuery) > MaxQueryBytes {
		return errors.New("query exceeds maximum encoded size")
	}
	allowed := make(map[string]struct{}, len(allowedKeys))
	for _, key := range allowedKeys {
		allowed[key] = struct{}{}
	}
	values := r.URL.Query()
	count := 0
	for key, entries := range values {
		if _, ok := allowed[key]; !ok {
			return errors.New("unsupported query parameter: " + key)
		}
		count += len(entries)
		if count > MaxQueryValues {
			return errors.New("query exceeds maximum parameter cardinality")
		}
		if len(entries) > 1 {
			return errors.New("duplicate query parameter: " + key)
		}
		for _, value := range entries {
			if len(value) > MaxQueryValueBytes {
				return errors.New("query parameter value exceeds maximum size")
			}
		}
	}
	return nil
}

func boundedMetricID(r *http.Request) (string, error) {
	metricID := strings.TrimSpace(r.URL.Query().Get("metricId"))
	if len(metricID) > MaxMetricIDBytes {
		return "", errors.New("metricId exceeds maximum size")
	}
	return metricID, nil
}

func ensureCatalogBound(size int) error {
	if size > MaxCatalogItems {
		return errors.New("analytics catalog exceeds maximum scan cardinality")
	}
	return nil
}

func (s *Server) resourceGuard(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.RawQuery) > MaxQueryBytes {
			badRequest(w, errors.New("query exceeds maximum encoded size"))
			return
		}
		allowed, retryAfter := s.limiter.Allow(r)
		if !allowed {
			if retryAfter > 0 {
				seconds := int64((retryAfter + time.Second - 1) / time.Second)
				if seconds < 1 { seconds = 1 }
				w.Header().Set("Retry-After", strconv.FormatInt(seconds, 10))
			}
			writeJSON(w, http.StatusTooManyRequests, map[string]any{"error": "analytics request rate limited"})
			return
		}
		ctx, cancel := context.WithTimeout(r.Context(), MaxRequestDuration)
		defer cancel()
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
