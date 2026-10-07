package reeferreview

import (
	"context"
	"errors"
	"strings"
	"time"
)

const (
	CapabilityAuthor    = "reefer.author"
	CapabilityPublisher = "reefer.publisher"
	CapabilityModerator = "reefer.moderator"
)

var (
	ErrSessionRequired = errors.New("reefer review: verified Wallet/Identity session required")
	ErrSessionInvalid  = errors.New("reefer review: invalid session")
	ErrSessionExpired  = errors.New("reefer review: session expired")
	ErrSessionRevoked  = errors.New("reefer review: session revoked")
	ErrSessionScope    = errors.New("reefer review: session scope denied")
)

type SessionClaims struct {
	SessionID        string
	Subject          string
	Wallet           string
	Audience         string
	ChainID          uint64
	Network          string
	IssuedAt         time.Time
	ExpiresAt        time.Time
	Revoked          bool
	Capabilities     map[string]bool
	VisibilityGrants map[Visibility]bool
}

type SessionVerifier interface {
	Verify(context.Context, string) (SessionClaims, error)
}

type SessionSecurity struct {
	Verifier        SessionVerifier
	ExpectedChainID uint64
	ExpectedNetwork string
	Now             func() time.Time
}

type sessionContextKey struct{}

func WithSessionClaims(ctx context.Context, claims SessionClaims) context.Context {
	return context.WithValue(ctx, sessionContextKey{}, claims)
}

func AuthenticatedSession(ctx context.Context) (SessionClaims, bool) {
	claims, ok := ctx.Value(sessionContextKey{}).(SessionClaims)
	return claims, ok
}

func (s SessionSecurity) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func (s SessionSecurity) Validate() error {
	if s.Verifier == nil || s.ExpectedChainID == 0 || strings.TrimSpace(s.ExpectedNetwork) == "" {
		return ErrSessionRequired
	}
	return nil
}

func (s SessionSecurity) Verify(ctx context.Context, token string) (SessionClaims, error) {
	if err := s.Validate(); err != nil {
		return SessionClaims{}, err
	}
	token = strings.TrimSpace(token)
	if token == "" {
		return SessionClaims{}, ErrSessionRequired
	}
	claims, err := s.Verifier.Verify(ctx, token)
	if err != nil {
		return SessionClaims{}, ErrSessionRequired
	}
	now := s.now()
	if strings.TrimSpace(claims.SessionID) == "" ||
		strings.TrimSpace(claims.Subject) == "" ||
		!validWalletAddress(claims.Wallet) ||
		claims.Audience != ServiceID ||
		claims.ChainID == 0 ||
		strings.TrimSpace(claims.Network) == "" ||
		claims.ExpiresAt.IsZero() {
		return SessionClaims{}, ErrSessionInvalid
	}
	if claims.Revoked {
		return SessionClaims{}, ErrSessionRevoked
	}
	if !claims.IssuedAt.IsZero() && claims.IssuedAt.After(now.Add(time.Minute)) {
		return SessionClaims{}, ErrSessionInvalid
	}
	if !now.Before(claims.ExpiresAt.UTC()) {
		return SessionClaims{}, ErrSessionExpired
	}
	if claims.ChainID != s.ExpectedChainID || claims.Network != s.ExpectedNetwork {
		return SessionClaims{}, ErrSessionScope
	}
	return claims, nil
}

func validWalletAddress(value string) bool {
	value = strings.TrimSpace(value)
	if len(value) != 42 || !strings.HasPrefix(value, "0x") {
		return false
	}
	for _, r := range value[2:] {
		if !(r >= '0' && r <= '9') && !(r >= 'a' && r <= 'f') && !(r >= 'A' && r <= 'F') {
			return false
		}
	}
	return true
}

func hasCapability(claims SessionClaims, capability string) bool {
	return claims.Capabilities != nil && claims.Capabilities[capability]
}

func HasAnyCapability(claims SessionClaims, capabilities ...string) bool {
	for _, capability := range capabilities {
		if hasCapability(claims, capability) {
			return true
		}
	}
	return false
}

type SessionIdentity struct{}

func (SessionIdentity) Active(ctx context.Context, actor string) (bool, error) {
	claims, ok := AuthenticatedSession(ctx)
	if !ok || claims.Revoked || strings.TrimSpace(actor) == "" || claims.Subject != strings.TrimSpace(actor) {
		return false, nil
	}
	if claims.ExpiresAt.IsZero() || !time.Now().UTC().Before(claims.ExpiresAt.UTC()) {
		return false, nil
	}
	return true, nil
}

type SessionAuthorizer struct{}

func sessionForActor(ctx context.Context, actor string) (SessionClaims, bool) {
	claims, ok := AuthenticatedSession(ctx)
	if !ok || claims.Subject != strings.TrimSpace(actor) || claims.Revoked {
		return SessionClaims{}, false
	}
	return claims, true
}

func (SessionAuthorizer) CanPublish(ctx context.Context, actor string, p Publication) (bool, error) {
	claims, ok := sessionForActor(ctx, actor)
	if !ok {
		return false, nil
	}
	return hasCapability(claims, CapabilityPublisher) ||
		(hasCapability(claims, CapabilityAuthor) && p.Author == claims.Subject), nil
}

func (SessionAuthorizer) CanModerate(ctx context.Context, actor string, p Publication) (bool, error) {
	claims, ok := sessionForActor(ctx, actor)
	if !ok {
		return false, nil
	}
	return HasAnyCapability(claims, CapabilityModerator, CapabilityPublisher), nil
}

func (SessionAuthorizer) CanEdit(ctx context.Context, actor string, p Publication) (bool, error) {
	claims, ok := sessionForActor(ctx, actor)
	if !ok {
		return false, nil
	}
	return hasCapability(claims, CapabilityPublisher) ||
		(hasCapability(claims, CapabilityAuthor) && p.Author == claims.Subject), nil
}

func (SessionAuthorizer) CanTombstone(ctx context.Context, actor string, p Publication) (bool, error) {
	return (SessionAuthorizer{}).CanEdit(ctx, actor, p)
}

func (SessionAuthorizer) CanRead(ctx context.Context, actor string, p Publication) (bool, error) {
	claims, ok := sessionForActor(ctx, actor)
	if !ok {
		return false, nil
	}
	publisher := hasCapability(claims, CapabilityPublisher)
	moderator := hasCapability(claims, CapabilityModerator)
	author := hasCapability(claims, CapabilityAuthor) && p.Author == claims.Subject

	if p.Status == StatusTombstoned {
		return false, nil
	}
	if p.Status == StatusDraft {
		return author || publisher, nil
	}
	if p.Status == StatusHidden {
		return author || moderator || publisher, nil
	}
	if p.Status != StatusPublished {
		return false, nil
	}

	switch p.Visibility {
	case VisibilityPublic, VisibilityUnlisted:
		return true, nil
	case VisibilityPrivate:
		return author || publisher, nil
	case VisibilityFollowers, VisibilityCommunityOnly, VisibilityOrganizationMembers:
		return publisher || (claims.VisibilityGrants != nil && claims.VisibilityGrants[p.Visibility]), nil
	case VisibilityModerators:
		return moderator || publisher, nil
	case VisibilityAdmins:
		return publisher, nil
	default:
		return false, nil
	}
}
