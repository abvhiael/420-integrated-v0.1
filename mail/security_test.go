package mail

import (
	"context"
	"errors"
	"testing"
	"time"
)

type securityAuthorityStub struct {
	state SecurityState
	err   error
	calls []string
}

func (s *securityAuthorityStub) Snapshot(context.Context, string) (SecurityState, error) {
	s.calls = append(s.calls, "snapshot")
	return s.state, s.err
}
func (s *securityAuthorityStub) EnrollPasskey(context.Context, string, PasskeyEnrollmentRequest) (SecurityState, error) {
	s.calls = append(s.calls, "enroll-passkey")
	return s.state, s.err
}
func (s *securityAuthorityStub) RevokePasskey(context.Context, string, string) (SecurityState, error) {
	s.calls = append(s.calls, "revoke-passkey")
	return s.state, s.err
}
func (s *securityAuthorityStub) EnrollDevice(context.Context, string, DeviceEnrollmentRequest) (SecurityState, error) {
	s.calls = append(s.calls, "enroll-device")
	return s.state, s.err
}
func (s *securityAuthorityStub) RevokeDevice(context.Context, string, string) (SecurityState, error) {
	s.calls = append(s.calls, "revoke-device")
	return s.state, s.err
}
func (s *securityAuthorityStub) Recovery(context.Context, string, RecoveryRequest) (SecurityState, error) {
	s.calls = append(s.calls, "recovery")
	return s.state, s.err
}
func (s *securityAuthorityStub) RevokeSession(context.Context, string, string) (SecurityState, error) {
	s.calls = append(s.calls, "revoke-session")
	return s.state, s.err
}
func (s *securityAuthorityStub) AcknowledgeAlert(context.Context, string, string) (SecurityState, error) {
	s.calls = append(s.calls, "ack-alert")
	return s.state, s.err
}

func validSecurityState() SecurityState {
	now := time.Unix(1700000000, 0).UTC()
	executable := now.Add(48 * time.Hour)
	return SecurityState{
		Identity:           "alice.420",
		AuthorizationEpoch: 7,
		Passkeys: []PasskeySummary{{
			ID: "pk-1", DeviceID: "dev-1", AuthorizationEpoch: 7, Active: true, CreatedAt: now,
		}},
		Devices: []DeviceSummary{{
			ID: "dev-1", Label: "laptop", Platform: "web", Active: true, EnrolledAt: now,
		}},
		Recovery: RecoverySummary{
			Enabled: true, Authority: "0x2222222222222222222222222222222222222222",
			PendingOwner: "0x3333333333333333333333333333333333333333", ExecutableAt: &executable,
		},
		Sessions: []SessionSummary{{
			ID: "session-1", DeviceID: "dev-1", AuthorizationEpoch: 7, Active: true, ExpiresAt: now.Add(time.Hour),
		}},
		Alerts: []SecurityAlert{{
			ID: "alert-1", Kind: "NEW_DEVICE", Severity: "WARNING", CreatedAt: now,
		}},
	}
}

func TestSecurityServiceDelegatesCanonicalSecurityActions(t *testing.T) {
	cases := []struct {
		name string
		want string
		call func(*SecurityService) (SecurityState, error)
	}{
		{"snapshot", "snapshot", func(s *SecurityService) (SecurityState, error) {
			return s.Snapshot(context.Background(), "alice.420")
		}},
		{"enroll-passkey", "enroll-passkey", func(s *SecurityService) (SecurityState, error) {
			return s.EnrollPasskey(context.Background(), "alice.420", PasskeyEnrollmentRequest{Attestation: "attestation", DeviceID: "dev-1", Label: "laptop"})
		}},
		{"revoke-passkey", "revoke-passkey", func(s *SecurityService) (SecurityState, error) {
			return s.RevokePasskey(context.Background(), "alice.420", "pk-1")
		}},
		{"enroll-device", "enroll-device", func(s *SecurityService) (SecurityState, error) {
			return s.EnrollDevice(context.Background(), "alice.420", DeviceEnrollmentRequest{Proof: "device-proof", Label: "laptop", Platform: "web"})
		}},
		{"revoke-device", "revoke-device", func(s *SecurityService) (SecurityState, error) {
			return s.RevokeDevice(context.Background(), "alice.420", "dev-1")
		}},
		{"recovery", "recovery", func(s *SecurityService) (SecurityState, error) {
			return s.Recovery(context.Background(), "alice.420", RecoveryRequest{
				Action: RecoveryPropose, Account: "0x1111111111111111111111111111111111111111",
				ProposedOwner: "0x3333333333333333333333333333333333333333",
			})
		}},
		{"revoke-session", "revoke-session", func(s *SecurityService) (SecurityState, error) {
			return s.RevokeSession(context.Background(), "alice.420", "session-1")
		}},
		{"ack-alert", "ack-alert", func(s *SecurityService) (SecurityState, error) {
			return s.AcknowledgeAlert(context.Background(), "alice.420", "alert-1")
		}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			authority := &securityAuthorityStub{state: validSecurityState()}
			svc := NewSecurityService(authority)
			got, err := tc.call(svc)
			if err != nil {
				t.Fatal(err)
			}
			if got.Identity != "alice.420" || got.AuthorizationEpoch != 7 {
				t.Fatalf("unexpected state: %+v", got)
			}
			if len(authority.calls) != 1 || authority.calls[0] != tc.want {
				t.Fatalf("wrong authority call: %+v", authority.calls)
			}
		})
	}
}

func TestSecurityServiceRejectsMalformedInputsBeforeAuthority(t *testing.T) {
	authority := &securityAuthorityStub{state: validSecurityState()}
	svc := NewSecurityService(authority)
	if _, err := svc.EnrollPasskey(context.Background(), "", PasskeyEnrollmentRequest{Attestation: "a", DeviceID: "d"}); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("missing actor: %v", err)
	}
	if _, err := svc.EnrollPasskey(context.Background(), "alice.420", PasskeyEnrollmentRequest{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty passkey enrollment: %v", err)
	}
	if _, err := svc.EnrollDevice(context.Background(), "alice.420", DeviceEnrollmentRequest{}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty device proof: %v", err)
	}
	if _, err := svc.Recovery(context.Background(), "alice.420", RecoveryRequest{Action: RecoveryPropose, Account: "bad", ProposedOwner: "bad"}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid recovery: %v", err)
	}
	if _, err := svc.RevokeSession(context.Background(), "alice.420", ""); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty session id: %v", err)
	}
	if len(authority.calls) != 0 {
		t.Fatalf("invalid input reached authority: %+v", authority.calls)
	}
}

func TestSecurityServiceRecoveryActionsPreserveCanonicalBoundaries(t *testing.T) {
	account := "0x1111111111111111111111111111111111111111"
	authority := &securityAuthorityStub{state: validSecurityState()}
	svc := NewSecurityService(authority)
	valid := []RecoveryRequest{
		{Action: RecoverySetAuthority, Account: account, Authority: "0x2222222222222222222222222222222222222222"},
		{Action: RecoveryPropose, Account: account, ProposedOwner: "0x3333333333333333333333333333333333333333"},
		{Action: RecoveryCancel, Account: account},
		{Action: RecoveryFinalize, Account: account},
	}
	for _, req := range valid {
		if _, err := svc.Recovery(context.Background(), "alice.420", req); err != nil {
			t.Fatalf("%s rejected: %v", req.Action, err)
		}
	}
	before := len(authority.calls)
	if _, err := svc.Recovery(context.Background(), "alice.420", RecoveryRequest{
		Action: RecoveryCancel, Account: account, ProposedOwner: "0x3333333333333333333333333333333333333333",
	}); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("cancel accepted extra authority fields: %v", err)
	}
	if len(authority.calls) != before {
		t.Fatal("invalid recovery reached authority")
	}
}

func TestSecurityServiceFailsClosedOnStaleFutureEpochOrForeignIdentity(t *testing.T) {
	for _, mutate := range []func(*SecurityState){
		func(s *SecurityState) { s.Identity = "mallory.420" },
		func(s *SecurityState) { s.Passkeys[0].AuthorizationEpoch = 8 },
		func(s *SecurityState) { s.Sessions[0].AuthorizationEpoch = 8 },
		func(s *SecurityState) { s.Passkeys[0].AuthorizationEpoch = 6 },
		func(s *SecurityState) { s.Sessions[0].AuthorizationEpoch = 6 },
		func(s *SecurityState) { s.Passkeys[0].DeviceID = "missing-device" },
		func(s *SecurityState) { s.Recovery.Authority = "invalid" },
	} {
		state := validSecurityState()
		mutate(&state)
		authority := &securityAuthorityStub{state: state}
		svc := NewSecurityService(authority)
		if _, err := svc.Snapshot(context.Background(), "alice.420"); !errors.Is(err, ErrSecurityInvalidResult) {
			t.Fatalf("invalid authority state accepted: %+v err=%v", state, err)
		}
	}
}

func TestSecurityServiceAllowsStaleInactiveEpochForReview(t *testing.T) {
	state := validSecurityState()
	state.Passkeys[0].AuthorizationEpoch = 6
	state.Passkeys[0].Active = false
	state.Sessions[0].AuthorizationEpoch = 6
	state.Sessions[0].Active = false
	authority := &securityAuthorityStub{state: state}
	svc := NewSecurityService(authority)
	got, err := svc.Snapshot(context.Background(), "alice.420")
	if err != nil {
		t.Fatal(err)
	}
	if got.Passkeys[0].AuthorizationEpoch != 6 || got.Sessions[0].AuthorizationEpoch != 6 {
		t.Fatalf("stale review state lost: %+v", got)
	}
}

func TestSecurityServicePropagatesAuthorityFailureWithoutFallback(t *testing.T) {
	dep := errors.New("authorization epoch changed")
	authority := &securityAuthorityStub{err: dep}
	svc := NewSecurityService(authority)
	_, err := svc.Snapshot(context.Background(), "alice.420")
	if !errors.Is(err, dep) {
		t.Fatalf("dependency failure lost: %v", err)
	}
}
