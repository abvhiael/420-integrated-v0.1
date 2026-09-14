package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	MaxRequestURIBytes     = 8192
	MaxQueryTerms          = 32
	DefaultBackendTimeout  = 3 * time.Second
)

var ErrRateLimited = errors.New("search request rate limited")

// RateLimiter is an enforcement hook for runtime/deployment policy. Search
// defines the fail-closed contract but does not make rate policy canonical.
type RateLimiter interface {
	Allow(context.Context, *http.Request, string) error
}

type Controls struct {
	BackendTimeout time.Duration
	RateLimiter    RateLimiter
}

func normalizeControls(c Controls) Controls {
	if c.BackendTimeout <= 0 {
		c.BackendTimeout = DefaultBackendTimeout
	}
	return c
}

func validateRequestShape(r *http.Request) error {
	if len(r.RequestURI) > MaxRequestURIBytes {
		return errors.New("request URI exceeds maximum length")
	}
	return nil
}

func validateQueryComplexity(raw string) error {
	if len(strings.Fields(raw)) > MaxQueryTerms {
		return errors.New("search query has too many terms")
	}
	for _, r := range raw {
		if r < 0x20 && r != '\t' && r != '\n' && r != '\r' {
			return errors.New("search query contains control characters")
		}
	}
	return nil
}
