package storage

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
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

type GatewayHTTPService struct {
	server *http.Server
	ln     net.Listener
}

func NewGatewayHTTPService(listenAddr string, handler GatewayHTTPHandler) (*GatewayHTTPService, error) {
	listenAddr = strings.TrimSpace(listenAddr)
	if listenAddr == "" {
		return nil, fmt.Errorf("%w: empty gateway listen address", ErrGatewayRoute)
	}
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	return &GatewayHTTPService{
		server: &http.Server{
			Handler: handler,
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
