package livestream

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/media/node/livegateway"
	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

const (
	FeatureLivestreaming               = "media.livestreaming"
	DefaultMaxReconnectAttempts uint32 = 3
)

var (
	ErrInvalidRequest    = errors.New("420media livestream: invalid request")
	ErrFeatureDisabled   = errors.New("420media livestream: feature disabled")
	ErrUnauthorized      = errors.New("420media livestream: unauthorized controller")
	ErrSessionExists     = errors.New("420media livestream: session exists")
	ErrSessionNotFound   = errors.New("420media livestream: session not found")
	ErrPersistence       = errors.New("420media livestream: persistence failure")
	ErrRecoveryExhausted = errors.New("420media livestream: reconnect attempts exhausted")
	ErrGatewayState      = errors.New("420media livestream: gateway state unavailable")
)

type FeatureGate interface {
	Enabled(context.Context, string) (bool, error)
}

type FixedFeatureGate struct {
	Livestreaming bool
}

func (g FixedFeatureGate) Enabled(_ context.Context, key string) (bool, error) {
	return key == FeatureLivestreaming && g.Livestreaming, nil
}

type StreamSnapshot struct {
	Controller string
	Retired    bool
}

type StreamAuthority interface {
	Snapshot(context.Context, [32]byte) (StreamSnapshot, error)
}

type Gateway interface {
	Start(context.Context, livegateway.SessionSpec) (livegateway.Session, error)
	Restart(context.Context, string) (livegateway.Session, error)
	Stop(context.Context, string) (livegateway.Session, error)
	Get(string) (livegateway.Session, bool)
}

type Record struct {
	ID                string                   `json:"id"`
	Controller        string                   `json:"controller"`
	Spec              livegateway.SessionSpec  `json:"spec"`
	State             livegateway.SessionState `json:"state"`
	DesiredLive       bool                     `json:"desired_live"`
	ReconnectAttempts uint32                   `json:"reconnect_attempts"`
	LastError         string                   `json:"last_error,omitempty"`
	CreatedAt         time.Time                `json:"created_at"`
	UpdatedAt         time.Time                `json:"updated_at"`
	StartedAt         time.Time                `json:"started_at,omitempty"`
	EndedAt           time.Time                `json:"ended_at,omitempty"`
}

type Store interface {
	Create(context.Context, Record) (bool, error)
	Get(context.Context, string) (Record, bool, error)
	Save(context.Context, Record) error
	List(context.Context) ([]Record, error)
}

type Service struct {
	Gate                 FeatureGate
	Authority            StreamAuthority
	Gateway              Gateway
	Store                Store
	MaxReconnectAttempts uint32
	Now                  func() time.Time
}

func (s Service) Create(ctx context.Context, caller string, spec livegateway.SessionSpec) (Record, error) {
	if err := s.ready(); err != nil {
		return Record{}, err
	}
	if err := s.requireEnabled(ctx); err != nil {
		return Record{}, err
	}
	if err := livegateway.ValidateSpec(spec); err != nil {
		return Record{}, err
	}
	if err := validateSecureEndpoint(spec); err != nil {
		return Record{}, err
	}
	controller, err := s.requireController(ctx, caller, spec.StreamRef, false)
	if err != nil {
		return Record{}, err
	}
	now := s.now()
	record := Record{
		ID: spec.ID, Controller: controller, Spec: spec, State: livegateway.StateCreated,
		CreatedAt: now, UpdatedAt: now,
	}
	created, err := s.Store.Create(ctx, record)
	if err != nil {
		return Record{}, fmt.Errorf("%w: %v", ErrPersistence, err)
	}
	if !created {
		return Record{}, ErrSessionExists
	}
	return record, nil
}

func (s Service) Start(ctx context.Context, caller, id string) (Record, error) {
	if err := s.ready(); err != nil {
		return Record{}, err
	}
	if err := s.requireEnabled(ctx); err != nil {
		return Record{}, err
	}
	record, err := s.loadAuthorized(ctx, caller, id, false)
	if err != nil {
		return Record{}, err
	}
	if record.State == livegateway.StateActive && record.DesiredLive {
		return record, nil
	}
	if record.ReconnectAttempts >= s.maxReconnectAttempts() && record.State == livegateway.StateFailed {
		return record, ErrRecoveryExhausted
	}

	record.DesiredLive = true
	record.State = livegateway.StateStarting
	record.LastError = ""
	record.UpdatedAt = s.now()
	if err := s.save(ctx, record); err != nil {
		return Record{}, err
	}

	session, err := s.startGateway(ctx, record)
	if err != nil {
		return s.recordFailure(ctx, record, err)
	}
	return s.recordGatewayState(ctx, record, session, true)
}

func (s Service) Stop(ctx context.Context, caller, id string) (Record, error) {
	if err := s.ready(); err != nil {
		return Record{}, err
	}
	record, err := s.loadAuthorized(ctx, caller, id, true)
	if err != nil {
		return Record{}, err
	}

	record.DesiredLive = false
	record.UpdatedAt = s.now()
	if err := s.save(ctx, record); err != nil {
		return Record{}, err
	}

	session, ok := s.Gateway.Get(record.ID)
	if !ok {
		record.State = livegateway.StateFailed
		record.LastError = ErrGatewayState.Error()
		record.UpdatedAt = s.now()
		_ = s.save(ctx, record)
		return record, ErrGatewayState
	}
	if session.State == livegateway.StateClosed || session.State == livegateway.StateFailed {
		record.State = livegateway.StateClosed
		record.LastError = ""
		record.EndedAt = s.now()
		record.UpdatedAt = record.EndedAt
		if err := s.save(ctx, record); err != nil {
			return Record{}, err
		}
		return record, nil
	}
	if session.State != livegateway.StateActive {
		return record, livegateway.ErrInvalidTransition
	}

	record.State = livegateway.StateStopping
	record.UpdatedAt = s.now()
	if err := s.save(ctx, record); err != nil {
		return Record{}, err
	}
	stopped, err := s.Gateway.Stop(ctx, record.ID)
	if err != nil {
		return s.recordFailure(ctx, record, err)
	}
	return s.recordGatewayState(ctx, record, stopped, false)
}

func (s Service) Status(ctx context.Context, caller, id string) (Record, error) {
	if err := s.ready(); err != nil {
		return Record{}, err
	}
	return s.loadAuthorized(ctx, caller, id, true)
}

func (s Service) Recover(ctx context.Context) ([]Record, error) {
	if err := s.ready(); err != nil {
		return nil, err
	}
	if err := s.requireEnabled(ctx); err != nil {
		return nil, err
	}
	records, err := s.Store.List(ctx)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrPersistence, err)
	}
	out := make([]Record, 0, len(records))
	var firstErr error
	for _, record := range records {
		if !record.DesiredLive {
			continue
		}
		snapshot, authErr := s.Authority.Snapshot(ctx, record.Spec.StreamRef)
		if authErr != nil {
			record.State = livegateway.StateFailed
			record.LastError = authErr.Error()
			record.UpdatedAt = s.now()
			_ = s.save(ctx, record)
			out = append(out, record)
			if firstErr == nil {
				firstErr = authErr
			}
			continue
		}
		if snapshot.Retired || normalizeController(snapshot.Controller) == "" || normalizeController(snapshot.Controller) != normalizeController(record.Controller) {
			record.DesiredLive = false
			record.State = livegateway.StateFailed
			record.LastError = ErrUnauthorized.Error()
			record.UpdatedAt = s.now()
			_ = s.save(ctx, record)
			out = append(out, record)
			if firstErr == nil {
				firstErr = ErrUnauthorized
			}
			continue
		}
		if record.ReconnectAttempts >= s.maxReconnectAttempts() {
			record.State = livegateway.StateFailed
			record.LastError = ErrRecoveryExhausted.Error()
			record.UpdatedAt = s.now()
			_ = s.save(ctx, record)
			out = append(out, record)
			if firstErr == nil {
				firstErr = ErrRecoveryExhausted
			}
			continue
		}

		session, startErr := s.startGateway(ctx, record)
		if startErr != nil {
			failed, persistErr := s.recordFailure(ctx, record, startErr)
			out = append(out, failed)
			if firstErr == nil {
				firstErr = startErr
				if persistErr != nil {
					firstErr = persistErr
				}
			}
			continue
		}
		recovered, persistErr := s.recordGatewayState(ctx, record, session, true)
		out = append(out, recovered)
		if persistErr != nil && firstErr == nil {
			firstErr = persistErr
		}
	}
	return out, firstErr
}

func (s Service) startGateway(ctx context.Context, record Record) (livegateway.Session, error) {
	existing, ok := s.Gateway.Get(record.ID)
	if !ok {
		return s.Gateway.Start(ctx, record.Spec)
	}
	switch existing.State {
	case livegateway.StateActive:
		return existing, nil
	case livegateway.StateFailed, livegateway.StateClosed:
		return s.Gateway.Restart(ctx, record.ID)
	default:
		return livegateway.Session{}, livegateway.ErrInvalidTransition
	}
}

func (s Service) recordFailure(ctx context.Context, record Record, cause error) (Record, error) {
	record.State = livegateway.StateFailed
	record.LastError = cause.Error()
	record.ReconnectAttempts++
	record.EndedAt = s.now()
	record.UpdatedAt = record.EndedAt
	if err := s.save(ctx, record); err != nil {
		return record, err
	}
	return record, cause
}

func (s Service) recordGatewayState(ctx context.Context, record Record, session livegateway.Session, resetAttempts bool) (Record, error) {
	record.State = session.State
	record.StartedAt = session.StartedAt
	record.EndedAt = session.EndedAt
	record.LastError = session.LastError
	record.UpdatedAt = s.now()
	if resetAttempts && session.State == livegateway.StateActive {
		record.ReconnectAttempts = 0
	}
	if err := s.save(ctx, record); err != nil {
		return Record{}, err
	}
	return record, nil
}

func (s Service) loadAuthorized(ctx context.Context, caller, id string, allowRetired bool) (Record, error) {
	if strings.TrimSpace(id) == "" {
		return Record{}, ErrInvalidRequest
	}
	record, ok, err := s.Store.Get(ctx, id)
	if err != nil {
		return Record{}, fmt.Errorf("%w: %v", ErrPersistence, err)
	}
	if !ok {
		return Record{}, ErrSessionNotFound
	}
	controller, err := s.requireController(ctx, caller, record.Spec.StreamRef, allowRetired)
	if err != nil {
		return Record{}, err
	}
	if normalizeController(controller) != normalizeController(record.Controller) {
		return Record{}, ErrUnauthorized
	}
	return record, nil
}

func (s Service) requireController(ctx context.Context, caller string, streamRef [32]byte, allowRetired bool) (string, error) {
	if strings.TrimSpace(caller) == "" || streamRef == ([32]byte{}) {
		return "", ErrInvalidRequest
	}
	snapshot, err := s.Authority.Snapshot(ctx, streamRef)
	if err != nil {
		return "", err
	}
	if snapshot.Retired && !allowRetired {
		return "", ErrUnauthorized
	}
	if normalizeController(snapshot.Controller) == "" || normalizeController(snapshot.Controller) != normalizeController(caller) {
		return "", ErrUnauthorized
	}
	return snapshot.Controller, nil
}

func (s Service) requireEnabled(ctx context.Context) error {
	enabled, err := s.Gate.Enabled(ctx, FeatureLivestreaming)
	if err != nil {
		return err
	}
	if !enabled {
		return ErrFeatureDisabled
	}
	return nil
}

func (s Service) ready() error {
	if s.Gate == nil || s.Authority == nil || s.Gateway == nil || s.Store == nil {
		return ErrInvalidRequest
	}
	return nil
}

func (s Service) save(ctx context.Context, record Record) error {
	if err := s.Store.Save(ctx, record); err != nil {
		return fmt.Errorf("%w: %v", ErrPersistence, err)
	}
	return nil
}

func (s Service) maxReconnectAttempts() uint32 {
	if s.MaxReconnectAttempts == 0 {
		return DefaultMaxReconnectAttempts
	}
	return s.MaxReconnectAttempts
}

func (s Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func normalizeController(v string) string {
	return strings.ToLower(strings.TrimSpace(v))
}

func validateSecureEndpoint(spec livegateway.SessionSpec) error {
	switch spec.Protocol {
	case livegateway.ProtocolWHIP, livegateway.ProtocolWHEP:
		return mediasecurity.ValidateOutboundEndpoint(spec.Endpoint, "https")
	case livegateway.ProtocolRTMP:
		return mediasecurity.ValidateOutboundEndpoint(spec.Endpoint, "rtmps")
	case livegateway.ProtocolSRT:
		return mediasecurity.ValidateOutboundEndpoint(spec.Endpoint, "srt")
	case livegateway.ProtocolWebRTC:
		return mediasecurity.ValidateOutboundEndpoint(spec.Endpoint, "webrtc")
	default:
		return mediasecurity.ErrInvalidEndpoint
	}
}
