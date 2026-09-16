package storage420

import "time"

const APIVersion = "v1"

type AccessMode string

const (
	AccessPublic  AccessMode = "public"
	AccessPrivate AccessMode = "private"
)

type ObjectRef struct {
	ObjectID     string `json:"object_id"`
	ManifestID   string `json:"manifest_id"`
	ShardIndex   uint32 `json:"shard_index"`
	ShardRoot    string `json:"shard_root"`
	SizeBytes    uint64 `json:"size_bytes"`
	CommitmentID string `json:"commitment_id"`
}

type ReadAccess struct {
	Mode       AccessMode `json:"mode"`
	Subject    string     `json:"subject,omitempty"`
	SessionID  string     `json:"session_id,omitempty"`
	Capability string     `json:"capability,omitempty"`
}

type RetrieveRequest struct {
	Version string     `json:"version"`
	Object  ObjectRef  `json:"object"`
	Access  ReadAccess `json:"access"`
}

type RouteMetadata struct {
	Tier       string `json:"tier"`
	ProviderID string `json:"provider_id,omitempty"`
	NodeID     string `json:"node_id,omitempty"`
}

type RetrieveResult struct {
	Version string        `json:"version"`
	Object  ObjectRef     `json:"object"`
	Route   RouteMetadata `json:"route"`
	Payload []byte        `json:"-"`
}

type UploadPreconditions struct {
	AgreementID           string `json:"agreement_id"`
	CapacityReservationID string `json:"capacity_reservation_id"`
	CommitmentID          string `json:"commitment_id"`
}

type UploadPrepareRequest struct {
	Version        string              `json:"version"`
	Object         ObjectRef           `json:"object"`
	IdempotencyKey string              `json:"idempotency_key"`
	Preconditions  UploadPreconditions `json:"preconditions"`
}

type UploadPlan struct {
	Version        string              `json:"version"`
	UploadID       string              `json:"upload_id"`
	Object         ObjectRef           `json:"object"`
	IdempotencyKey string              `json:"idempotency_key"`
	Preconditions  UploadPreconditions `json:"preconditions"`
	ProviderID     string              `json:"provider_id"`
	NodeID         string              `json:"node_id"`
	ServiceID      string              `json:"service_id"`
	Endpoint       string              `json:"endpoint,omitempty"`
}

type ShardSpec struct {
	ShardIndex   uint32 `json:"shard_index"`
	ShardRoot    string `json:"shard_root"`
	SizeBytes    uint64 `json:"size_bytes"`
	AgreementID  string `json:"agreement_id,omitempty"`
	CommitmentID string `json:"commitment_id,omitempty"`
	NodeID       string `json:"node_id,omitempty"`
	Live         bool   `json:"live"`
}

type ManifestDescriptor struct {
	Version              string      `json:"version"`
	ManifestID           string      `json:"manifest_id,omitempty"`
	ObjectID             string      `json:"object_id"`
	ObjectContentRoot    string      `json:"object_content_root"`
	ManifestHash         string      `json:"manifest_hash"`
	EncryptionCommitment string      `json:"encryption_commitment"`
	ErasureRoot          string      `json:"erasure_root"`
	ObjectSizeBytes      uint64      `json:"object_size_bytes"`
	SegmentCount         uint32      `json:"segment_count"`
	DataShards           uint32      `json:"data_shards"`
	TotalShards          uint32      `json:"total_shards"`
	PlacedShards         uint32      `json:"placed_shards"`
	SealReady            bool        `json:"seal_ready"`
	Sealed               bool        `json:"sealed"`
	Retrievable          bool        `json:"retrievable"`
	Shards               []ShardSpec `json:"shards"`
}

type Capability string

type ServiceState string

type ServiceHealth string

type DiscoveryRequest struct {
	Version         string       `json:"version"`
	Capabilities    []Capability `json:"capabilities"`
	IncludeDegraded bool         `json:"include_degraded"`
	MaxResults      uint32       `json:"max_results,omitempty"`
}

type ResourceDescriptor struct {
	ProviderID    string        `json:"provider_id"`
	NodeID        string        `json:"node_id"`
	ServiceID     string        `json:"service_id"`
	Capability    Capability    `json:"capability"`
	Priority      uint32        `json:"priority"`
	Endpoint      string        `json:"endpoint,omitempty"`
	State         ServiceState  `json:"state"`
	Health        ServiceHealth `json:"health"`
	Authoritative bool          `json:"authoritative"`
}

type DiscoveryResult struct {
	Version       string               `json:"version"`
	Authoritative bool                 `json:"authoritative"`
	Resources     []ResourceDescriptor `json:"resources"`
}

type ServiceStatus struct {
	ProviderID   string        `json:"provider_id"`
	NodeID       string        `json:"node_id"`
	ServiceID    string        `json:"service_id"`
	State        ServiceState  `json:"state"`
	Health       ServiceHealth `json:"health"`
	Capabilities []Capability  `json:"capabilities"`
}

type CapabilityStatus struct {
	Capability  Capability `json:"capability"`
	Running     uint64     `json:"running"`
	Degraded    uint64     `json:"degraded"`
	Unavailable uint64     `json:"unavailable"`
}

type ResourceStatus struct {
	Version       string             `json:"version"`
	Authoritative bool               `json:"authoritative"`
	ProviderID    string             `json:"provider_id"`
	NodeID        string             `json:"node_id"`
	Ready         bool               `json:"ready"`
	Degraded      bool               `json:"degraded"`
	ObservedAt    time.Time          `json:"observed_at"`
	Services      []ServiceStatus    `json:"services"`
	Capabilities  []CapabilityStatus `json:"capabilities"`
}
