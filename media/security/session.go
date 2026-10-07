package security

import (
	"context"
	"errors"
	"strings"
	"time"
)

var (
	ErrSessionRequired = errors.New("420media security: verified session required")
	ErrSessionExpired  = errors.New("420media security: session expired")
	ErrSessionScope    = errors.New("420media security: session scope denied")
)

type SessionClaims struct {
	SessionID    string
	Actor        string
	Wallet       string
	ChainID      uint64
	Network      string
	ExpiresAt    time.Time
	Capabilities map[string]bool
}

type SessionVerifier interface {
	Verify(context.Context, string) (SessionClaims, error)
}

func RequireSession(
	ctx context.Context,
	verifier SessionVerifier,
	token string,
	expectedChainID uint64,
	expectedNetwork string,
	capability string,
	now time.Time,
) (SessionClaims, error) {
	if verifier == nil || strings.TrimSpace(token) == "" {
		return SessionClaims{}, ErrSessionRequired
	}
	claims, err := verifier.Verify(ctx, strings.TrimSpace(token))
	if err != nil {
		return SessionClaims{}, ErrSessionRequired
	}
	if strings.TrimSpace(claims.SessionID) == "" || strings.TrimSpace(claims.Actor) == "" ||
		strings.TrimSpace(claims.Wallet) == "" || claims.ChainID == 0 || strings.TrimSpace(claims.Network) == "" {
		return SessionClaims{}, ErrSessionRequired
	}
	if claims.ExpiresAt.IsZero() || !now.UTC().Before(claims.ExpiresAt.UTC()) {
		return SessionClaims{}, ErrSessionExpired
	}
	if expectedChainID != 0 && claims.ChainID != expectedChainID {
		return SessionClaims{}, ErrSessionScope
	}
	if strings.TrimSpace(expectedNetwork) != "" && claims.Network != expectedNetwork {
		return SessionClaims{}, ErrSessionScope
	}
	if capability != "" && !claims.Capabilities[capability] {
		return SessionClaims{}, ErrSessionScope
	}
	return claims, nil
}
