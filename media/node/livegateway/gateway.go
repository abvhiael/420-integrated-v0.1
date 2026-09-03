package livegateway

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"sync"
	"time"
)

type Protocol string

type Direction string

type SessionState string

const (
	ProtocolWHIP Protocol = "whip"
	ProtocolWHEP Protocol = "whep"
	ProtocolWebRTC Protocol = "webrtc"
	ProtocolSRT Protocol = "srt"
	ProtocolRTMP Protocol = "rtmp"
)

const (
	DirectionIngress Direction = "ingress"
	DirectionEgress  Direction = "egress"
)

const (
	StateCreated SessionState = "created"
	StateStarting SessionState = "starting"
	StateActive SessionState = "active"
	StateStopping SessionState = "stopping"
	StateClosed SessionState = "closed"
	StateFailed SessionState = "failed"
)

var (
	ErrUnsupportedProtocol = errors.New("420media livegateway: unsupported protocol")
	ErrInvalidEndpoint = errors.New("420media livegateway: invalid endpoint")
	ErrInvalidTransition = errors.New("420media livegateway: invalid session transition")
	ErrSessionExists = errors.New("420media livegateway: session exists")
	ErrSessionNotFound = errors.New("420media livegateway: session not found")
	ErrSecretInEndpoint = errors.New("420media livegateway: credentials must not be embedded in endpoint")
)

// CredentialRef is an opaque operator-local reference. Secret material is resolved only
// inside a transport driver and is never represented in chain-facing job state.
type CredentialRef string

type SessionSpec struct {
	ID            string
	Protocol      Protocol
	Direction     Direction
	Endpoint      string
	CredentialRef CredentialRef
	StreamRef     [32]byte
	MaxDuration   time.Duration
}

type Session struct {
	Spec      SessionSpec
	State     SessionState
	StartedAt time.Time
	EndedAt   time.Time
	LastError string
}

// Driver owns protocol-specific setup/teardown. Implementations may wrap a WHIP/WHEP
// HTTP endpoint, a WebRTC stack, or SRT/RTMP gateway software. Raw media never passes
// through this control-plane interface.
type Driver interface {
	Start(ctx context.Context, spec SessionSpec) error
	Stop(ctx context.Context, spec SessionSpec) error
}

type Registry struct {
	mu       sync.RWMutex
	drivers  map[Protocol]Driver
	sessions map[string]Session
	now      func() time.Time
}

func New(drivers map[Protocol]Driver) (*Registry, error) {
	if len(drivers) == 0 {
		return nil, ErrUnsupportedProtocol
	}
	for protocol, driver := range drivers {
		if !supported(protocol) || driver == nil {
			return nil, ErrUnsupportedProtocol
		}
	}
	return &Registry{
		drivers: drivers,
		sessions: make(map[string]Session),
		now: time.Now,
	}, nil
}

func (r *Registry) Start(ctx context.Context, spec SessionSpec) (Session, error) {
	if err := validateSpec(spec); err != nil {
		return Session{}, err
	}
	driver, ok := r.drivers[spec.Protocol]
	if !ok {
		return Session{}, ErrUnsupportedProtocol
	}

	r.mu.Lock()
	if _, exists := r.sessions[spec.ID]; exists {
		r.mu.Unlock()
		return Session{}, ErrSessionExists
	}
	starting := Session{Spec: spec, State: StateStarting}
	r.sessions[spec.ID] = starting
	r.mu.Unlock()

	if err := driver.Start(ctx, spec); err != nil {
		r.mu.Lock()
		failed := r.sessions[spec.ID]
		failed.State = StateFailed
		failed.LastError = err.Error()
		failed.EndedAt = r.now()
		r.sessions[spec.ID] = failed
		r.mu.Unlock()
		return failed, err
	}

	r.mu.Lock()
	active := r.sessions[spec.ID]
	active.State = StateActive
	active.StartedAt = r.now()
	r.sessions[spec.ID] = active
	r.mu.Unlock()
	return active, nil
}

func (r *Registry) Stop(ctx context.Context, id string) (Session, error) {
	r.mu.Lock()
	session, ok := r.sessions[id]
	if !ok {
		r.mu.Unlock()
		return Session{}, ErrSessionNotFound
	}
	if session.State != StateActive {
		r.mu.Unlock()
		return Session{}, ErrInvalidTransition
	}
	session.State = StateStopping
	r.sessions[id] = session
	r.mu.Unlock()

	driver := r.drivers[session.Spec.Protocol]
	if err := driver.Stop(ctx, session.Spec); err != nil {
		r.mu.Lock()
		failed := r.sessions[id]
		failed.State = StateFailed
		failed.LastError = err.Error()
		failed.EndedAt = r.now()
		r.sessions[id] = failed
		r.mu.Unlock()
		return failed, err
	}

	r.mu.Lock()
	closed := r.sessions[id]
	closed.State = StateClosed
	closed.EndedAt = r.now()
	r.sessions[id] = closed
	r.mu.Unlock()
	return closed, nil
}

func (r *Registry) Get(id string) (Session, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	session, ok := r.sessions[id]
	return session, ok
}

func validateSpec(spec SessionSpec) error {
	if spec.ID == "" || spec.StreamRef == ([32]byte{}) || !supported(spec.Protocol) {
		return ErrUnsupportedProtocol
	}
	if spec.Direction != DirectionIngress && spec.Direction != DirectionEgress {
		return ErrInvalidEndpoint
	}
	if spec.MaxDuration < 0 {
		return ErrInvalidEndpoint
	}
	u, err := url.Parse(spec.Endpoint)
	if err != nil || u.Scheme == "" || u.Host == "" {
		return ErrInvalidEndpoint
	}
	if u.User != nil {
		return ErrSecretInEndpoint
	}
	if !schemeAllowed(spec.Protocol, strings.ToLower(u.Scheme)) {
		return fmt.Errorf("%w: protocol=%s scheme=%s", ErrInvalidEndpoint, spec.Protocol, u.Scheme)
	}
	return nil
}

func supported(protocol Protocol) bool {
	switch protocol {
	case ProtocolWHIP, ProtocolWHEP, ProtocolWebRTC, ProtocolSRT, ProtocolRTMP:
		return true
	default:
		return false
	}
}

func schemeAllowed(protocol Protocol, scheme string) bool {
	switch protocol {
	case ProtocolWHIP, ProtocolWHEP:
		return scheme == "https" || scheme == "http"
	case ProtocolWebRTC:
		return scheme == "webrtc"
	case ProtocolSRT:
		return scheme == "srt"
	case ProtocolRTMP:
		return scheme == "rtmp" || scheme == "rtmps"
	default:
		return false
	}
}
