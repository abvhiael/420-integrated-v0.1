package httpapi

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

type testLimiter struct {
	err      error
	endpoint string
	calls    int
}

func (l *testLimiter) Allow(_ context.Context, _ *http.Request, endpoint string) error {
	l.calls++
	l.endpoint = endpoint
	return l.err
}

type blockingBackend struct{}

func (blockingBackend) Search(ctx context.Context, _ SearchRequest) (SearchResponse, error) {
	<-ctx.Done()
	return SearchResponse{}, ctx.Err()
}
func (blockingBackend) Suggest(ctx context.Context, _ SuggestRequest) ([]Suggestion, error) {
	<-ctx.Done()
	return nil, ctx.Err()
}
func (blockingBackend) Resolve(ctx context.Context, _ ResolveRequest) (ResolveResponse, error) {
	<-ctx.Done()
	return ResolveResponse{}, ctx.Err()
}
func (blockingBackend) Health(ctx context.Context) (OperationalStatus, error) {
	<-ctx.Done()
	return OperationalStatus{}, ctx.Err()
}
func (blockingBackend) Readiness(ctx context.Context) (OperationalStatus, error) {
	<-ctx.Done()
	return OperationalStatus{}, ctx.Err()
}
func (blockingBackend) Status(ctx context.Context) (OperationalStatus, error) {
	<-ctx.Done()
	return OperationalStatus{}, ctx.Err()
}

func TestControlledRejectsOversizedRequestURI(t *testing.T) {
	h, err := NewControlled(&stubBackend{}, Controls{})
	if err != nil { t.Fatal(err) }
	target := BasePath + "/search?q=" + strings.Repeat("a", MaxRequestURIBytes)
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, target, nil))
	if res.Code != http.StatusRequestURITooLong {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestControlledRejectsPathologicalTermCount(t *testing.T) {
	h, err := NewControlled(&stubBackend{}, Controls{})
	if err != nil { t.Fatal(err) }
	q := strings.TrimSpace(strings.Repeat("x+", MaxQueryTerms+1))
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q="+q, nil))
	if res.Code != http.StatusBadRequest || !strings.Contains(res.Body.String(), "query_too_complex") {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestControlledRateLimitHookRejectsWith429(t *testing.T) {
	limiter := &testLimiter{err: ErrRateLimited}
	h, err := NewControlled(&stubBackend{}, Controls{RateLimiter: limiter})
	if err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush", nil))
	if res.Code != http.StatusTooManyRequests || !strings.Contains(res.Body.String(), "rate_limited") {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	if limiter.calls != 1 || limiter.endpoint != "search" {
		t.Fatalf("limiter calls=%d endpoint=%q", limiter.calls, limiter.endpoint)
	}
}

func TestControlledRateLimiterFailureFailsClosed(t *testing.T) {
	limiter := &testLimiter{err: errors.New("limiter backend down")}
	h, err := NewControlled(&stubBackend{}, Controls{RateLimiter: limiter})
	if err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush", nil))
	if res.Code != http.StatusServiceUnavailable || !strings.Contains(res.Body.String(), "rate_limit_unavailable") {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	if strings.Contains(res.Body.String(), "backend down") {
		t.Fatalf("limiter internals leaked: %s", res.Body.String())
	}
}

func TestControlledBackendDeadlineBoundsExecution(t *testing.T) {
	h, err := NewControlled(blockingBackend{}, Controls{BackendTimeout: 5 * time.Millisecond})
	if err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	start := time.Now()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush", nil))
	if elapsed := time.Since(start); elapsed > time.Second {
		t.Fatalf("backend deadline not enforced, elapsed=%s", elapsed)
	}
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
}

func TestControlledAllowsHealthyRequest(t *testing.T) {
	limiter := &testLimiter{}
	h, err := NewControlled(&stubBackend{}, Controls{RateLimiter: limiter, BackendTimeout: time.Second})
	if err != nil { t.Fatal(err) }
	res := httptest.NewRecorder()
	h.ServeHTTP(res, httptest.NewRequest(http.MethodGet, BasePath+"/search?q=kush&limit=5", nil))
	if res.Code != http.StatusOK {
		t.Fatalf("status=%d body=%s", res.Code, res.Body.String())
	}
	if limiter.calls != 1 || limiter.endpoint != "search" {
		t.Fatalf("limiter calls=%d endpoint=%q", limiter.calls, limiter.endpoint)
	}
}
