package storage

import (
	"context"
	"errors"
	"strings"
)

var ErrDeveloperAPI = errors.New("developer resource api failure")

const DeveloperAPIVersion = "v1"

type DeveloperAccessMode string

const (
	DeveloperAccessPublic  DeveloperAccessMode = "public"
	DeveloperAccessPrivate DeveloperAccessMode = "private"
)

type DeveloperObjectRef struct {
	ObjectID     string `json:"object_id"`
	ManifestID   string `json:"manifest_id"`
	ShardIndex   uint32 `json:"shard_index"`
	ShardRoot    string `json:"shard_root"`
	SizeBytes    uint64 `json:"size_bytes"`
	CommitmentID string `json:"commitment_id"`
}

type DeveloperReadAccess struct {
	Mode       DeveloperAccessMode `json:"mode"`
	Subject    string              `json:"subject,omitempty"`
	SessionID  string              `json:"session_id,omitempty"`
	Capability string              `json:"capability,omitempty"`
}

type DeveloperRetrieveRequest struct {
	Version string              `json:"version"`
	Object  DeveloperObjectRef  `json:"object"`
	Access  DeveloperReadAccess `json:"access"`
}

type DeveloperRouteMetadata struct {
	Tier       string `json:"tier"`
	ProviderID string `json:"provider_id,omitempty"`
	NodeID     string `json:"node_id,omitempty"`
}

type DeveloperRetrieveResult struct {
	Version string                 `json:"version"`
	Object  DeveloperObjectRef     `json:"object"`
	Route   DeveloperRouteMetadata `json:"route"`
	Payload []byte                 `json:"payload"`
}

type DeveloperResourceAPI interface {
	Retrieve(context.Context, DeveloperRetrieveRequest) (DeveloperRetrieveResult, error)
}

type GatewayDeveloperAPI struct {
	Router GatewayRouter
}

func (a GatewayDeveloperAPI) Retrieve(ctx context.Context, req DeveloperRetrieveRequest) (DeveloperRetrieveResult, error) {
	gatewayReq, object, err := normalizeDeveloperRetrieveRequest(req)
	if err != nil {
		return DeveloperRetrieveResult{}, err
	}
	result, err := a.Router.Route(ctx, gatewayReq)
	if err != nil {
		return DeveloperRetrieveResult{}, err
	}
	return DeveloperRetrieveResult{
		Version: DeveloperAPIVersion,
		Object:  object,
		Route: DeveloperRouteMetadata{
			Tier:       result.Tier,
			ProviderID: result.ProviderID,
			NodeID:     result.NodeID,
		},
		Payload: append([]byte(nil), result.Payload...),
	}, nil
}

func normalizeDeveloperRetrieveRequest(req DeveloperRetrieveRequest) (GatewayRequest, DeveloperObjectRef, error) {
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = DeveloperAPIVersion
	}
	if version != DeveloperAPIVersion {
		return GatewayRequest{}, DeveloperObjectRef{}, ErrDeveloperAPI
	}

	object := req.Object
	object.ObjectID = strings.TrimSpace(object.ObjectID)
	object.ManifestID = strings.TrimSpace(object.ManifestID)
	object.ShardRoot = strings.TrimSpace(object.ShardRoot)
	object.CommitmentID = strings.TrimSpace(object.CommitmentID)
	cacheKey := CacheKey{
		ObjectID:   object.ObjectID,
		ManifestID: object.ManifestID,
		ShardIndex: object.ShardIndex,
		ShardRoot:  object.ShardRoot,
		SizeBytes:  object.SizeBytes,
	}
	if _, err := CanonicalCacheKey(cacheKey); err != nil || object.CommitmentID == "" {
		return GatewayRequest{}, DeveloperObjectRef{}, ErrDeveloperAPI
	}

	access := req.Access
	if access.Mode == "" {
		access.Mode = DeveloperAccessPublic
	}
	gatewayAccess := GatewayAccess{}
	switch access.Mode {
	case DeveloperAccessPublic:
		gatewayAccess.Mode = GatewayAccessPublic
	case DeveloperAccessPrivate:
		gatewayAccess = GatewayAccess{
			Mode:       GatewayAccessPrivate,
			Subject:    strings.TrimSpace(access.Subject),
			SessionID:  strings.TrimSpace(access.SessionID),
			Capability: strings.ToLower(strings.TrimSpace(access.Capability)),
		}
		if gatewayAccess.Subject == "" || gatewayAccess.SessionID == "" || gatewayAccess.Capability != GatewayAccessRead {
			return GatewayRequest{}, DeveloperObjectRef{}, ErrDeveloperAPI
		}
	default:
		return GatewayRequest{}, DeveloperObjectRef{}, ErrDeveloperAPI
	}

	return GatewayRequest{
		CacheKey:     cacheKey,
		CommitmentID: object.CommitmentID,
		Access:       gatewayAccess,
	}, object, nil
}
