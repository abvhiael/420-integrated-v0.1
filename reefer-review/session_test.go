package reeferreview

import (
	"context"
	"errors"
	"testing"
	"time"
)

type rr4SessionMap map[string]SessionClaims

func (m rr4SessionMap) Verify(_ context.Context, token string) (SessionClaims, error) {
	claims, ok := m[token]
	if !ok {
		return SessionClaims{}, ErrSessionRequired
	}
	return claims, nil
}

func rr4Claims(subject string, capabilities ...string) SessionClaims {
	caps := map[string]bool{}
	for _, capability := range capabilities {
		caps[capability] = true
	}
	now := time.Now().UTC()
	return SessionClaims{
		SessionID:    "session-" + subject,
		Subject:      subject,
		Wallet:       "0x1111111111111111111111111111111111111111",
		Audience:     ServiceID,
		ChainID:      420,
		Network:      "testnet",
		IssuedAt:     now.Add(-time.Minute),
		ExpiresAt:      now.Add(time.Hour),
		IdentityActive: true,
		Capabilities:   caps,
	}
}

func rr4Verifier() rr4SessionMap {
	return rr4SessionMap{
		"writer":    rr4Claims("writer.420", CapabilityAuthor),
		"other":     rr4Claims("other.420", CapabilityAuthor),
		"publisher": rr4Claims("publisher.420", CapabilityPublisher),
		"moderator": rr4Claims("moderator.420", CapabilityModerator),
	}
}

func rr4HTTP(t *testing.T, service Service) HTTP {
	t.Helper()
	h, err := NewIdentityBoundHTTP(service, nil, SessionSecurity{
		Verifier: rr4Verifier(), ExpectedChainID: 420, ExpectedNetwork: "testnet",
	})
	if err != nil {
		t.Fatal(err)
	}
	return h
}

func TestRR4SessionValidationBoundaries(t *testing.T) {
	now := time.Now().UTC()
	valid := rr4Claims("writer.420", CapabilityAuthor)
	cases := []struct {
		name   string
		claims SessionClaims
		want   error
	}{
		{"expired", func() SessionClaims { c := valid; c.ExpiresAt = now.Add(-time.Second); return c }(), ErrSessionExpired},
		{"revoked", func() SessionClaims { c := valid; c.Revoked = true; return c }(), ErrSessionRevoked},
		{"inactive-identity", func() SessionClaims { c := valid; c.IdentityActive = false; return c }(), ErrSessionScope},
		{"wrong-audience", func() SessionClaims { c := valid; c.Audience = "other/service"; return c }(), ErrSessionInvalid},
		{"wrong-chain", func() SessionClaims { c := valid; c.ChainID = 1; return c }(), ErrSessionScope},
		{"wrong-network", func() SessionClaims { c := valid; c.Network = "mainnet"; return c }(), ErrSessionScope},
		{"missing-wallet", func() SessionClaims { c := valid; c.Wallet = ""; return c }(), ErrSessionInvalid},
		{"future-issued", func() SessionClaims { c := valid; c.IssuedAt = now.Add(2 * time.Minute); return c }(), ErrSessionInvalid},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			security := SessionSecurity{
				Verifier: rr4SessionMap{"token": tc.claims}, ExpectedChainID: 420, ExpectedNetwork: "testnet",
				Now: func() time.Time { return now },
			}
			_, err := security.Verify(context.Background(), "token")
			if !errors.Is(err, tc.want) {
				t.Fatalf("got %v want %v", err, tc.want)
			}
		})
	}
	security := SessionSecurity{
		Verifier: rr4SessionMap{"token": valid}, ExpectedChainID: 420, ExpectedNetwork: "testnet",
		Now: func() time.Time { return now },
	}
	if _, err := security.Verify(context.Background(), "token"); err != nil {
		t.Fatalf("valid session rejected: %v", err)
	}
	if _, err := security.Verify(context.Background(), "unknown"); !errors.Is(err, ErrSessionRequired) {
		t.Fatalf("unknown token should fail closed, got %v", err)
	}
}

func TestRR4SessionAuthorizerScopesCapabilities(t *testing.T) {
	p := Publication{Author: "writer.420", Status: StatusPublished, Visibility: VisibilityPrivate}
	authorCtx := WithSessionClaims(context.Background(), rr4Claims("writer.420", CapabilityAuthor))
	otherCtx := WithSessionClaims(context.Background(), rr4Claims("other.420", CapabilityAuthor))
	pubCtx := WithSessionClaims(context.Background(), rr4Claims("publisher.420", CapabilityPublisher))
	modCtx := WithSessionClaims(context.Background(), rr4Claims("moderator.420", CapabilityModerator))
	a := SessionAuthorizer{}
	if ok, _ := a.CanEdit(authorCtx, "writer.420", p); !ok {
		t.Fatal("author cannot edit own publication")
	}
	if ok, _ := a.CanEdit(otherCtx, "other.420", p); ok {
		t.Fatal("author capability crossed ownership boundary")
	}
	if ok, _ := a.CanEdit(pubCtx, "publisher.420", p); !ok {
		t.Fatal("publisher capability cannot edit")
	}
	if ok, _ := a.CanModerate(authorCtx, "writer.420", p); ok {
		t.Fatal("author capability granted moderation")
	}
	if ok, _ := a.CanModerate(modCtx, "moderator.420", p); !ok {
		t.Fatal("moderator capability denied")
	}
	if ok, _ := a.CanRead(otherCtx, "other.420", p); ok {
		t.Fatal("private read crossed ownership boundary")
	}
	if ok, _ := a.CanRead(pubCtx, "publisher.420", p); !ok {
		t.Fatal("publisher private read denied")
	}
}

func TestRR4VisibilityGrantIsSessionDerived(t *testing.T) {
	p := Publication{Author: "writer.420", Status: StatusPublished, Visibility: VisibilityCommunityOnly}
	claims := rr4Claims("reader.420")
	ctx := WithSessionClaims(context.Background(), claims)
	ok, _ := (SessionAuthorizer{}).CanRead(ctx, "reader.420", p)
	if ok {
		t.Fatal("community content readable without verifier-provided visibility grant")
	}
	claims.VisibilityGrants = map[Visibility]bool{VisibilityCommunityOnly: true}
	ctx = WithSessionClaims(context.Background(), claims)
	ok, _ = (SessionAuthorizer{}).CanRead(ctx, "reader.420", p)
	if !ok {
		t.Fatal("verifier-provided community visibility grant rejected")
	}
}

func TestRR4SecureCompositionFailsClosedWithoutVerifier(t *testing.T) {
	_, err := NewIdentityBoundHTTP(testService(), nil, SessionSecurity{ExpectedChainID: 420, ExpectedNetwork: "testnet"})
	if !errors.Is(err, ErrSessionRequired) {
		t.Fatalf("want session verifier requirement, got %v", err)
	}
}
