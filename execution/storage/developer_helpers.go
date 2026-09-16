package storage

import (
	"context"
	"errors"
	"strings"
	"time"
)

var ErrDeveloperResourceHelper = errors.New("developer resource helper failure")

type DeveloperCacheState string

const (
	DeveloperCacheMissing DeveloperCacheState = "missing"
	DeveloperCacheFresh   DeveloperCacheState = "fresh"
	DeveloperCacheExpired DeveloperCacheState = "expired"
)

type DeveloperCacheStatus struct {
	Version       string              `json:"version"`
	Authoritative bool                `json:"authoritative"`
	Object        DeveloperObjectRef  `json:"object"`
	State         DeveloperCacheState `json:"state"`
	StoredAt      time.Time           `json:"stored_at,omitempty"`
	ExpiresAt     time.Time           `json:"expires_at,omitempty"`
	LastAccess    time.Time           `json:"last_access,omitempty"`
	HitCount      uint64              `json:"hit_count,omitempty"`
}

func DeveloperCacheStatusForObject(state CacheState, object DeveloperObjectRef, now time.Time) (DeveloperCacheStatus, error) {
	key := CacheKey{ObjectID: strings.TrimSpace(object.ObjectID), ManifestID: strings.TrimSpace(object.ManifestID), ShardIndex: object.ShardIndex, ShardRoot: strings.TrimSpace(object.ShardRoot), SizeBytes: object.SizeBytes}
	id, err := CanonicalCacheKey(key)
	if err != nil || strings.TrimSpace(object.CommitmentID) == "" {
		return DeveloperCacheStatus{}, ErrDeveloperResourceHelper
	}
	if now.IsZero() { now = time.Now().UTC() } else { now = now.UTC() }
	status := DeveloperCacheStatus{Version: DeveloperAPIVersion, Authoritative: false, Object: object, State: DeveloperCacheMissing}
	entry, ok := state.Entries[id]
	if !ok { return status, nil }
	if entry.Key.SizeBytes != key.SizeBytes || !equalHex(entry.Key.ManifestID, key.ManifestID) || !equalHex(entry.Key.ShardRoot, key.ShardRoot) {
		return DeveloperCacheStatus{}, ErrDeveloperResourceHelper
	}
	status.StoredAt, status.ExpiresAt, status.LastAccess, status.HitCount = entry.StoredAt.UTC(), entry.ExpiresAt.UTC(), entry.LastAccess.UTC(), entry.HitCount
	if entry.ExpiresAt.After(now) { status.State = DeveloperCacheFresh } else { status.State = DeveloperCacheExpired }
	return status, nil
}

type DeveloperRepairStatus struct {
	Version         string             `json:"version"`
	Authoritative   bool               `json:"authoritative"`
	ObjectID        string             `json:"object_id"`
	ManifestID      string             `json:"manifest_id"`
	Sealed          bool               `json:"sealed"`
	Retrievable     bool               `json:"retrievable"`
	Recoverable     bool               `json:"recoverable"`
	Degraded        bool               `json:"degraded"`
	LiveShards      uint32             `json:"live_shards"`
	RequiredShards  uint32             `json:"required_shards"`
	TargetLiveShards uint32            `json:"target_live_shards"`
	ReplaceShards   []uint32           `json:"replace_shards"`
}

func DeveloperRepairStatusForObject(object DeveloperObjectRef, manifest RepairManifest, policy RepairPolicy) (DeveloperRepairStatus, error) {
	if strings.TrimSpace(object.ObjectID) == "" || strings.TrimSpace(object.ManifestID) == "" || strings.TrimSpace(object.ShardRoot) == "" || object.SizeBytes == 0 || strings.TrimSpace(object.CommitmentID) == "" {
		return DeveloperRepairStatus{}, ErrDeveloperResourceHelper
	}
	if !equalHex(object.ObjectID, manifest.ObjectID) || !equalHex(object.ManifestID, manifest.ManifestID) {
		return DeveloperRepairStatus{}, ErrDeveloperResourceHelper
	}
	plan, err := PlanRepair(manifest, policy)
	if err != nil { return DeveloperRepairStatus{}, err }
	return DeveloperRepairStatus{
		Version: DeveloperAPIVersion, Authoritative: false, ObjectID: manifest.ObjectID, ManifestID: manifest.ManifestID,
		Sealed: manifest.Sealed, Retrievable: plan.Recoverable, Recoverable: plan.Recoverable, Degraded: plan.Degraded,
		LiveShards: plan.LiveShards, RequiredShards: plan.RequiredShards, TargetLiveShards: plan.TargetLiveShards,
		ReplaceShards: append([]uint32(nil), plan.ReplaceShards...),
	}, nil
}

type DeveloperRetrievalPolicy struct {
	AllowCache         bool `json:"allow_cache"`
	AllowStoreFallback bool `json:"allow_store_fallback"`
}

type DeveloperGatewayAttempt struct {
	Tier       string `json:"tier"`
	ProviderID string `json:"provider_id,omitempty"`
	NodeID     string `json:"node_id,omitempty"`
	Error      string `json:"error,omitempty"`
}

type DeveloperGatewayDiagnostics struct {
	Version       string                    `json:"version"`
	Authoritative bool                      `json:"authoritative"`
	SelectedTier  string                    `json:"selected_tier,omitempty"`
	ProviderID    string                    `json:"provider_id,omitempty"`
	NodeID        string                    `json:"node_id,omitempty"`
	FallbackUsed  bool                      `json:"fallback_used"`
	Attempts      []DeveloperGatewayAttempt `json:"attempts"`
}

type DeveloperGatewayResult struct {
	Result      DeveloperRetrieveResult      `json:"result"`
	Diagnostics DeveloperGatewayDiagnostics  `json:"diagnostics"`
}

type DeveloperGatewayHelper struct { Router GatewayRouter }

func (h DeveloperGatewayHelper) Retrieve(ctx context.Context, req DeveloperRetrieveRequest, policy DeveloperRetrievalPolicy) (DeveloperGatewayResult, error) {
	gatewayReq, object, err := normalizeDeveloperRetrieveRequest(req)
	if err != nil { return DeveloperGatewayResult{}, err }
	if !policy.AllowCache && !policy.AllowStoreFallback { return DeveloperGatewayResult{}, ErrDeveloperResourceHelper }

	router := h.Router
	if !policy.AllowCache { router.Cache = nil }
	if !policy.AllowStoreFallback { router.Store = nil }
	result, routeErr := router.Route(ctx, gatewayReq)
	diagnostics := DeveloperGatewayDiagnostics{Version: DeveloperAPIVersion, Authoritative: false, SelectedTier: result.Tier, ProviderID: result.ProviderID, NodeID: result.NodeID}
	for _, attempt := range result.Attempts {
		diagnostics.Attempts = append(diagnostics.Attempts, DeveloperGatewayAttempt{Tier: attempt.Tier, ProviderID: attempt.ProviderID, NodeID: attempt.NodeID, Error: attempt.Error})
	}
	if result.Tier == "store" && policy.AllowCache { diagnostics.FallbackUsed = true }
	if routeErr != nil { return DeveloperGatewayResult{Diagnostics: diagnostics}, routeErr }
	return DeveloperGatewayResult{Result: DeveloperRetrieveResult{Version: DeveloperAPIVersion, Object: object, Route: DeveloperRouteMetadata{Tier: result.Tier, ProviderID: result.ProviderID, NodeID: result.NodeID}, Payload: append([]byte(nil), result.Payload...)}, Diagnostics: diagnostics}, nil
}
