package storage

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

const (
	GatewayHeaderAccessMode = "X-420-Access-Mode"
	GatewayHeaderSubject    = "X-420-Subject"
	GatewayHeaderSessionID  = "X-420-Session-ID"
	GatewayHeaderCapability = "X-420-Capability"
	GatewayHeaderTier       = "X-420-Gateway-Tier"
	GatewayHeaderProviderID = "X-420-Provider-ID"
	GatewayHeaderNodeID     = "X-420-Node-ID"
)

type GatewayHTTPHandler struct {
	Router GatewayRouter
}

func (h GatewayHTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/v1/gateway" {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	req, err := gatewayRequestFromHTTP(r)
	if err != nil {
		http.Error(w, "invalid gateway request", http.StatusBadRequest)
		return
	}
	result, err := h.Router.Route(r.Context(), req)
	if err != nil {
		switch {
		case errors.Is(err, ErrGatewayUnauthorized):
			http.Error(w, "gateway access unauthorized", http.StatusForbidden)
		case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
			http.Error(w, "gateway request canceled", http.StatusGatewayTimeout)
		default:
			http.Error(w, "gateway object unavailable", http.StatusBadGateway)
		}
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(len(result.Payload)))
	w.Header().Set(GatewayHeaderTier, result.Tier)
	if result.ProviderID != "" {
		w.Header().Set(GatewayHeaderProviderID, result.ProviderID)
	}
	if result.NodeID != "" {
		w.Header().Set(GatewayHeaderNodeID, result.NodeID)
	}
	w.WriteHeader(http.StatusOK)
	if r.Method == http.MethodHead {
		return
	}
	_, _ = w.Write(result.Payload)
}

func gatewayRequestFromHTTP(r *http.Request) (GatewayRequest, error) {
	q := r.URL.Query()
	shardIndex, err := strconv.ParseUint(strings.TrimSpace(q.Get("shard_index")), 10, 32)
	if err != nil {
		return GatewayRequest{}, ErrGatewayRoute
	}
	sizeBytes, err := strconv.ParseUint(strings.TrimSpace(q.Get("size_bytes")), 10, 64)
	if err != nil {
		return GatewayRequest{}, ErrGatewayRoute
	}
	mode := GatewayAccessMode(strings.ToLower(strings.TrimSpace(r.Header.Get(GatewayHeaderAccessMode))))
	if mode == "" {
		mode = GatewayAccessPublic
	}
	req := GatewayRequest{
		CacheKey: CacheKey{
			ObjectID: strings.TrimSpace(q.Get("object_id")),
			ManifestID: strings.TrimSpace(q.Get("manifest_id")),
			ShardIndex: uint32(shardIndex),
			ShardRoot: strings.TrimSpace(q.Get("shard_root")),
			SizeBytes: sizeBytes,
		},
		CommitmentID: strings.TrimSpace(q.Get("commitment_id")),
		Access: GatewayAccess{
			Mode: mode,
			Subject: strings.TrimSpace(r.Header.Get(GatewayHeaderSubject)),
			SessionID: strings.TrimSpace(r.Header.Get(GatewayHeaderSessionID)),
			Capability: strings.TrimSpace(r.Header.Get(GatewayHeaderCapability)),
		},
	}
	if _, err := CanonicalCacheKey(req.CacheKey); err != nil || req.CommitmentID == "" {
		return GatewayRequest{}, ErrGatewayRoute
	}
	return req, nil
}

type GatewayHTTPPolicy struct {
	MaxConcurrentRequests uint32
	RateLimitRequests     uint32
	RateLimitWindow       time.Duration
}

type gatewayRateEntry struct {
	windowStart time.Time
	requests    uint32
}

type gatewayAbuseGuard struct {
	sem        chan struct{}
	rate       uint32
	window     time.Duration
	mu         sync.Mutex
	clients    map[string]gatewayRateEntry
}

func newGatewayAbuseGuard(policy GatewayHTTPPolicy) (*gatewayAbuseGuard, error) {
	if policy.MaxConcurrentRequests == 0 || policy.RateLimitRequests == 0 || policy.RateLimitWindow <= 0 {
		return nil, fmt.Errorf("%w: invalid gateway abuse policy", ErrGatewayRoute)
	}
	return &gatewayAbuseGuard{
		sem: make(chan struct{}, policy.MaxConcurrentRequests),
		rate: policy.RateLimitRequests,
		window: policy.RateLimitWindow,
		clients: make(map[string]gatewayRateEntry),
	}, nil
}

func (g *gatewayAbuseGuard) allowClient(remoteAddr string, now time.Time) (bool, time.Duration) {
	host, _, err := net.SplitHostPort(remoteAddr)
	if err != nil || strings.TrimSpace(host) == "" {
		host = strings.TrimSpace(remoteAddr)
	}
	if host == "" {
		host = "unknown"
	}
	now = now.UTC()
	g.mu.Lock()
	defer g.mu.Unlock()
	entry := g.clients[host]
	if entry.windowStart.IsZero() || now.Sub(entry.windowStart) >= g.window {
		g.clients[host] = gatewayRateEntry{windowStart: now, requests: 1}
		return true, 0
	}
	if entry.requests >= g.rate {
		return false, g.window - now.Sub(entry.windowStart)
	}
	entry.requests++
	g.clients[host] = entry
	return true, 0
}

func (g *gatewayAbuseGuard) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		allowed, retryAfter := g.allowClient(r.RemoteAddr, time.Now())
		if !allowed {
			seconds := int64(retryAfter.Round(time.Second) / time.Second)
			if seconds < 1 { seconds = 1 }
			w.Header().Set("Retry-After", strconv.FormatInt(seconds, 10))
			http.Error(w, "gateway rate limit exceeded", http.StatusTooManyRequests)
			return
		}
		select {
		case g.sem <- struct{}{}:
			defer func() { <-g.sem }()
			next.ServeHTTP(w, r)
		default:
			w.Header().Set("Retry-After", "1")
			http.Error(w, "gateway concurrency limit exceeded", http.StatusTooManyRequests)
		}
	})
}

type GatewayHTTPService struct {
	server *http.Server
	ln     net.Listener
}

func NewGatewayHTTPService(listenAddr string, handler GatewayHTTPHandler) (*GatewayHTTPService, error) {
	return NewGatewayHTTPServiceWithPolicy(listenAddr, handler, GatewayHTTPPolicy{
		MaxConcurrentRequests: 128,
		RateLimitRequests: 240,
		RateLimitWindow: time.Minute,
	})
}

func NewGatewayHTTPServiceWithPolicy(listenAddr string, handler GatewayHTTPHandler, policy GatewayHTTPPolicy) (*GatewayHTTPService, error) {
	listenAddr = strings.TrimSpace(listenAddr)
	if listenAddr == "" {
		return nil, fmt.Errorf("%w: empty gateway listen address", ErrGatewayRoute)
	}
	guard, err := newGatewayAbuseGuard(policy)
	if err != nil { return nil, err }
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	return &GatewayHTTPService{
		server: &http.Server{
			Handler: guard.wrap(handler),
			ReadHeaderTimeout: 5 * time.Second,
			IdleTimeout: 30 * time.Second,
		},
		ln: ln,
	}, nil
}

func (s *GatewayHTTPService) Addr() net.Addr {
	if s == nil || s.ln == nil {
		return nil
	}
	return s.ln.Addr()
}

func (s *GatewayHTTPService) Run(ctx context.Context) error {
	if s == nil || s.server == nil || s.ln == nil {
		return ErrGatewayRoute
	}
	errCh := make(chan error, 1)
	go func() {
		errCh <- s.server.Serve(s.ln)
	}()
	select {
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	case <-ctx.Done():
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.server.Shutdown(shutdownCtx); err != nil {
			_ = s.server.Close()
			return err
		}
		err := <-errCh
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			return err
		}
		return nil
	}
}
