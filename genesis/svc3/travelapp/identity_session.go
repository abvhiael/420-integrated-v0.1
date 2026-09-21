package travelapp

import (
 "context"
 "errors"
 "net/http"
 "strings"
 "time"
)

const travelSessionCookie = "__Host-420travel-session"
const travelSessionAudience = "420travel"

var ErrIdentitySessionUnavailable = errors.New("identity session unavailable")

// IdentitySessionVerdict is issued by a trusted server-side 420Identity session
// verifier, not decoded from client-controlled headers, query strings or a
// browser-provided JWT payload. An authenticated verdict must be bound to the
// exact opaque session and audience, and must be checked again on every request.
type IdentitySessionVerdict struct {
 SubjectID string
 Audience string
 CSRFToken string
 ExpiresAt time.Time
 Revoked bool
}

// IdentitySessionVerifier is implemented by a deployment adapter connected to
// the authenticated 420Identity session service. The verifier must validate
// issuance, signature/session lookup, revocation, expiry and audience on the
// Identity side before returning a verdict. Implementations must not use
// untrusted client headers or stale local session caches as authority.
type IdentitySessionVerifier interface {
 VerifyTravelSession(context.Context, string) (IdentitySessionVerdict, error)
}

// IdentityCookieAdapter binds Travel's existing authenticated Trips/claims
// handler to an opaque, Secure, host-only session cookie. It does not create
// sessions or grant a user a new identity; login/logout remains owned by
// 420Identity and the deployment ingress. No verifier means no authentication.
type IdentityCookieAdapter struct {
 Verifier IdentitySessionVerifier
 Now func() time.Time
}

func (a IdentityCookieAdapter) Authenticate(r *http.Request) (VerifiedSession, error) {
 if a.Verifier == nil || r == nil || r.TLS == nil {
  return VerifiedSession{}, ErrIdentitySessionUnavailable
 }
 // Reject duplicate cookies rather than permitting first/last-parser ambiguity.
 var opaque string
 for _, cookie := range r.Cookies() {
  if cookie.Name != travelSessionCookie { continue }
  if opaque != "" || len(cookie.Value) < 32 || len(cookie.Value) > 512 ||
   strings.ContainsAny(cookie.Value, " \t\r\n;,") {
   return VerifiedSession{}, ErrTripUnauthorized
  }
  opaque = cookie.Value
 }
 if opaque == "" { return VerifiedSession{}, ErrTripUnauthorized }
 ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
 defer cancel()
 verdict, err := a.Verifier.VerifyTravelSession(ctx, opaque)
 if err != nil { return VerifiedSession{}, ErrIdentitySessionUnavailable }
 now := time.Now().UTC()
 if a.Now != nil { now = a.Now().UTC() }
 if verdict.Revoked || verdict.Audience != travelSessionAudience ||
  !verdict.ExpiresAt.After(now) || verdict.ExpiresAt.After(now.Add(24*time.Hour)) ||
  strings.TrimSpace(verdict.SubjectID) == "" || len(verdict.SubjectID) > 256 ||
  strings.TrimSpace(verdict.SubjectID) != verdict.SubjectID ||
  len(verdict.CSRFToken) < 32 || len(verdict.CSRFToken) > 256 {
  return VerifiedSession{}, ErrTripUnauthorized
 }
 return VerifiedSession{SubjectID:verdict.SubjectID, CSRFToken:verdict.CSRFToken}, nil
}

// NewIdentityBoundTravelHandler connects only a deployment-supplied verifier
// and repositories. The default development Handler() never initializes it.
// Claims must also be backed by a trusted Registry/Verify provenance adapter.
func NewIdentityBoundTravelHandler(reader PublicReader, verifier IdentitySessionVerifier, trips TripRepository, claims ClaimRepository) http.Handler {
 return HandlerWithUserDependencies(reader, TravelUserDependencies{
  Identity: IdentityCookieAdapter{Verifier:verifier}, Trips:trips, Claims:claims,
 })
}
