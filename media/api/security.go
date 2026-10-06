package api

import (
	"context"
	"errors"
	"net/http"
	"strings"
	"time"

	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

type actorContextKey struct{}

type SecurityConfig struct {
	Sessions        mediasecurity.SessionVerifier
	Moderation      *mediasecurity.ModerationService
	ExpectedChainID uint64
	ExpectedNetwork string
	Now             func() time.Time
}

func NewSecureServer(backend Backend, config SecurityConfig) (*Server, error) {
	if config.Sessions == nil || config.Moderation == nil || config.ExpectedChainID == 0 || strings.TrimSpace(config.ExpectedNetwork) == "" {
		return nil, errors.New("420media api: complete security configuration is required")
	}
	server, err := NewServer(backend)
	if err != nil {
		return nil, err
	}
	server.Security = &config
	return server, nil
}

func AuthenticatedActor(ctx context.Context) (mediasecurity.SessionClaims, bool) {
	claims, ok := ctx.Value(actorContextKey{}).(mediasecurity.SessionClaims)
	return claims, ok
}

func (s *Server) securityMiddleware(next http.Handler) http.Handler {
	if s.Security == nil {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capability, protected := protectedCapability(r.Method, r.URL.Path)
		if !protected {
			next.ServeHTTP(w, r)
			return
		}
		token := bearerToken(r.Header.Get("Authorization"))
		now := time.Now().UTC()
		if s.Security.Now != nil {
			now = s.Security.Now().UTC()
		}
		claims, err := mediasecurity.RequireSession(
			r.Context(), s.Security.Sessions, token,
			s.Security.ExpectedChainID, s.Security.ExpectedNetwork, capability, now,
		)
		if err != nil {
			s.fail(w, http.StatusUnauthorized, CodeUnauthorized, err.Error())
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), actorContextKey{}, claims)))
	})
}

func protectedCapability(method, path string) (string, bool) {
	if method == http.MethodPost && path == "/v1/uploads/prepare" {
		return "media.upload", true
	}
	if method == http.MethodPost && strings.HasPrefix(path, "/v1/livestreams") {
		return "media.livestream", true
	}
	if (method == http.MethodPost || method == http.MethodDelete) && strings.HasPrefix(path, "/v1/notifications/subscriptions") {
		return "media.notifications", true
	}
	if method == http.MethodPost && path == "/v1/signing/intents" {
		return "media.sign", true
	}
	if method == http.MethodPost && path == "/v1/moderation/reports" {
		return "media.report", true
	}
	if method == http.MethodPost && strings.Contains(path, "/appeals") {
		return "media.appeal", true
	}
	if method == http.MethodPost && strings.Contains(path, "/decisions") {
		return "media.moderate", true
	}
	return "", false
}

func bearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}

func requireActorMatch(ctx context.Context, values ...string) error {
	if claims, ok := AuthenticatedActor(ctx); ok {
		for _, value := range values {
			if strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(claims.Actor)) ||
				strings.EqualFold(strings.TrimSpace(value), strings.TrimSpace(claims.Wallet)) {
				return nil
			}
		}
		return mediasecurity.ErrSessionScope
	}
	return nil
}

func (s *Server) handleModerationReport(w http.ResponseWriter, r *http.Request) {
	if s.Security == nil || s.Security.Moderation == nil {
		s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, "moderation service unavailable")
		return
	}
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, _ string, body []byte) (any, error) {
		var req mediasecurity.Report
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		if err := requireActorMatch(ctx, req.ReporterRef); err != nil {
			return nil, codedSecurityError{code: CodeForbidden, err: err}
		}
		return s.Security.Moderation.Report(ctx, req)
	})
}

func (s *Server) handleModerationDecision(w http.ResponseWriter, r *http.Request) {
	if s.Security == nil || s.Security.Moderation == nil {
		s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, "moderation service unavailable")
		return
	}
	reportID := strings.TrimSpace(r.PathValue("id"))
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, _ string, body []byte) (any, error) {
		var req mediasecurity.Decision
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		if req.ReportID == "" {
			req.ReportID = reportID
		}
		if req.ReportID != reportID {
			return nil, requestError{err: mediasecurity.ErrInvalidModeration}
		}
		if err := requireActorMatch(ctx, req.ModeratorRef); err != nil {
			return nil, codedSecurityError{code: CodeForbidden, err: err}
		}
		return s.Security.Moderation.Decide(ctx, req)
	})
}

func (s *Server) handleModerationAppeal(w http.ResponseWriter, r *http.Request) {
	if s.Security == nil || s.Security.Moderation == nil {
		s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, "moderation service unavailable")
		return
	}
	decisionID := strings.TrimSpace(r.PathValue("id"))
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, _ string, body []byte) (any, error) {
		var req mediasecurity.Appeal
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		if req.DecisionID == "" {
			req.DecisionID = decisionID
		}
		if req.DecisionID != decisionID {
			return nil, requestError{err: mediasecurity.ErrInvalidModeration}
		}
		if err := requireActorMatch(ctx, req.AppellantRef); err != nil {
			return nil, codedSecurityError{code: CodeForbidden, err: err}
		}
		return s.Security.Moderation.Appeal(ctx, req)
	})
}

type codedSecurityError struct {
	code ErrorCode
	err  error
}

func (e codedSecurityError) Error() string           { return e.err.Error() }
func (e codedSecurityError) Unwrap() error           { return e.err }
func (e codedSecurityError) APIErrorCode() ErrorCode { return e.code }
