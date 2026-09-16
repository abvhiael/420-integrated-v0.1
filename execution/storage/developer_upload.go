package storage

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"
	"sync"
)

var ErrDeveloperUpload = errors.New("developer upload failure")

const DefaultDeveloperUploadMaxBytes uint64 = 64 << 20

type DeveloperUploadPreconditions struct {
	AgreementID          string `json:"agreement_id"`
	CapacityReservationID string `json:"capacity_reservation_id"`
	CommitmentID         string `json:"commitment_id"`
}

type DeveloperUploadPrepareRequest struct {
	Version        string                     `json:"version"`
	Object         DeveloperObjectRef         `json:"object"`
	IdempotencyKey string                     `json:"idempotency_key"`
	Preconditions  DeveloperUploadPreconditions `json:"preconditions"`
}

type DeveloperUploadPlan struct {
	Version        string                     `json:"version"`
	UploadID       string                     `json:"upload_id"`
	Object         DeveloperObjectRef         `json:"object"`
	IdempotencyKey string                     `json:"idempotency_key"`
	Preconditions  DeveloperUploadPreconditions `json:"preconditions"`
	ProviderID     string                     `json:"provider_id"`
	NodeID         string                     `json:"node_id"`
	ServiceID      string                     `json:"service_id"`
	Endpoint       string                     `json:"endpoint,omitempty"`
}

type DeveloperUploadReceipt struct {
	Version    string             `json:"version"`
	UploadID   string             `json:"upload_id"`
	Object     DeveloperObjectRef `json:"object"`
	ProviderID string             `json:"provider_id"`
	NodeID     string             `json:"node_id"`
	ServiceID  string             `json:"service_id"`
	SizeBytes  uint64             `json:"size_bytes"`
	ShardRoot  string             `json:"shard_root"`
}

type DeveloperUploadSink interface {
	StorePreparedUpload(context.Context, DeveloperUploadPlan, io.Reader) error
}

type DeveloperUploadSinkResolver interface {
	ResolveUploadSink(serviceID string) (DeveloperUploadSink, bool)
}

type DeveloperUploadCoordinator struct {
	Discovery ResourceDiscovery
	Sinks     DeveloperUploadSinkResolver
	MaxBytes  uint64

	mu       sync.Mutex
	receipts map[string]DeveloperUploadReceipt
}

func (c *DeveloperUploadCoordinator) Prepare(ctx context.Context, req DeveloperUploadPrepareRequest) (DeveloperUploadPlan, error) {
	if c == nil || c.Discovery == nil {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	if err := ctx.Err(); err != nil {
		return DeveloperUploadPlan{}, err
	}
	version := strings.TrimSpace(req.Version)
	if version == "" {
		version = DeveloperAPIVersion
	}
	if version != DeveloperAPIVersion {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	object := req.Object
	object.ObjectID = strings.TrimSpace(object.ObjectID)
	object.ManifestID = strings.TrimSpace(object.ManifestID)
	object.ShardRoot = strings.ToLower(strings.TrimSpace(object.ShardRoot))
	object.CommitmentID = strings.TrimSpace(object.CommitmentID)
	if object.CommitmentID == "" {
		object.CommitmentID = strings.TrimSpace(req.Preconditions.CommitmentID)
	}
	if _, err := CanonicalCacheKey(CacheKey{ObjectID: object.ObjectID, ManifestID: object.ManifestID, ShardIndex: object.ShardIndex, ShardRoot: object.ShardRoot, SizeBytes: object.SizeBytes}); err != nil {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	maxBytes := c.MaxBytes
	if maxBytes == 0 {
		maxBytes = DefaultDeveloperUploadMaxBytes
	}
	if object.SizeBytes == 0 || object.SizeBytes > maxBytes {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	idem := strings.TrimSpace(req.IdempotencyKey)
	pre := req.Preconditions
	pre.AgreementID = strings.TrimSpace(pre.AgreementID)
	pre.CapacityReservationID = strings.TrimSpace(pre.CapacityReservationID)
	pre.CommitmentID = strings.TrimSpace(pre.CommitmentID)
	if idem == "" || pre.AgreementID == "" || pre.CapacityReservationID == "" || pre.CommitmentID == "" || object.CommitmentID != pre.CommitmentID {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	endpoints, err := c.Discovery.DiscoverResources(ctx, ResourceDiscoveryRequest{Capabilities: []ResourceCapability{ResourceCapabilityStore}})
	if err != nil {
		return DeveloperUploadPlan{}, err
	}
	if len(endpoints) == 0 {
		return DeveloperUploadPlan{}, fmt.Errorf("%w: no store provider available", ErrDeveloperUpload)
	}
	selected := endpoints[0]
	if selected.State != ResourceServiceRunning || selected.ServiceID == "" {
		return DeveloperUploadPlan{}, ErrDeveloperUpload
	}
	identity := strings.Join([]string{DeveloperAPIVersion, object.ObjectID, object.ManifestID, fmt.Sprint(object.ShardIndex), object.ShardRoot, fmt.Sprint(object.SizeBytes), object.CommitmentID, idem, pre.AgreementID, pre.CapacityReservationID, selected.ProviderID, selected.NodeID, selected.ServiceID}, "\n")
	sum := sha256.Sum256([]byte(identity))
	return DeveloperUploadPlan{
		Version: DeveloperAPIVersion,
		UploadID: hex.EncodeToString(sum[:]),
		Object: object,
		IdempotencyKey: idem,
		Preconditions: pre,
		ProviderID: selected.ProviderID,
		NodeID: selected.NodeID,
		ServiceID: selected.ServiceID,
		Endpoint: selected.Endpoint,
	}, nil
}

func (c *DeveloperUploadCoordinator) Ingest(ctx context.Context, plan DeveloperUploadPlan, body io.Reader) (DeveloperUploadReceipt, error) {
	if c == nil || c.Sinks == nil || body == nil {
		return DeveloperUploadReceipt{}, ErrDeveloperUpload
	}
	if err := ctx.Err(); err != nil {
		return DeveloperUploadReceipt{}, err
	}
	if plan.Version != DeveloperAPIVersion || strings.TrimSpace(plan.UploadID) == "" || strings.TrimSpace(plan.IdempotencyKey) == "" || strings.TrimSpace(plan.ServiceID) == "" {
		return DeveloperUploadReceipt{}, ErrDeveloperUpload
	}
	maxBytes := c.MaxBytes
	if maxBytes == 0 {
		maxBytes = DefaultDeveloperUploadMaxBytes
	}
	if plan.Object.SizeBytes == 0 || plan.Object.SizeBytes > maxBytes {
		return DeveloperUploadReceipt{}, ErrDeveloperUpload
	}

	c.mu.Lock()
	if c.receipts != nil {
		if receipt, ok := c.receipts[plan.IdempotencyKey]; ok {
			c.mu.Unlock()
			if receipt.UploadID != plan.UploadID {
				return DeveloperUploadReceipt{}, fmt.Errorf("%w: idempotency conflict", ErrDeveloperUpload)
			}
			return receipt, nil
		}
	}
	c.mu.Unlock()

	staged, err := os.CreateTemp("", "420-upload-*")
	if err != nil {
		return DeveloperUploadReceipt{}, err
	}
	name := staged.Name()
	defer func() { _ = staged.Close(); _ = os.Remove(name) }()

	hash := sha256.New()
	limit := int64(plan.Object.SizeBytes) + 1
	written, err := io.Copy(io.MultiWriter(staged, hash), io.LimitReader(body, limit))
	if err != nil {
		return DeveloperUploadReceipt{}, err
	}
	if err := ctx.Err(); err != nil {
		return DeveloperUploadReceipt{}, err
	}
	if written != int64(plan.Object.SizeBytes) {
		return DeveloperUploadReceipt{}, fmt.Errorf("%w: size mismatch", ErrDeveloperUpload)
	}
	root := hex.EncodeToString(hash.Sum(nil))
	if !strings.EqualFold(root, plan.Object.ShardRoot) {
		return DeveloperUploadReceipt{}, fmt.Errorf("%w: shard root mismatch", ErrDeveloperUpload)
	}
	if _, err := staged.Seek(0, io.SeekStart); err != nil {
		return DeveloperUploadReceipt{}, err
	}
	sink, ok := c.Sinks.ResolveUploadSink(plan.ServiceID)
	if !ok || sink == nil {
		return DeveloperUploadReceipt{}, fmt.Errorf("%w: upload sink unavailable", ErrDeveloperUpload)
	}
	if err := sink.StorePreparedUpload(ctx, plan, staged); err != nil {
		return DeveloperUploadReceipt{}, err
	}
	if err := ctx.Err(); err != nil {
		return DeveloperUploadReceipt{}, err
	}
	receipt := DeveloperUploadReceipt{Version: DeveloperAPIVersion, UploadID: plan.UploadID, Object: plan.Object, ProviderID: plan.ProviderID, NodeID: plan.NodeID, ServiceID: plan.ServiceID, SizeBytes: plan.Object.SizeBytes, ShardRoot: root}
	c.mu.Lock()
	if c.receipts == nil {
		c.receipts = make(map[string]DeveloperUploadReceipt)
	}
	if existing, exists := c.receipts[plan.IdempotencyKey]; exists && existing.UploadID != plan.UploadID {
		c.mu.Unlock()
		return DeveloperUploadReceipt{}, fmt.Errorf("%w: idempotency conflict", ErrDeveloperUpload)
	}
	c.receipts[plan.IdempotencyKey] = receipt
	c.mu.Unlock()
	return receipt, nil
}
