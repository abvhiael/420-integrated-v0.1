package mail

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

const (
	MaxConnectorProviderBytes = 64
	MaxConnectorIDBytes       = 128
	MaxConnectorOpaqueBytes   = 64 << 10
	MaxConnectorPayloadBytes  = 1 << 20
	MaxConnectorItems         = 500
)

type ConnectorCapability string

const (
	ConnectorCapabilityLink         ConnectorCapability = "LINK"
	ConnectorCapabilityPull         ConnectorCapability = "PULL"
	ConnectorCapabilityPush         ConnectorCapability = "PUSH"
	ConnectorCapabilityWebhook      ConnectorCapability = "WEBHOOK"
	ConnectorCapabilityWalletVerify ConnectorCapability = "WALLET_VERIFY"
)

var (
	ErrConnectorNotFound      = errors.New("mail: connector not found")
	ErrConnectorUnsupported   = errors.New("mail: connector capability unsupported")
	ErrConnectorInvalidResult = errors.New("mail: invalid connector result")
	ErrConnectorConflict      = errors.New("mail: connector conflict")
	ErrConnectorIsolated      = errors.New("mail: connector isolated failure")
)

type ConnectorDescriptor struct {
	Provider     string                `json:"provider"`
	DisplayName  string                `json:"display_name"`
	Capabilities []ConnectorCapability `json:"capabilities"`
}

type ConnectorLinkRequest struct {
	Provider         string `json:"provider"`
	AuthorizationRef string `json:"authorization_ref"`
	AccountHint      string `json:"account_hint,omitempty"`
}

type ConnectorConnection struct {
	ID           string    `json:"id"`
	Provider     string    `json:"provider"`
	Identity     string    `json:"identity"`
	ExternalID   string    `json:"external_id"`
	DisplayName  string    `json:"display_name,omitempty"`
	LinkedAt     time.Time `json:"linked_at"`
	UpdatedAt    time.Time `json:"updated_at"`
	Active       bool      `json:"active"`
	NonCustodial bool      `json:"non_custodial"`
}

type ConnectorPullRequest struct {
	Provider     string `json:"provider"`
	ConnectionID string `json:"connection_id"`
	Cursor       string `json:"cursor,omitempty"`
}

type ConnectorItem struct {
	ExternalID string    `json:"external_id"`
	OccurredAt time.Time `json:"occurred_at"`
	Kind       string    `json:"kind"`
	Payload    string    `json:"payload"`
}

type ConnectorPullResult struct {
	Provider     string          `json:"provider"`
	ConnectionID string          `json:"connection_id"`
	Items        []ConnectorItem `json:"items"`
	NextCursor   string          `json:"next_cursor,omitempty"`
}

type ConnectorPushRequest struct {
	Provider       string `json:"provider"`
	ConnectionID   string `json:"connection_id"`
	Kind           string `json:"kind"`
	Payload        string `json:"payload"`
	IdempotencyKey string `json:"idempotency_key"`
}

type ConnectorPushResult struct {
	Provider     string    `json:"provider"`
	ConnectionID string    `json:"connection_id"`
	ExternalID   string    `json:"external_id"`
	AcceptedAt   time.Time `json:"accepted_at"`
	Accepted     bool      `json:"accepted"`
}

type ConnectorWebhookRequest struct {
	Provider string            `json:"provider"`
	Headers  map[string]string `json:"-"`
	Payload  string            `json:"payload"`
}

type ConnectorWebhookResult struct {
	Provider     string          `json:"provider"`
	Identity     string          `json:"identity"`
	ConnectionID string          `json:"connection_id"`
	Items        []ConnectorItem `json:"items"`
	Verified     bool            `json:"verified"`
}

type ConnectorAdapter interface {
	Descriptor() ConnectorDescriptor
	Link(context.Context, string, ConnectorLinkRequest) (ConnectorConnection, error)
	Unlink(context.Context, string, string) error
	Pull(context.Context, string, ConnectorPullRequest) (ConnectorPullResult, error)
	Push(context.Context, string, ConnectorPushRequest) (ConnectorPushResult, error)
	VerifyWebhook(context.Context, ConnectorWebhookRequest) (ConnectorWebhookResult, error)
}

type connectorRegistration struct {
	adapter    ConnectorAdapter
	descriptor ConnectorDescriptor
}

type ConnectorRegistry struct {
	mu            sync.RWMutex
	registrations map[string]connectorRegistration
}

func NewConnectorRegistry(adapters ...ConnectorAdapter) (*ConnectorRegistry, error) {
	r := &ConnectorRegistry{registrations: map[string]connectorRegistration{}}
	for _, adapter := range adapters {
		if err := r.Register(adapter); err != nil {
			return nil, err
		}
	}
	return r, nil
}

func (r *ConnectorRegistry) Register(adapter ConnectorAdapter) error {
	if adapter == nil {
		return ErrInvalidInput
	}
	d := normalizeConnectorDescriptor(adapter.Descriptor())
	if err := validateConnectorDescriptor(d); err != nil {
		return err
	}
	r.mu.Lock()
	defer r.mu.Unlock()
	if _, exists := r.registrations[d.Provider]; exists {
		return ErrConnectorConflict
	}
	r.registrations[d.Provider] = connectorRegistration{adapter: adapter, descriptor: cloneConnectorDescriptor(d)}
	return nil
}

func (r *ConnectorRegistry) Descriptors() []ConnectorDescriptor {
	if r == nil {
		return nil
	}
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]ConnectorDescriptor, 0, len(r.registrations))
	for _, registration := range r.registrations {
		out = append(out, cloneConnectorDescriptor(registration.descriptor))
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Provider < out[j].Provider })
	return out
}

func (r *ConnectorRegistry) adapter(provider string, capability ConnectorCapability) (ConnectorAdapter, ConnectorDescriptor, error) {
	if r == nil {
		return nil, ConnectorDescriptor{}, ErrConnectorNotFound
	}
	provider = normalizeProvider(provider)
	r.mu.RLock()
	registration, ok := r.registrations[provider]
	r.mu.RUnlock()
	if !ok {
		return nil, ConnectorDescriptor{}, ErrConnectorNotFound
	}
	d := cloneConnectorDescriptor(registration.descriptor)
	if !connectorHasCapability(d, capability) {
		return nil, d, ErrConnectorUnsupported
	}
	return registration.adapter, d, nil
}

type ConnectorService struct {
	Registry *ConnectorRegistry
}

func NewConnectorService(registry *ConnectorRegistry) *ConnectorService {
	return &ConnectorService{Registry: registry}
}

func (s *ConnectorService) Providers() []ConnectorDescriptor {
	if s == nil || s.Registry == nil {
		return nil
	}
	return s.Registry.Descriptors()
}

func (s *ConnectorService) Link(ctx context.Context, actor string, req ConnectorLinkRequest) (ConnectorConnection, error) {
	actor = strings.TrimSpace(actor)
	req.Provider = normalizeProvider(req.Provider)
	req.AuthorizationRef = strings.TrimSpace(req.AuthorizationRef)
	req.AccountHint = strings.TrimSpace(req.AccountHint)
	if actor == "" {
		return ConnectorConnection{}, ErrUnauthorized
	}
	if req.Provider == "" || req.AuthorizationRef == "" || len([]byte(req.AuthorizationRef)) > MaxConnectorOpaqueBytes || len([]byte(req.AccountHint)) > 256 {
		return ConnectorConnection{}, ErrInvalidInput
	}
	adapter, _, err := s.Registry.adapter(req.Provider, ConnectorCapabilityLink)
	if err != nil {
		return ConnectorConnection{}, err
	}
	out, err := isolatedConnectorLink(adapter, ctx, actor, req)
	if err != nil {
		return ConnectorConnection{}, fmt.Errorf("mail: connector link: %w", err)
	}
	out = normalizeConnectorConnection(out)
	if err := validateConnectorConnection(actor, req.Provider, out); err != nil {
		return ConnectorConnection{}, err
	}
	return out, nil
}

func (s *ConnectorService) Unlink(ctx context.Context, actor, provider, connectionID string) error {
	actor = strings.TrimSpace(actor)
	provider = normalizeProvider(provider)
	connectionID = strings.TrimSpace(connectionID)
	if actor == "" {
		return ErrUnauthorized
	}
	if provider == "" || connectionID == "" || len([]byte(connectionID)) > MaxConnectorIDBytes {
		return ErrInvalidInput
	}
	adapter, _, err := s.Registry.adapter(provider, ConnectorCapabilityLink)
	if err != nil {
		return err
	}
	if err := isolatedConnectorUnlink(adapter, ctx, actor, provider, connectionID); err != nil {
		return fmt.Errorf("mail: connector unlink: %w", err)
	}
	return nil
}

func (s *ConnectorService) Pull(ctx context.Context, actor string, req ConnectorPullRequest) (ConnectorPullResult, error) {
	actor = strings.TrimSpace(actor)
	req.Provider = normalizeProvider(req.Provider)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.Cursor = strings.TrimSpace(req.Cursor)
	if actor == "" {
		return ConnectorPullResult{}, ErrUnauthorized
	}
	if req.Provider == "" || req.ConnectionID == "" || len([]byte(req.ConnectionID)) > MaxConnectorIDBytes || len([]byte(req.Cursor)) > MaxConnectorOpaqueBytes {
		return ConnectorPullResult{}, ErrInvalidInput
	}
	adapter, _, err := s.Registry.adapter(req.Provider, ConnectorCapabilityPull)
	if err != nil {
		return ConnectorPullResult{}, err
	}
	out, err := isolatedConnectorPull(adapter, ctx, actor, req)
	if err != nil {
		return ConnectorPullResult{}, fmt.Errorf("mail: connector pull: %w", err)
	}
	out.Provider = normalizeProvider(out.Provider)
	out.ConnectionID = strings.TrimSpace(out.ConnectionID)
	out.NextCursor = strings.TrimSpace(out.NextCursor)
	if out.Provider != req.Provider || out.ConnectionID != req.ConnectionID || len([]byte(out.NextCursor)) > MaxConnectorOpaqueBytes {
		return ConnectorPullResult{}, ErrConnectorInvalidResult
	}
	if err := validateConnectorItems(out.Items); err != nil {
		return ConnectorPullResult{}, err
	}
	return out, nil
}

func (s *ConnectorService) Push(ctx context.Context, actor string, req ConnectorPushRequest) (ConnectorPushResult, error) {
	actor = strings.TrimSpace(actor)
	req.Provider = normalizeProvider(req.Provider)
	req.ConnectionID = strings.TrimSpace(req.ConnectionID)
	req.Kind = strings.TrimSpace(req.Kind)
	req.Payload = strings.TrimSpace(req.Payload)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if actor == "" {
		return ConnectorPushResult{}, ErrUnauthorized
	}
	if req.Provider == "" || req.ConnectionID == "" || req.Kind == "" || req.Payload == "" || req.IdempotencyKey == "" ||
		len([]byte(req.ConnectionID)) > MaxConnectorIDBytes || len([]byte(req.Kind)) > 128 || len([]byte(req.Payload)) > MaxConnectorPayloadBytes || len([]byte(req.IdempotencyKey)) > 256 {
		return ConnectorPushResult{}, ErrInvalidInput
	}
	adapter, _, err := s.Registry.adapter(req.Provider, ConnectorCapabilityPush)
	if err != nil {
		return ConnectorPushResult{}, err
	}
	out, err := isolatedConnectorPush(adapter, ctx, actor, req)
	if err != nil {
		return ConnectorPushResult{}, fmt.Errorf("mail: connector push: %w", err)
	}
	out.Provider = normalizeProvider(out.Provider)
	out.ConnectionID = strings.TrimSpace(out.ConnectionID)
	out.ExternalID = strings.TrimSpace(out.ExternalID)
	if out.Provider != req.Provider || out.ConnectionID != req.ConnectionID || out.ExternalID == "" || out.AcceptedAt.IsZero() || !out.Accepted {
		return ConnectorPushResult{}, ErrConnectorInvalidResult
	}
	return out, nil
}

func (s *ConnectorService) VerifyWebhook(ctx context.Context, req ConnectorWebhookRequest) (ConnectorWebhookResult, error) {
	req.Provider = normalizeProvider(req.Provider)
	req.Payload = strings.TrimSpace(req.Payload)
	if req.Provider == "" || req.Payload == "" || len([]byte(req.Payload)) > MaxConnectorPayloadBytes {
		return ConnectorWebhookResult{}, ErrInvalidInput
	}
	adapter, _, err := s.Registry.adapter(req.Provider, ConnectorCapabilityWebhook)
	if err != nil {
		return ConnectorWebhookResult{}, err
	}
	req.Headers = cloneStringMap(req.Headers)
	out, err := isolatedConnectorWebhook(adapter, ctx, req)
	if err != nil {
		return ConnectorWebhookResult{}, fmt.Errorf("mail: connector webhook: %w", err)
	}
	out.Provider = normalizeProvider(out.Provider)
	out.Identity = strings.TrimSpace(out.Identity)
	out.ConnectionID = strings.TrimSpace(out.ConnectionID)
	if out.Provider != req.Provider || out.Identity == "" || out.ConnectionID == "" || !out.Verified {
		return ConnectorWebhookResult{}, ErrConnectorInvalidResult
	}
	if err := validateConnectorItems(out.Items); err != nil {
		return ConnectorWebhookResult{}, err
	}
	return out, nil
}

func cloneConnectorDescriptor(d ConnectorDescriptor) ConnectorDescriptor {
	d.Capabilities = append([]ConnectorCapability(nil), d.Capabilities...)
	return d
}

func cloneStringMap(in map[string]string) map[string]string {
	if in == nil {
		return nil
	}
	out := make(map[string]string, len(in))
	for k, v := range in {
		out[k] = v
	}
	return out
}

func connectorPanicError(provider string, recovered any) error {
	return fmt.Errorf("%w: provider=%s panic=%v", ErrConnectorIsolated, normalizeProvider(provider), recovered)
}

func isolatedConnectorLink(adapter ConnectorAdapter, ctx context.Context, actor string, req ConnectorLinkRequest) (out ConnectorConnection, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = connectorPanicError(req.Provider, recovered)
		}
	}()
	return adapter.Link(ctx, actor, req)
}

func isolatedConnectorUnlink(adapter ConnectorAdapter, ctx context.Context, actor, provider, connectionID string) (err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = connectorPanicError(provider, recovered)
		}
	}()
	return adapter.Unlink(ctx, actor, connectionID)
}

func isolatedConnectorPull(adapter ConnectorAdapter, ctx context.Context, actor string, req ConnectorPullRequest) (out ConnectorPullResult, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = connectorPanicError(req.Provider, recovered)
		}
	}()
	return adapter.Pull(ctx, actor, req)
}

func isolatedConnectorPush(adapter ConnectorAdapter, ctx context.Context, actor string, req ConnectorPushRequest) (out ConnectorPushResult, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = connectorPanicError(req.Provider, recovered)
		}
	}()
	return adapter.Push(ctx, actor, req)
}

func isolatedConnectorWebhook(adapter ConnectorAdapter, ctx context.Context, req ConnectorWebhookRequest) (out ConnectorWebhookResult, err error) {
	defer func() {
		if recovered := recover(); recovered != nil {
			err = connectorPanicError(req.Provider, recovered)
		}
	}()
	return adapter.VerifyWebhook(ctx, req)
}

func normalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

func normalizeConnectorDescriptor(d ConnectorDescriptor) ConnectorDescriptor {
	d.Provider = normalizeProvider(d.Provider)
	d.DisplayName = strings.TrimSpace(d.DisplayName)
	caps := append([]ConnectorCapability(nil), d.Capabilities...)
	sort.Slice(caps, func(i, j int) bool { return caps[i] < caps[j] })
	d.Capabilities = caps
	return d
}

func validateConnectorDescriptor(d ConnectorDescriptor) error {
	if d.Provider == "" || len([]byte(d.Provider)) > MaxConnectorProviderBytes || d.DisplayName == "" || len([]byte(d.DisplayName)) > 128 || len(d.Capabilities) == 0 {
		return ErrInvalidInput
	}
	for _, r := range d.Provider {
		if !((r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') || r == '-' || r == '_') {
			return ErrInvalidInput
		}
	}
	seen := map[ConnectorCapability]bool{}
	for _, cap := range d.Capabilities {
		switch cap {
		case ConnectorCapabilityLink, ConnectorCapabilityPull, ConnectorCapabilityPush, ConnectorCapabilityWebhook, ConnectorCapabilityWalletVerify:
		default:
			return ErrInvalidInput
		}
		if seen[cap] {
			return ErrInvalidInput
		}
		seen[cap] = true
	}
	return nil
}

func connectorHasCapability(d ConnectorDescriptor, capability ConnectorCapability) bool {
	for _, cap := range d.Capabilities {
		if cap == capability {
			return true
		}
	}
	return false
}

func normalizeConnectorConnection(c ConnectorConnection) ConnectorConnection {
	c.ID = strings.TrimSpace(c.ID)
	c.Provider = normalizeProvider(c.Provider)
	c.Identity = strings.TrimSpace(c.Identity)
	c.ExternalID = strings.TrimSpace(c.ExternalID)
	c.DisplayName = strings.TrimSpace(c.DisplayName)
	return c
}

func validateConnectorConnection(actor, provider string, c ConnectorConnection) error {
	if c.ID == "" || len([]byte(c.ID)) > MaxConnectorIDBytes || c.Provider != provider || c.Identity != actor || c.ExternalID == "" || c.LinkedAt.IsZero() || c.UpdatedAt.IsZero() || !c.Active || !c.NonCustodial {
		return ErrConnectorInvalidResult
	}
	return nil
}

func validateConnectorItems(items []ConnectorItem) error {
	if len(items) > MaxConnectorItems {
		return ErrConnectorInvalidResult
	}
	for _, item := range items {
		if strings.TrimSpace(item.ExternalID) == "" || item.OccurredAt.IsZero() || strings.TrimSpace(item.Kind) == "" || len([]byte(item.Payload)) > MaxConnectorPayloadBytes {
			return ErrConnectorInvalidResult
		}
	}
	return nil
}
