package publicservice

import (
	"encoding/json"
	"errors"
	"net"
	"net/http"
	"strconv"
	"strings"
	"time"

	appstoreapi "github.com/420integrated/420-integrated/appstore/api"
	"github.com/420integrated/420-integrated/appstore/hardening"
	appstoreruntime "github.com/420integrated/420-integrated/appstore/runtime"
	"github.com/420integrated/420-integrated/appstore/security"
	appstoreweb "github.com/420integrated/420-integrated/appstore/web"
)

var ErrInvalidPublicService = errors.New("invalid appstore public service")

type ViewSource interface {
	Snapshot() []appstoreapi.ApplicationView
}

type DependencySource interface {
	Dependencies() hardening.Dependencies
}

type Config struct {
	RateLimit  int
	RateWindow time.Duration
}

type Service struct {
	runtime      *appstoreruntime.Service
	views        ViewSource
	dependencies DependencySource
	limiter      *hardening.Limiter
	web          http.Handler
}

func New(runtime *appstoreruntime.Service, views ViewSource, dependencies DependencySource, cfg Config) (*Service, error) {
	if runtime == nil || views == nil || dependencies == nil {
		return nil, ErrInvalidPublicService
	}
	if cfg.RateLimit < 1 {
		cfg.RateLimit = 120
	}
	if cfg.RateWindow <= 0 {
		cfg.RateWindow = time.Minute
	}
	return &Service{
		runtime:      runtime,
		views:        views,
		dependencies: dependencies,
		limiter:      hardening.NewLimiter(cfg.RateLimit, cfg.RateWindow),
		web:          appstoreweb.Handler(),
	}, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", s.handleHealth)
	mux.HandleFunc("GET /readyz", s.handleReady)
	mux.Handle("/v1/apps", s.limit(http.HandlerFunc(s.handleAPI)))
	mux.Handle("/v1/apps/", s.limit(http.HandlerFunc(s.handleAPI)))
	mux.Handle("/", s.web)
	return securityHeaders(mux)
}

func (s *Service) handleHealth(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"service":   "420AppStore",
		"status":    "ok",
		"canonical": false,
	})
}

func (s *Service) handleReady(w http.ResponseWriter, _ *http.Request) {
	assessment := s.assessment()
	status := http.StatusOK
	ready := assessment.Mode != hardening.ModeBlocked
	if !ready {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{
		"service":      "420AppStore",
		"ready":        ready,
		"dependencies": assessment,
	})
}

func (s *Service) handleAPI(w http.ResponseWriter, r *http.Request) {
	assessment := s.assessment()
	if assessment.Mode == hardening.ModeBlocked || !assessment.CanServeCanonical || !assessment.CanBrowse {
		writeJSON(w, http.StatusServiceUnavailable, map[string]any{
			"error":        "canonical application catalogue unavailable",
			"dependencies": assessment,
		})
		return
	}

	views := s.views.Snapshot()
	if !assessment.CanVerify {
		views = withoutVerificationEvidence(views)
	}
	api, err := appstoreapi.New(views)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "application catalogue unavailable"})
		return
	}
	api.Handler().ServeHTTP(w, r)
}

func (s *Service) assessment() hardening.DependencyAssessment {
	deps := s.dependencies.Dependencies()
	if !s.runtime.Ready() {
		deps.Registry = false
		deps.RPC = false
	}
	return hardening.AssessDependencies(deps)
}

func (s *Service) limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := abuseKey(r)
		if !s.limiter.Allow(key, time.Now()) {
			w.Header().Set("Retry-After", strconv.Itoa(60))
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "rate limit exceeded"})
			return
		}
		next.ServeHTTP(w, r)
	})
}

func abuseKey(r *http.Request) string {
	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil && host != "" {
		return host
	}
	return strings.TrimSpace(r.RemoteAddr)
}

func withoutVerificationEvidence(views []appstoreapi.ApplicationView) []appstoreapi.ApplicationView {
	out := make([]appstoreapi.ApplicationView, len(views))
	copy(out, views)
	for i := range out {
		evidence := make([]security.Evidence, 0, len(out[i].Security.Evidence))
		for _, item := range out[i].Security.Evidence {
			if item.Kind != security.KindVerification {
				evidence = append(evidence, item)
			}
		}
		out[i].Security.Evidence = evidence

		warnings := make([]security.Evidence, 0, len(out[i].Security.Warnings))
		for _, item := range out[i].Security.Warnings {
			if item.Kind != security.KindVerification {
				warnings = append(warnings, item)
			}
		}
		out[i].Security.Warnings = warnings
	}
	return out
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
