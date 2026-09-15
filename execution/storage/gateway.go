package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

var ErrGatewayRoute = errors.New("gateway route failure")

type GatewayRequest struct {
	CacheKey     CacheKey
	CommitmentID string
}

type GatewaySource interface {
	FetchGatewayObject(context.Context, GatewayRequest) ([]byte, error)
}

type GatewayAttempt struct {
	Tier   string
	Source int
	Error  string
}

type GatewayResult struct {
	Payload  []byte
	Tier     string
	Source   int
	Attempts []GatewayAttempt
}

type GatewayRouter struct {
	Cache []GatewaySource
	Store []GatewaySource
}

func (g GatewayRouter) Route(ctx context.Context, req GatewayRequest) (GatewayResult, error) {
	if _, err := CanonicalCacheKey(req.CacheKey); err != nil || strings.TrimSpace(req.CommitmentID) == "" {
		return GatewayResult{}, ErrGatewayRoute
	}
	attempts := make([]GatewayAttempt, 0, len(g.Cache)+len(g.Store))
	try := func(tier string, sources []GatewaySource) (GatewayResult, bool) {
		for i, source := range sources {
			if source == nil {
				attempts = append(attempts, GatewayAttempt{Tier: tier, Source: i, Error: ErrGatewayRoute.Error()})
				continue
			}
			payload, err := source.FetchGatewayObject(ctx, req)
			if err == nil {
				err = verifyCachePayload(req.CacheKey, payload)
			}
			if err == nil {
				return GatewayResult{Payload: payload, Tier: tier, Source: i, Attempts: append([]GatewayAttempt(nil), attempts...)}, true
			}
			attempts = append(attempts, GatewayAttempt{Tier: tier, Source: i, Error: err.Error()})
			if ctx.Err() != nil {
				return GatewayResult{}, false
			}
		}
		return GatewayResult{}, false
	}
	if result, ok := try("cache", g.Cache); ok {
		return result, nil
	}
	if result, ok := try("store", g.Store); ok {
		return result, nil
	}
	return GatewayResult{Attempts: attempts}, ErrGatewayRoute
}

type HTTPGatewayCacheSource struct {
	BaseURL string
	Client  *http.Client
	Token   string
}

func (s HTTPGatewayCacheSource) FetchGatewayObject(ctx context.Context, req GatewayRequest) ([]byte, error) {
	base := strings.TrimRight(strings.TrimSpace(s.BaseURL), "/")
	if base == "" { return nil, ErrGatewayRoute }
	q := url.Values{}
	q.Set("object_id", req.CacheKey.ObjectID)
	q.Set("manifest_id", req.CacheKey.ManifestID)
	q.Set("shard_index", strconv.FormatUint(uint64(req.CacheKey.ShardIndex), 10))
	q.Set("shard_root", req.CacheKey.ShardRoot)
	q.Set("size_bytes", strconv.FormatUint(req.CacheKey.SizeBytes, 10))
	return gatewayHTTPGet(ctx, s.Client, base+"/v1/cache?"+q.Encode(), s.Token, req.CacheKey.SizeBytes)
}

type HTTPGatewayStoreSource struct {
	BaseURL string
	Client  *http.Client
	Token   string
}

func (s HTTPGatewayStoreSource) FetchGatewayObject(ctx context.Context, req GatewayRequest) ([]byte, error) {
	base := strings.TrimRight(strings.TrimSpace(s.BaseURL), "/")
	commitment := strings.TrimSpace(req.CommitmentID)
	if base == "" || commitment == "" { return nil, ErrGatewayRoute }
	return gatewayHTTPGet(ctx, s.Client, base+"/v1/shards/"+url.PathEscape(commitment), s.Token, req.CacheKey.SizeBytes)
}

func gatewayHTTPGet(ctx context.Context, client *http.Client, endpoint, token string, size uint64) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil { return nil, err }
	if strings.TrimSpace(token) != "" { req.Header.Set("Authorization", "Bearer "+token) }
	if client == nil { client = http.DefaultClient }
	resp, err := client.Do(req)
	if err != nil { return nil, err }
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK { return nil, fmt.Errorf("%w: upstream status %d", ErrGatewayRoute, resp.StatusCode) }
	payload, err := io.ReadAll(io.LimitReader(resp.Body, int64(size)+1))
	if err != nil { return nil, err }
	if uint64(len(payload)) != size { return nil, ErrCacheIntegrity }
	return payload, nil
}
