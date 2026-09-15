package storage

import (
	"context"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"
)

type GatewayHTTPObservation struct {
	Method      string
	AccessMode  GatewayAccessMode
	StatusCode  int
	Tier        string
	Ranged      bool
	Conditional bool
	Duration    time.Duration
	Bytes       int64
}

type GatewayHTTPObserver interface {
	ObserveGatewayHTTP(context.Context, GatewayHTTPObservation)
}

type GatewayHTTPObserverFunc func(context.Context, GatewayHTTPObservation)

func (f GatewayHTTPObserverFunc) ObserveGatewayHTTP(ctx context.Context, observation GatewayHTTPObservation) {
	if f != nil {
		f(ctx, observation)
	}
}

type GatewayHTTPMetricsSnapshot struct {
	Requests        uint64
	Responses2xx    uint64
	Responses3xx    uint64
	Responses4xx    uint64
	Responses5xx    uint64
	PublicRequests  uint64
	PrivateRequests uint64
	RangeRequests   uint64
	Conditional     uint64
	ResponseBytes   uint64
	CumulativeNanos uint64
}

type GatewayHTTPMetrics struct {
	mu       sync.Mutex
	snapshot GatewayHTTPMetricsSnapshot
}

func (m *GatewayHTTPMetrics) ObserveGatewayHTTP(_ context.Context, observation GatewayHTTPObservation) {
	if m == nil {
		return
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	m.snapshot.Requests++
	switch observation.StatusCode / 100 {
	case 2:
		m.snapshot.Responses2xx++
	case 3:
		m.snapshot.Responses3xx++
	case 4:
		m.snapshot.Responses4xx++
	case 5:
		m.snapshot.Responses5xx++
	}
	switch observation.AccessMode {
	case GatewayAccessPrivate:
		m.snapshot.PrivateRequests++
	default:
		m.snapshot.PublicRequests++
	}
	if observation.Ranged {
		m.snapshot.RangeRequests++
	}
	if observation.Conditional {
		m.snapshot.Conditional++
	}
	if observation.Bytes > 0 {
		m.snapshot.ResponseBytes += uint64(observation.Bytes)
	}
	if observation.Duration > 0 {
		m.snapshot.CumulativeNanos += uint64(observation.Duration)
	}
}

func (m *GatewayHTTPMetrics) Snapshot() GatewayHTTPMetricsSnapshot {
	if m == nil {
		return GatewayHTTPMetricsSnapshot{}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.snapshot
}

type GatewaySlogObserver struct {
	Logger *slog.Logger
}

func (o GatewaySlogObserver) ObserveGatewayHTTP(ctx context.Context, observation GatewayHTTPObservation) {
	if o.Logger == nil {
		return
	}
	o.Logger.InfoContext(ctx, "420gateway request",
		"method", observation.Method,
		"access_mode", string(observation.AccessMode),
		"status", observation.StatusCode,
		"tier", observation.Tier,
		"ranged", observation.Ranged,
		"conditional", observation.Conditional,
		"duration_ms", observation.Duration.Milliseconds(),
		"bytes", observation.Bytes,
	)
}

type gatewayObservationResponseRecorder struct {
	http.ResponseWriter
	status int
	bytes  int64
}

func (r *gatewayObservationResponseRecorder) Unwrap() http.ResponseWriter {
	return r.ResponseWriter
}

func (r *gatewayObservationResponseRecorder) WriteHeader(status int) {
	if r.status != 0 {
		return
	}
	r.status = status
	r.ResponseWriter.WriteHeader(status)
}

func (r *gatewayObservationResponseRecorder) Write(payload []byte) (int, error) {
	if r.status == 0 {
		r.WriteHeader(http.StatusOK)
	}
	n, err := r.ResponseWriter.Write(payload)
	r.bytes += int64(n)
	return n, err
}

func gatewayObservedHandler(observers []GatewayHTTPObserver, next http.Handler) http.Handler {
	active := make([]GatewayHTTPObserver, 0, len(observers))
	for _, observer := range observers {
		if observer != nil {
			active = append(active, observer)
		}
	}
	if len(active) == 0 {
		return next
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/healthz" || r.URL.Path == "/readyz" {
			next.ServeHTTP(w, r)
			return
		}
		started := time.Now()
		recorder := &gatewayObservationResponseRecorder{ResponseWriter: w}
		next.ServeHTTP(recorder, r)
		status := recorder.status
		if status == 0 {
			status = http.StatusOK
		}
		mode := GatewayAccessMode(strings.ToLower(strings.TrimSpace(r.Header.Get(GatewayHeaderAccessMode))))
		if mode != GatewayAccessPrivate {
			mode = GatewayAccessPublic
		}
		observation := GatewayHTTPObservation{
			Method:      r.Method,
			AccessMode:  mode,
			StatusCode:  status,
			Tier:        recorder.Header().Get(GatewayHeaderTier),
			Ranged:      strings.TrimSpace(r.Header.Get("Range")) != "",
			Conditional: strings.TrimSpace(r.Header.Get("If-None-Match")) != "",
			Duration:    time.Since(started),
			Bytes:       recorder.bytes,
		}
		for _, observer := range active {
			observer.ObserveGatewayHTTP(r.Context(), observation)
		}
	})
}

func NewGatewayHTTPServiceWithObservability(listenAddr string, handler GatewayHTTPHandler, policy GatewayHTTPPolicy, transport GatewayHTTPTransportPolicy, observer GatewayHTTPObserver) (*GatewayHTTPService, *GatewayHTTPMetrics, error) {
	service, metrics, _, err := NewGatewayHTTPServiceWithHealthObservability(listenAddr, handler, policy, transport, nil, observer)
	return service, metrics, err
}

func NewGatewayHTTPServiceWithHealthObservability(listenAddr string, handler GatewayHTTPHandler, policy GatewayHTTPPolicy, transport GatewayHTTPTransportPolicy, health *GatewayHealthTracker, observer GatewayHTTPObserver) (*GatewayHTTPService, *GatewayHTTPMetrics, *GatewayHealthTracker, error) {
	service, err := NewGatewayHTTPServiceWithTransport(listenAddr, handler, policy, transport)
	if err != nil {
		return nil, nil, nil, err
	}
	metrics := &GatewayHTTPMetrics{}
	if health == nil {
		health = NewGatewayHealthTracker(0)
	}
	allowed, err := validateGatewayAllowedHosts(transport.AllowedHosts)
	if err != nil {
		_ = service.ln.Close()
		return nil, nil, nil, err
	}
	inner := gatewayHealthHandler(health, service.server.Handler)
	inner = gatewayHostGuard(allowed, inner)
	service.server.Handler = gatewayObservedHandler([]GatewayHTTPObserver{metrics, health, observer}, inner)
	return service, metrics, health, nil
}
