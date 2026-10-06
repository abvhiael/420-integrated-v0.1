package api

import "time"

const (
	Version            = "v1"
	ServiceID          = "420/service/media/v1"
	DefaultPageLimit   = 50
	MaxPageLimit       = 200
	MaxRequestBytes    = 128 << 10
	MaxResponseBytes   = 2 << 20
	DefaultRateLimit   = 120
	SigningDomain      = "420/MEDIA/API/SIGNING/V1"
	CompatibilityMajor = 1
)

type ErrorCode string

const (
	CodeInvalidRequest      ErrorCode = "invalid_request"
	CodeUnauthorized        ErrorCode = "unauthorized"
	CodeForbidden           ErrorCode = "forbidden"
	CodeNotFound            ErrorCode = "not_found"
	CodeConflict            ErrorCode = "conflict"
	CodeIdempotencyConflict ErrorCode = "idempotency_conflict"
	CodeRateLimited         ErrorCode = "rate_limited"
	CodeUnavailable         ErrorCode = "unavailable"
	CodeInternal            ErrorCode = "internal_error"
	CodeUnsupportedVersion  ErrorCode = "unsupported_version"
)

type APIError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
}

type ErrorEnvelope struct {
	Version string   `json:"version"`
	Error   APIError `json:"error"`
}

type Envelope[T any] struct {
	Version    string        `json:"version"`
	Data       T             `json:"data"`
	RateLimit  RateLimitMeta `json:"rate_limit"`
}

type RateLimitMeta struct {
	Limit     int       `json:"limit"`
	Remaining int       `json:"remaining"`
	ResetAt   time.Time `json:"reset_at"`
}

type Page[T any] struct {
	Items      []T    `json:"items"`
	NextCursor string `json:"next_cursor,omitempty"`
}

type Provenance struct {
	Source          string    `json:"source"`
	Authority       string    `json:"authority"`
	ChainID         uint64    `json:"chain_id,omitempty"`
	BlockNumber     uint64    `json:"block_number,omitempty"`
	BlockHash       string    `json:"block_hash,omitempty"`
	TransactionHash string    `json:"transaction_hash,omitempty"`
	LogIndex        uint64    `json:"log_index,omitempty"`
	Finality        string    `json:"finality,omitempty"`
	ObservedAt      time.Time `json:"observed_at"`
}

type Asset struct {
	ID            string     `json:"id"`
	OwnerRef      string     `json:"owner_ref"`
	MimeType      string     `json:"mime_type"`
	Visibility    string     `json:"visibility"`
	State         string     `json:"status"`
	Revision      uint32     `json:"version"`
	ProvenanceRef string     `json:"provenance_ref"`
	DerivativeOf  string     `json:"derivative_of,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	UpdatedAt     time.Time  `json:"updated_at"`
	Provenance    Provenance `json:"provenance"`
}

type UploadPreconditions struct {
	AgreementID            string `json:"agreement_id"`
	CapacityReservationID  string `json:"capacity_reservation_id"`
	CommitmentID           string `json:"commitment_id"`
}

type PrepareUploadRequest struct {
	ID            string              `json:"id"`
	OwnerRef      string              `json:"owner_ref"`
	MimeType      string              `json:"mime_type"`
	Visibility    string              `json:"visibility"`
	ProvenanceRef string              `json:"provenance_ref"`
	ObjectID      string              `json:"object_id"`
	ManifestID    string              `json:"manifest_id"`
	ShardIndex    uint32              `json:"shard_index"`
	ShardRoot     string              `json:"shard_root"`
	SizeBytes     uint64              `json:"size_bytes"`
	CommitmentID  string              `json:"commitment_id"`
	Preconditions UploadPreconditions `json:"preconditions"`
}

type UploadPlan struct {
	Asset       Asset      `json:"asset"`
	UploadID    string     `json:"upload_id"`
	ProviderID  string     `json:"provider_id"`
	NodeID      string     `json:"node_id"`
	ServiceID   string     `json:"service_id"`
	ExpiresAt   time.Time  `json:"expires_at"`
	Provenance  Provenance `json:"provenance"`
}

type Livestream struct {
	ID                string     `json:"id"`
	Controller        string     `json:"controller"`
	Protocol          string     `json:"protocol"`
	Direction         string     `json:"direction"`
	Endpoint          string     `json:"endpoint"`
	StreamRef         string     `json:"stream_ref"`
	Status            string     `json:"status"`
	DesiredLive       bool       `json:"desired_live"`
	ReconnectAttempts uint32     `json:"reconnect_attempts"`
	CreatedAt         time.Time  `json:"created_at"`
	UpdatedAt         time.Time  `json:"updated_at"`
	Provenance        Provenance `json:"provenance"`
}

type CreateLivestreamRequest struct {
	ID            string `json:"id"`
	Controller    string `json:"controller"`
	ProfileID     string `json:"profile_id,omitempty"`
	Protocol      string `json:"protocol"`
	Direction     string `json:"direction"`
	Endpoint      string `json:"endpoint"`
	CredentialRef string `json:"credential_ref,omitempty"`
	StreamRef     string `json:"stream_ref"`
	MaxDurationSeconds uint32 `json:"max_duration_seconds,omitempty"`
}

type LivestreamActionRequest struct {
	Controller string `json:"controller"`
	ProfileID  string `json:"profile_id,omitempty"`
}

type SearchItem struct {
	ID           string     `json:"id"`
	Title        string     `json:"title"`
	Subtitle     string     `json:"subtitle,omitempty"`
	Snippet      string     `json:"snippet,omitempty"`
	CanonicalURL string     `json:"canonical_url"`
	Tags         []string   `json:"tags,omitempty"`
	Provenance   Provenance `json:"provenance"`
}

type Subscription struct {
	ID                string    `json:"id"`
	UserRef           string    `json:"user_ref"`
	Topic             string    `json:"topic"`
	Channel           string    `json:"channel"`
	MinimumSeverity   uint8     `json:"minimum_severity"`
	MinimumFinality   string    `json:"minimum_finality"`
	PromotionalOptIn  bool      `json:"promotional_opt_in"`
	Muted             bool      `json:"muted"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

type CreateSubscriptionRequest struct {
	ID               string `json:"id"`
	UserRef          string `json:"user_ref"`
	Topic            string `json:"topic"`
	Channel          string `json:"channel"`
	MinimumSeverity  uint8  `json:"minimum_severity"`
	MinimumFinality  string `json:"minimum_finality"`
	PromotionalOptIn bool   `json:"promotional_opt_in"`
}

type SigningIntentRequest struct {
	Wallet      string `json:"wallet"`
	ChainID     uint64 `json:"chain_id"`
	Network     string `json:"network"`
	Action      string `json:"action"`
	ResourceID  string `json:"resource_id"`
	PayloadHash string `json:"payload_hash"`
}

type SigningIntent struct {
	ID          string    `json:"id"`
	Domain      string    `json:"domain"`
	Wallet      string    `json:"wallet"`
	ChainID     uint64    `json:"chain_id"`
	Network     string    `json:"network"`
	Action      string    `json:"action"`
	ResourceID  string    `json:"resource_id"`
	PayloadHash string    `json:"payload_hash"`
	Nonce       string    `json:"nonce"`
	ExpiresAt   time.Time `json:"expires_at"`
	Message     string    `json:"message"`
}

type Capabilities struct {
	ServiceID       string            `json:"service_id"`
	APIVersion      string            `json:"api_version"`
	Compatibility  int               `json:"compatibility_major"`
	Canonical      bool              `json:"canonical"`
	Features       map[string]bool   `json:"features"`
	Resources      []string          `json:"resources"`
	WalletSigning  string            `json:"wallet_signing"`
	Pagination     string            `json:"pagination"`
	Timestamps     string            `json:"timestamps"`
	MaxPageLimit   int               `json:"max_page_limit"`
	Errors         []ErrorCode       `json:"error_codes"`
}

type Compatibility struct {
	ServiceID          string `json:"service_id"`
	APIVersion         string `json:"api_version"`
	CompatibilityMajor int    `json:"compatibility_major"`
	MinimumClientMajor int    `json:"minimum_client_major"`
	Network            string `json:"network,omitempty"`
	ChainID            uint64 `json:"chain_id,omitempty"`
}
