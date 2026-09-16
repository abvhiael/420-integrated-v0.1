package storage420

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const retrievePath = "/v1/resources/retrieve"

type HTTPTransport struct {
	BaseURL string
	Client  *http.Client
}

func NewHTTPTransport(baseURL string, client *http.Client) (*HTTPTransport, error) {
	baseURL = strings.TrimRight(strings.TrimSpace(baseURL), "/")
	parsed, err := url.Parse(baseURL)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return nil, &Error{Kind: ErrorInvalidRequest, Detail: "invalid base URL", Err: err}
	}
	if parsed.Scheme != "https" && parsed.Hostname() != "127.0.0.1" && parsed.Hostname() != "localhost" && parsed.Hostname() != "::1" {
		return nil, &Error{Kind: ErrorInvalidRequest, Detail: "non-loopback SDK endpoint requires HTTPS"}
	}
	if client == nil {
		client = &http.Client{Timeout: 20 * time.Second}
	}
	return &HTTPTransport{BaseURL: baseURL, Client: client}, nil
}

func (t *HTTPTransport) Retrieve(ctx context.Context, req RetrieveRequest) (RetrieveResult, error) {
	if t == nil || t.Client == nil {
		return RetrieveResult{}, &Error{Kind: ErrorTransport, Detail: "nil HTTP transport"}
	}
	req = normalizeRetrieve(req)
	q := url.Values{}
	q.Set("object_id", req.Object.ObjectID)
	q.Set("manifest_id", req.Object.ManifestID)
	q.Set("shard_index", strconv.FormatUint(uint64(req.Object.ShardIndex), 10))
	q.Set("shard_root", req.Object.ShardRoot)
	q.Set("size_bytes", strconv.FormatUint(req.Object.SizeBytes, 10))
	q.Set("commitment_id", req.Object.CommitmentID)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, t.BaseURL+retrievePath+"?"+q.Encode(), nil)
	if err != nil {
		return RetrieveResult{}, &Error{Kind: ErrorTransport, Err: err}
	}
	httpReq.Header.Set("X-420-Access-Mode", string(req.Access.Mode))
	if req.Access.Mode == AccessPrivate {
		httpReq.Header.Set("X-420-Subject", req.Access.Subject)
		httpReq.Header.Set("X-420-Session-ID", req.Access.SessionID)
		httpReq.Header.Set("X-420-Capability", req.Access.Capability)
	}
	resp, err := t.Client.Do(httpReq)
	if err != nil {
		return RetrieveResult{}, &Error{Kind: ErrorTransport, Err: err}
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return RetrieveResult{}, decodeHTTPError(resp)
	}
	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return RetrieveResult{}, &Error{Kind: ErrorTransport, Err: err}
	}
	if uint64(len(payload)) != req.Object.SizeBytes {
		return RetrieveResult{}, &Error{Kind: ErrorIntegrity, Detail: "payload size does not match object reference"}
	}
	root := sha256.Sum256(payload)
	if !strings.EqualFold(hex.EncodeToString(root[:]), strings.TrimSpace(req.Object.ShardRoot)) {
		return RetrieveResult{}, &Error{Kind: ErrorIntegrity, Detail: "payload root does not match object reference"}
	}
	return RetrieveResult{
		Version: APIVersion,
		Object:  req.Object,
		Route: RouteMetadata{
			Tier:       resp.Header.Get("X-420-Route-Tier"),
			ProviderID: resp.Header.Get("X-420-Provider-ID"),
			NodeID:     resp.Header.Get("X-420-Node-ID"),
		},
		Payload: payload,
	}, nil
}

func (t *HTTPTransport) PrepareUpload(context.Context, UploadPrepareRequest) (UploadPlan, error) {
	return UploadPlan{}, &Error{Kind: ErrorUnsupported, Detail: "HTTP upload transport is not part of the v1 retrieval endpoint"}
}

func (t *HTTPTransport) Discover(context.Context, DiscoveryRequest) (DiscoveryResult, error) {
	return DiscoveryResult{}, &Error{Kind: ErrorUnsupported, Detail: "HTTP discovery transport is not exposed yet"}
}

func (t *HTTPTransport) Status(context.Context) (ResourceStatus, error) {
	return ResourceStatus{}, &Error{Kind: ErrorUnsupported, Detail: "HTTP status transport is not exposed yet"}
}

func decodeHTTPError(resp *http.Response) error {
	var envelope struct {
		Error string `json:"error"`
		Code  string `json:"code"`
	}
	_ = json.NewDecoder(io.LimitReader(resp.Body, 64<<10)).Decode(&envelope)
	kind := ErrorTransport
	switch resp.StatusCode {
	case http.StatusBadRequest, http.StatusRequestURITooLong, http.StatusRequestHeaderFieldsTooLarge:
		kind = ErrorInvalidRequest
	case http.StatusUnauthorized, http.StatusForbidden:
		kind = ErrorUnauthorized
	case http.StatusServiceUnavailable, http.StatusBadGateway, http.StatusGatewayTimeout:
		kind = ErrorUnavailable
	}
	detail := strings.TrimSpace(envelope.Error)
	if detail == "" {
		detail = fmt.Sprintf("HTTP %d", resp.StatusCode)
	}
	return &Error{Kind: kind, StatusCode: resp.StatusCode, Code: envelope.Code, Detail: detail}
}
