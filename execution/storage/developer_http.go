package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	DeveloperRetrievePath       = "/v1/resources/retrieve"
	DeveloperHeaderAccessMode   = "X-420-Access-Mode"
	DeveloperHeaderSubject      = "X-420-Subject"
	DeveloperHeaderSessionID    = "X-420-Session-ID"
	DeveloperHeaderCapability   = "X-420-Capability"
	DeveloperHeaderRouteTier    = "X-420-Route-Tier"
	DeveloperHeaderProviderID   = "X-420-Provider-ID"
	DeveloperHeaderNodeID       = "X-420-Node-ID"
	DeveloperDefaultMaxURIBytes = 8192
	DeveloperDefaultMaxHeaders  = 16384
)

type DeveloperHTTPError struct {
	Version string `json:"version"`
	Error   string `json:"error"`
	Code    string `json:"code"`
}

type DeveloperHTTPPolicy struct {
	RequestTimeout     time.Duration
	MaxRequestURIBytes int
	MaxHeaderBytes     int
}

func DefaultDeveloperHTTPPolicy() DeveloperHTTPPolicy {
	return DeveloperHTTPPolicy{
		RequestTimeout:     15 * time.Second,
		MaxRequestURIBytes: DeveloperDefaultMaxURIBytes,
		MaxHeaderBytes:     DeveloperDefaultMaxHeaders,
	}
}

type DeveloperHTTPHandler struct {
	API    DeveloperResourceAPI
	Policy DeveloperHTTPPolicy
}

func NewDeveloperHTTPHandler(api DeveloperResourceAPI) DeveloperHTTPHandler {
	return DeveloperHTTPHandler{API: api, Policy: DefaultDeveloperHTTPPolicy()}
}

func (h DeveloperHTTPHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	policy := h.Policy
	if policy.RequestTimeout <= 0 || policy.MaxRequestURIBytes <= 0 || policy.MaxHeaderBytes <= 0 {
		policy = DefaultDeveloperHTTPPolicy()
	}
	if r.URL.Path != DeveloperRetrievePath {
		http.NotFound(w, r)
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		w.Header().Set("Allow", "GET, HEAD")
		writeDeveloperHTTPError(w, http.StatusMethodNotAllowed, "method_not_allowed", "method not allowed")
		return
	}
	if len(r.RequestURI) > policy.MaxRequestURIBytes {
		writeDeveloperHTTPError(w, http.StatusRequestURITooLong, "request_uri_too_large", "request URI exceeds limit")
		return
	}
	if developerHeaderBytes(r.Header) > policy.MaxHeaderBytes {
		writeDeveloperHTTPError(w, http.StatusRequestHeaderFieldsTooLarge, "headers_too_large", "request headers exceed limit")
		return
	}
	if r.ContentLength > 0 || (r.Body != nil && r.ContentLength < 0) {
		writeDeveloperHTTPError(w, http.StatusBadRequest, "request_body_not_allowed", "request body not allowed")
		return
	}
	if h.API == nil {
		writeDeveloperHTTPError(w, http.StatusServiceUnavailable, "api_unavailable", "developer API unavailable")
		return
	}

	req, err := developerRetrieveRequestFromHTTP(r)
	if err != nil {
		writeDeveloperHTTPError(w, http.StatusBadRequest, "invalid_request", "invalid developer retrieval request")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), policy.RequestTimeout)
	defer cancel()
	result, err := h.API.Retrieve(ctx, req)
	if err != nil {
		switch {
		case errors.Is(err, ErrDeveloperAPI):
			writeDeveloperHTTPError(w, http.StatusBadRequest, "invalid_request", "invalid developer retrieval request")
		case errors.Is(err, ErrGatewayUnauthorized):
			writeDeveloperHTTPError(w, http.StatusForbidden, "access_denied", "resource access denied")
		case errors.Is(err, context.Canceled), errors.Is(err, context.DeadlineExceeded):
			writeDeveloperHTTPError(w, http.StatusGatewayTimeout, "request_timeout", "resource request timed out")
		default:
			writeDeveloperHTTPError(w, http.StatusBadGateway, "resource_unavailable", "resource unavailable")
		}
		return
	}

	etag := developerObjectETag(result.Object)
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("ETag", etag)
	w.Header().Set(DeveloperHeaderRouteTier, result.Route.Tier)
	if result.Route.ProviderID != "" {
		w.Header().Set(DeveloperHeaderProviderID, result.Route.ProviderID)
	}
	if result.Route.NodeID != "" {
		w.Header().Set(DeveloperHeaderNodeID, result.Route.NodeID)
	}
	if gatewayETagMatches(r.Header.Get("If-None-Match"), etag) {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	payload := result.Payload
	status := http.StatusOK
	if rangeHeader := strings.TrimSpace(r.Header.Get("Range")); rangeHeader != "" {
		start, end, ok := gatewayByteRange(rangeHeader, int64(len(payload)))
		if !ok {
			w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", len(payload)))
			w.WriteHeader(http.StatusRequestedRangeNotSatisfiable)
			return
		}
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, len(payload)))
		payload = payload[start : end+1]
		status = http.StatusPartialContent
	}
	w.Header().Set("Content-Length", strconv.Itoa(len(payload)))
	w.WriteHeader(status)
	if r.Method != http.MethodHead {
		_, _ = w.Write(payload)
	}
}

func developerRetrieveRequestFromHTTP(r *http.Request) (DeveloperRetrieveRequest, error) {
	q := r.URL.Query()
	shardIndex, err := strconv.ParseUint(strings.TrimSpace(q.Get("shard_index")), 10, 32)
	if err != nil {
		return DeveloperRetrieveRequest{}, ErrDeveloperAPI
	}
	sizeBytes, err := strconv.ParseUint(strings.TrimSpace(q.Get("size_bytes")), 10, 64)
	if err != nil {
		return DeveloperRetrieveRequest{}, ErrDeveloperAPI
	}
	mode := DeveloperAccessMode(strings.ToLower(strings.TrimSpace(r.Header.Get(DeveloperHeaderAccessMode))))
	if mode == "" {
		mode = DeveloperAccessPublic
	}
	req := DeveloperRetrieveRequest{
		Version: DeveloperAPIVersion,
		Object: DeveloperObjectRef{
			ObjectID:     strings.TrimSpace(q.Get("object_id")),
			ManifestID:   strings.TrimSpace(q.Get("manifest_id")),
			ShardIndex:   uint32(shardIndex),
			ShardRoot:    strings.TrimSpace(q.Get("shard_root")),
			SizeBytes:    sizeBytes,
			CommitmentID: strings.TrimSpace(q.Get("commitment_id")),
		},
		Access: DeveloperReadAccess{
			Mode:       mode,
			Subject:    strings.TrimSpace(r.Header.Get(DeveloperHeaderSubject)),
			SessionID:  strings.TrimSpace(r.Header.Get(DeveloperHeaderSessionID)),
			Capability: strings.ToLower(strings.TrimSpace(r.Header.Get(DeveloperHeaderCapability))),
		},
	}
	if _, _, err := normalizeDeveloperRetrieveRequest(req); err != nil {
		return DeveloperRetrieveRequest{}, err
	}
	return req, nil
}

func developerObjectETag(object DeveloperObjectRef) string {
	key := CacheKey{ObjectID: object.ObjectID, ManifestID: object.ManifestID, ShardIndex: object.ShardIndex, ShardRoot: object.ShardRoot, SizeBytes: object.SizeBytes}
	canonical, _ := CanonicalCacheKey(key)
	sum := sha256.Sum256([]byte(canonical + "\n" + object.CommitmentID))
	return `"` + hex.EncodeToString(sum[:]) + `"`
}

func developerHeaderBytes(headers http.Header) int {
	total := 0
	for key, values := range headers {
		total += len(key)
		for _, value := range values {
			total += len(value)
		}
	}
	return total
}

func writeDeveloperHTTPError(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(DeveloperHTTPError{Version: DeveloperAPIVersion, Error: message, Code: code})
}

type DeveloperHTTPTransportPolicy struct {
	TLSCertFile  string
	TLSKeyFile   string
	AllowedHosts []string
}

type DeveloperHTTPService struct {
	server    *http.Server
	ln        net.Listener
	tlsConfig *tls.Config
}

func NewDeveloperHTTPService(listenAddr string, handler DeveloperHTTPHandler, transport DeveloperHTTPTransportPolicy) (*DeveloperHTTPService, error) {
	listenAddr = strings.TrimSpace(listenAddr)
	if listenAddr == "" {
		return nil, fmt.Errorf("%w: empty developer listen address", ErrDeveloperAPI)
	}
	policy := handler.Policy
	if policy.RequestTimeout <= 0 || policy.MaxRequestURIBytes <= 0 || policy.MaxHeaderBytes <= 0 {
		policy = DefaultDeveloperHTTPPolicy()
		handler.Policy = policy
	}
	allowed, err := validateGatewayAllowedHosts(transport.AllowedHosts)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrDeveloperAPI, err)
	}
	certFile := strings.TrimSpace(transport.TLSCertFile)
	keyFile := strings.TrimSpace(transport.TLSKeyFile)
	if (certFile == "") != (keyFile == "") {
		return nil, fmt.Errorf("%w: TLS certificate and key must be configured together", ErrDeveloperAPI)
	}
	publicBind := !gatewayListenIsLoopback(listenAddr)
	if publicBind && (certFile == "" || len(allowed) == 0) {
		return nil, fmt.Errorf("%w: non-loopback developer API requires TLS and allowed hosts", ErrDeveloperAPI)
	}
	var tlsConfig *tls.Config
	if certFile != "" {
		cert, err := tls.LoadX509KeyPair(certFile, keyFile)
		if err != nil {
			return nil, fmt.Errorf("%w: TLS: %v", ErrDeveloperAPI, err)
		}
		tlsConfig = &tls.Config{Certificates: []tls.Certificate{cert}, MinVersion: tls.VersionTLS12}
	}
	ln, err := net.Listen("tcp", listenAddr)
	if err != nil {
		return nil, err
	}
	wrapped := gatewayHostGuard(allowed, handler)
	return &DeveloperHTTPService{
		server: &http.Server{
			Handler:           wrapped,
			ReadHeaderTimeout: 5 * time.Second,
			IdleTimeout:       30 * time.Second,
			MaxHeaderBytes:    policy.MaxHeaderBytes,
		},
		ln:        ln,
		tlsConfig: tlsConfig,
	}, nil
}

func (s *DeveloperHTTPService) Addr() net.Addr {
	if s == nil || s.ln == nil {
		return nil
	}
	return s.ln.Addr()
}

func (s *DeveloperHTTPService) Run(ctx context.Context) error {
	if s == nil || s.server == nil || s.ln == nil {
		return ErrDeveloperAPI
	}
	errCh := make(chan error, 1)
	go func() {
		ln := s.ln
		if s.tlsConfig != nil {
			ln = tls.NewListener(ln, s.tlsConfig.Clone())
		}
		errCh <- s.server.Serve(ln)
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
		_ = s.server.Shutdown(shutdownCtx)
		return ctx.Err()
	}
}
