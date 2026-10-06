package mail

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"
)

const (
	MaxSecurityProofBytes = 64 << 10
	MaxSecurityLabelBytes = 80
)

var ErrSecurityInvalidResult = errors.New("mail: invalid security authority result")

type RecoveryAction string

const (
	RecoverySetAuthority RecoveryAction = "SET_AUTHORITY"
	RecoveryPropose      RecoveryAction = "PROPOSE"
	RecoveryCancel       RecoveryAction = "CANCEL"
	RecoveryFinalize     RecoveryAction = "FINALIZE"
)

type PasskeySummary struct {
	ID                 string    `json:"id"`
	Label              string    `json:"label,omitempty"`
	DeviceID           string    `json:"device_id,omitempty"`
	AuthorizationEpoch uint64    `json:"authorization_epoch"`
	Active             bool      `json:"active"`
	CreatedAt          time.Time `json:"created_at"`
}

type DeviceSummary struct {
	ID         string    `json:"id"`
	Label      string    `json:"label,omitempty"`
	Platform   string    `json:"platform,omitempty"`
	Active     bool      `json:"active"`
	EnrolledAt time.Time `json:"enrolled_at"`
}

type SessionSummary struct {
	ID                 string    `json:"id"`
	DeviceID           string    `json:"device_id,omitempty"`
	AuthorizationEpoch uint64    `json:"authorization_epoch"`
	Active             bool      `json:"active"`
	ExpiresAt          time.Time `json:"expires_at"`
}

type RecoverySummary struct {
	Enabled      bool       `json:"enabled"`
	Authority    string     `json:"authority,omitempty"`
	PendingOwner string     `json:"pending_owner,omitempty"`
	ExecutableAt *time.Time `json:"executable_at,omitempty"`
}

type SecurityAlert struct {
	ID           string    `json:"id"`
	Kind         string    `json:"kind"`
	Severity     string    `json:"severity"`
	CreatedAt    time.Time `json:"created_at"`
	Acknowledged bool      `json:"acknowledged"`
}

type SecurityState struct {
	Identity           string          `json:"identity"`
	AuthorizationEpoch uint64          `json:"authorization_epoch"`
	Passkeys           []PasskeySummary `json:"passkeys"`
	Devices            []DeviceSummary  `json:"devices"`
	Recovery           RecoverySummary  `json:"recovery"`
	Sessions           []SessionSummary `json:"sessions"`
	Alerts             []SecurityAlert  `json:"alerts"`
}

type PasskeyEnrollmentRequest struct {
	Attestation string `json:"attestation"`
	DeviceID    string `json:"device_id"`
	Label       string `json:"label,omitempty"`
}

type DeviceEnrollmentRequest struct {
	Proof    string `json:"proof"`
	Label    string `json:"label,omitempty"`
	Platform string `json:"platform,omitempty"`
}

type RecoveryRequest struct {
	Action        RecoveryAction `json:"action"`
	Account       string         `json:"account"`
	Authority     string         `json:"authority,omitempty"`
	ProposedOwner string         `json:"proposed_owner,omitempty"`
}

type SecurityAuthority interface {
	Snapshot(context.Context, string) (SecurityState, error)
	EnrollPasskey(context.Context, string, PasskeyEnrollmentRequest) (SecurityState, error)
	RevokePasskey(context.Context, string, string) (SecurityState, error)
	EnrollDevice(context.Context, string, DeviceEnrollmentRequest) (SecurityState, error)
	RevokeDevice(context.Context, string, string) (SecurityState, error)
	Recovery(context.Context, string, RecoveryRequest) (SecurityState, error)
	RevokeSession(context.Context, string, string) (SecurityState, error)
	AcknowledgeAlert(context.Context, string, string) (SecurityState, error)
}

type SecurityService struct {
	Authority SecurityAuthority
	Now       func() time.Time
}

func NewSecurityService(authority SecurityAuthority) *SecurityService {
	return &SecurityService{Authority: authority, Now: func() time.Time { return time.Now().UTC() }}
}

func (s *SecurityService) Snapshot(ctx context.Context, actor string) (SecurityState, error) {
	actor, err := validateSecurityActor(actor)
	if err != nil {
		return SecurityState{}, err
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.Snapshot(ctx, actor)
	})
}

func (s *SecurityService) EnrollPasskey(ctx context.Context, actor string, req PasskeyEnrollmentRequest) (SecurityState, error) {
	actor, err := validateSecurityActor(actor)
	if err != nil {
		return SecurityState{}, err
	}
	req.Attestation = strings.TrimSpace(req.Attestation)
	req.DeviceID = strings.TrimSpace(req.DeviceID)
	req.Label = strings.TrimSpace(req.Label)
	if req.Attestation == "" || req.DeviceID == "" || len([]byte(req.Attestation)) > MaxSecurityProofBytes || len([]byte(req.Label)) > MaxSecurityLabelBytes {
		return SecurityState{}, ErrInvalidInput
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.EnrollPasskey(ctx, actor, req)
	})
}

func (s *SecurityService) RevokePasskey(ctx context.Context, actor, id string) (SecurityState, error) {
	actor, id, err := validateSecurityID(actor, id)
	if err != nil {
		return SecurityState{}, err
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.RevokePasskey(ctx, actor, id)
	})
}

func (s *SecurityService) EnrollDevice(ctx context.Context, actor string, req DeviceEnrollmentRequest) (SecurityState, error) {
	actor, err := validateSecurityActor(actor)
	if err != nil {
		return SecurityState{}, err
	}
	req.Proof = strings.TrimSpace(req.Proof)
	req.Label = strings.TrimSpace(req.Label)
	req.Platform = strings.TrimSpace(req.Platform)
	if req.Proof == "" || len([]byte(req.Proof)) > MaxSecurityProofBytes || len([]byte(req.Label)) > MaxSecurityLabelBytes || len([]byte(req.Platform)) > MaxSecurityLabelBytes {
		return SecurityState{}, ErrInvalidInput
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.EnrollDevice(ctx, actor, req)
	})
}

func (s *SecurityService) RevokeDevice(ctx context.Context, actor, id string) (SecurityState, error) {
	actor, id, err := validateSecurityID(actor, id)
	if err != nil {
		return SecurityState{}, err
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.RevokeDevice(ctx, actor, id)
	})
}

func (s *SecurityService) Recovery(ctx context.Context, actor string, req RecoveryRequest) (SecurityState, error) {
	actor, err := validateSecurityActor(actor)
	if err != nil {
		return SecurityState{}, err
	}
	req.Account = strings.TrimSpace(req.Account)
	req.Authority = strings.TrimSpace(req.Authority)
	req.ProposedOwner = strings.TrimSpace(req.ProposedOwner)
	if !validWalletAddress(req.Account) {
		return SecurityState{}, ErrInvalidInput
	}
	switch req.Action {
	case RecoverySetAuthority:
		if !validWalletAddress(req.Authority) || req.ProposedOwner != "" {
			return SecurityState{}, ErrInvalidInput
		}
	case RecoveryPropose:
		if !validWalletAddress(req.ProposedOwner) || req.Authority != "" {
			return SecurityState{}, ErrInvalidInput
		}
	case RecoveryCancel, RecoveryFinalize:
		if req.Authority != "" || req.ProposedOwner != "" {
			return SecurityState{}, ErrInvalidInput
		}
	default:
		return SecurityState{}, ErrInvalidInput
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.Recovery(ctx, actor, req)
	})
}

func (s *SecurityService) RevokeSession(ctx context.Context, actor, id string) (SecurityState, error) {
	actor, id, err := validateSecurityID(actor, id)
	if err != nil {
		return SecurityState{}, err
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.RevokeSession(ctx, actor, id)
	})
}

func (s *SecurityService) AcknowledgeAlert(ctx context.Context, actor, id string) (SecurityState, error) {
	actor, id, err := validateSecurityID(actor, id)
	if err != nil {
		return SecurityState{}, err
	}
	return s.finish(ctx, actor, func() (SecurityState, error) {
		return s.Authority.AcknowledgeAlert(ctx, actor, id)
	})
}

func (s *SecurityService) finish(ctx context.Context, actor string, call func() (SecurityState, error)) (SecurityState, error) {
	if s == nil || s.Authority == nil {
		return SecurityState{}, errors.New("mail: security authority unavailable")
	}
	if err := ctx.Err(); err != nil {
		return SecurityState{}, err
	}
	state, err := call()
	if err != nil {
		return SecurityState{}, fmt.Errorf("mail: security authority: %w", err)
	}
	state = normalizeSecurityState(state)
	if err := validateSecurityState(actor, state); err != nil {
		return SecurityState{}, err
	}
	return state, nil
}

func validateSecurityActor(actor string) (string, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return "", ErrUnauthorized
	}
	return actor, nil
}

func validateSecurityID(actor, id string) (string, string, error) {
	actor, err := validateSecurityActor(actor)
	if err != nil {
		return "", "", err
	}
	id = strings.TrimSpace(id)
	if id == "" || len([]byte(id)) > 256 {
		return "", "", ErrInvalidInput
	}
	return actor, id, nil
}

func normalizeSecurityState(state SecurityState) SecurityState {
	state.Identity = strings.TrimSpace(state.Identity)
	state.Recovery.Authority = strings.TrimSpace(state.Recovery.Authority)
	state.Recovery.PendingOwner = strings.TrimSpace(state.Recovery.PendingOwner)
	for i := range state.Passkeys {
		state.Passkeys[i].ID = strings.TrimSpace(state.Passkeys[i].ID)
		state.Passkeys[i].Label = strings.TrimSpace(state.Passkeys[i].Label)
		state.Passkeys[i].DeviceID = strings.TrimSpace(state.Passkeys[i].DeviceID)
	}
	for i := range state.Devices {
		state.Devices[i].ID = strings.TrimSpace(state.Devices[i].ID)
		state.Devices[i].Label = strings.TrimSpace(state.Devices[i].Label)
		state.Devices[i].Platform = strings.TrimSpace(state.Devices[i].Platform)
	}
	for i := range state.Sessions {
		state.Sessions[i].ID = strings.TrimSpace(state.Sessions[i].ID)
		state.Sessions[i].DeviceID = strings.TrimSpace(state.Sessions[i].DeviceID)
	}
	for i := range state.Alerts {
		state.Alerts[i].ID = strings.TrimSpace(state.Alerts[i].ID)
		state.Alerts[i].Kind = strings.TrimSpace(state.Alerts[i].Kind)
		state.Alerts[i].Severity = strings.TrimSpace(state.Alerts[i].Severity)
	}
	return state
}

func validateSecurityState(actor string, state SecurityState) error {
	if state.Identity != actor {
		return ErrSecurityInvalidResult
	}
	deviceIDs := map[string]bool{}
	for _, device := range state.Devices {
		if device.ID == "" || device.EnrolledAt.IsZero() {
			return ErrSecurityInvalidResult
		}
		deviceIDs[device.ID] = true
	}
	for _, passkey := range state.Passkeys {
		if passkey.ID == "" || passkey.CreatedAt.IsZero() || passkey.AuthorizationEpoch > state.AuthorizationEpoch {
			return ErrSecurityInvalidResult
		}
		if passkey.Active && passkey.AuthorizationEpoch != state.AuthorizationEpoch {
			return ErrSecurityInvalidResult
		}
		if passkey.DeviceID != "" && !deviceIDs[passkey.DeviceID] {
			return ErrSecurityInvalidResult
		}
	}
	for _, session := range state.Sessions {
		if session.ID == "" || session.ExpiresAt.IsZero() || session.AuthorizationEpoch > state.AuthorizationEpoch {
			return ErrSecurityInvalidResult
		}
		if session.Active && session.AuthorizationEpoch != state.AuthorizationEpoch {
			return ErrSecurityInvalidResult
		}
		if session.DeviceID != "" && !deviceIDs[session.DeviceID] {
			return ErrSecurityInvalidResult
		}
	}
	if state.Recovery.Authority != "" && !validWalletAddress(state.Recovery.Authority) {
		return ErrSecurityInvalidResult
	}
	if state.Recovery.PendingOwner != "" && !validWalletAddress(state.Recovery.PendingOwner) {
		return ErrSecurityInvalidResult
	}
	if state.Recovery.ExecutableAt != nil && state.Recovery.PendingOwner == "" {
		return ErrSecurityInvalidResult
	}
	for _, alert := range state.Alerts {
		if alert.ID == "" || alert.Kind == "" || alert.Severity == "" || alert.CreatedAt.IsZero() {
			return ErrSecurityInvalidResult
		}
	}
	return nil
}
