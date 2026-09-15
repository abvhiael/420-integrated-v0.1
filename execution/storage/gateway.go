package storage

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"sort"
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

type GatewayCapability string

const (
	GatewayCapabilityCache GatewayCapability = "cache"
	GatewayCapabilityStore GatewayCapability = "store"
)

type GatewayCandidate struct {
	ProviderID string
	NodeID     string
	Capability GatewayCapability
	Priority   uint32
	Active     bool
	Source     GatewaySource
}

type GatewayDiscovery interface {
	DiscoverGatewaySources(context.Context, GatewayRequest) ([]GatewayCandidate, error)
}

type GatewayAttempt struct {
	Tier       string
	Source     int
	ProviderID string
	NodeID     string
	Error      string
}

type GatewayResult struct {
	Payload    []byte
	Tier       string
	Source     int
	ProviderID string
	NodeID     string
	Attempts   []GatewayAttempt
}

type GatewayRouter struct {
	Cache     []GatewaySource
	Store     []GatewaySource
	Discovery GatewayDiscovery
}

type gatewayRouteSource struct {
	Source     GatewaySource
	ProviderID string
	NodeID     string
}

func (g GatewayRouter) Route(ctx context.Context, req GatewayRequest) (GatewayResult, error) {
	if _, err := CanonicalCacheKey(req.CacheKey); err != nil || strings.TrimSpace(req.CommitmentID) == "" {
		return GatewayResult{}, ErrGatewayRoute
	}
	attempts := make([]GatewayAttempt, 0, len(g.Cache)+len(g.Store))
	cacheSources := make([]gatewayRouteSource, 0, len(g.Cache))
	storeSources := make([]gatewayRouteSource, 0, len(g.Store))
	if g.Discovery != nil {
		candidates, err := g.Discovery.DiscoverGatewaySources(ctx, req)
		if err != nil {
			attempts = append(attempts, GatewayAttempt{Tier: "discovery", Source: -1, Error: err.Error()})
		} else {
			sort.SliceStable(candidates, func(i, j int) bool {
				left, right := candidates[i], candidates[j]
				if left.Capability != right.Capability {
					return gatewayCapabilityRank(left.Capability) < gatewayCapabilityRank(right.Capability)
				}
				if left.Priority != right.Priority { return left.Priority < right.Priority }
				if strings.ToLower(left.ProviderID) != strings.ToLower(right.ProviderID) {
					return strings.ToLower(left.ProviderID) < strings.ToLower(right.ProviderID)
				}
				return strings.ToLower(left.NodeID) < strings.ToLower(right.NodeID)
			})
			seen := make(map[string]struct{}, len(candidates))
			for _, candidate := range candidates {
				if !candidate.Active || candidate.Source == nil || strings.TrimSpace(candidate.ProviderID) == "" || strings.TrimSpace(candidate.NodeID) == "" {
					continue
				}
				if candidate.Capability != GatewayCapabilityCache && candidate.Capability != GatewayCapabilityStore { continue }
				key := strings.ToLower(string(candidate.Capability) + "\x00" + candidate.ProviderID + "\x00" + candidate.NodeID)
				if _, ok := seen[key]; ok { continue }
				seen[key] = struct{}{}
				routeSource := gatewayRouteSource{Source: candidate.Source, ProviderID: candidate.ProviderID, NodeID: candidate.NodeID}
				if candidate.Capability == GatewayCapabilityCache {
					cacheSources = append(cacheSources, routeSource)
				} else {
					storeSources = append(storeSources, routeSource)
				}
			}
		}
	}
	for _, source := range g.Cache { cacheSources = append(cacheSources, gatewayRouteSource{Source: source}) }
	for _, source := range g.Store { storeSources = append(storeSources, gatewayRouteSource{Source: source}) }
	try := func(tier string, sources []gatewayRouteSource) (GatewayResult, bool) {
		for i, source := range sources {
			if source.Source == nil {
				attempts = append(attempts, GatewayAttempt{Tier: tier, Source: i, ProviderID: source.ProviderID, NodeID: source.NodeID, Error: ErrGatewayRoute.Error()})
				continue
			}
			payload, err := source.Source.FetchGatewayObject(ctx, req)
			if err == nil { err = verifyCachePayload(req.CacheKey, payload) }
			if err == nil {
				return GatewayResult{Payload: payload, Tier: tier, Source: i, ProviderID: source.ProviderID, NodeID: source.NodeID, Attempts: append([]GatewayAttempt(nil), attempts...)}, true
			}
			attempts = append(attempts, GatewayAttempt{Tier: tier, Source: i, ProviderID: source.ProviderID, NodeID: source.NodeID, Error: err.Error()})
			if ctx.Err() != nil { return GatewayResult{}, false }
		}
		return GatewayResult{}, false
	}
	if result, ok := try("cache", cacheSources); ok { return result, nil }
	if result, ok := try("store", storeSources); ok { return result, nil }
	return GatewayResult{Attempts: attempts}, ErrGatewayRoute
}

func gatewayCapabilityRank(capability GatewayCapability) int {
	switch capability {
	case GatewayCapabilityCache:
		return 0
	case GatewayCapabilityStore:
		return 1
	default:
		return 2
	}
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
