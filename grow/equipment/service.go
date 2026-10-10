// Package equipment provides a fail-closed observation adapter and a separately
// approved, non-networked control policy. No physical actuator is wired here.
package equipment

import (
	"context"
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/binary"
	"errors"
	"math"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

var ErrDenied = errors.New("equipment operation denied")
var ErrInvalid = errors.New("invalid equipment input")
var ErrUnavailable = errors.New("equipment unavailable")

type Scope struct {
	Principal security.Principal
	Grant     security.Grant
	TenantID  string
}
type Device struct {
	TenantID, FacilityID, ZoneID, ID, Type string
	SafeMinimum, SafeMaximum               float64
	Online                                 bool
	InterlockOK                            bool
	ManualOverride                         bool
	ControlSigningKey                      ed25519.PublicKey
}
type Observation struct {
	DeviceID string
	Value    float64
	At       time.Time
	Healthy  bool
}
type Command struct {
	DeviceID, Action string
	Value            float64
	Nonce            [16]byte
	ExpiresAt        time.Time
}
type Approval struct {
	SubjectID    string
	PublicKey    ed25519.PublicKey
	Signature    []byte
	MFAConfirmed bool
}
type Adapter interface {
	Observe(context.Context, Device) (Observation, error)
	// Dispatch MUST NOT be implemented until a physically tested, separately
	// authorized adapter and immutable command journal are qualified.
}
type Store interface {
	Device(context.Context, string, string) (Device, error)
	// ClaimNonce must be atomic, persistent, scoped by tenant and device, and
	// fail closed on DB outage. A caller-provided in-memory map is insufficient.
	ClaimNonce(context.Context, string, string, [16]byte, time.Time) (bool, error)
}
type Service struct {
	Store   Store
	Adapter Adapter
}

func authorized(s Scope, d Device, action security.Action) bool {
	return s.TenantID != "" && s.TenantID == d.TenantID && d.FacilityID != "" && d.ZoneID != "" &&
		security.Authorize(s.Principal, s.Grant, security.Resource{TenantID: d.TenantID, FacilityID: d.FacilityID, ZoneID: d.ZoneID}, action)
}
func (s Service) Monitor(ctx context.Context, scope Scope, id string) (Observation, error) {
	if s.Store == nil || s.Adapter == nil || id == "" || scope.TenantID == "" || !scope.Principal.Authenticated ||
		scope.Principal.SubjectID != scope.Grant.SubjectID || scope.Grant.TenantID != scope.TenantID ||
		scope.Grant.State != security.Active {
		return Observation{}, ErrDenied
	}
	d, err := s.Store.Device(ctx, scope.TenantID, id)
	if err != nil || d.ID != id || !authorized(scope, d, security.EquipmentObserve) {
		return Observation{}, ErrDenied
	}
	if !d.Online {
		return Observation{}, ErrUnavailable
	}
	o, err := s.Adapter.Observe(ctx, d)
	if err != nil || o.DeviceID != id || o.At.IsZero() || math.IsNaN(o.Value) || math.IsInf(o.Value, 0) {
		return Observation{}, ErrUnavailable
	}
	return o, nil
}

// VerifyControlApproval is a pure policy validation helper; it never authorizes
// actuation by itself. A future dispatcher must additionally verify hardware
// manual override, double-checked command journal, hardware feedback, expiry,
// and reauthentication. This phase deliberately has no dispatch method.
func VerifyControlApproval(s Scope, d Device, c Command, a Approval, now time.Time) error {
	if !authorized(s, d, security.EquipmentObserve) ||
		s.Grant.Role != security.Owner && s.Grant.Role != security.Manager ||
		!a.MFAConfirmed || a.SubjectID != s.Principal.SubjectID ||
		!d.Online || !d.InterlockOK || d.ManualOverride ||
		c.DeviceID != d.ID || c.Action != "SET_TARGET" ||
		math.IsNaN(c.Value) || math.IsInf(c.Value, 0) ||
		math.IsNaN(d.SafeMinimum) || math.IsNaN(d.SafeMaximum) ||
		d.SafeMinimum > d.SafeMaximum || c.Value < d.SafeMinimum || c.Value > d.SafeMaximum ||
		c.ExpiresAt.IsZero() || !c.ExpiresAt.After(now) || c.ExpiresAt.After(now.Add(2*time.Minute)) ||
		c.Nonce == ([16]byte{}) || len(a.PublicKey) != ed25519.PublicKeySize || len(d.ControlSigningKey) != ed25519.PublicKeySize || subtle.ConstantTimeCompare(a.PublicKey, d.ControlSigningKey) != 1 {
		return ErrDenied
	}
	msg := approvalPayload(s, d, c)
	if !ed25519.Verify(a.PublicKey, msg, a.Signature) {
		return ErrDenied
	}
	return nil
}
func approvalPayload(s Scope, d Device, c Command) []byte {
	h := sha256.New()
	for _, v := range []string{"420Grow-V2-07", "command-v1", s.TenantID, s.Principal.SubjectID, d.FacilityID, d.ZoneID, d.ID, c.Action} {
		var n [4]byte
		binary.BigEndian.PutUint32(n[:], uint32(len(v)))
		h.Write(n[:])
		h.Write([]byte(v))
	}
	var buf [8]byte
	binary.BigEndian.PutUint64(buf[:], math.Float64bits(c.Value))
	h.Write(buf[:])
	binary.BigEndian.PutUint64(buf[:], uint64(c.ExpiresAt.UnixNano()))
	h.Write(buf[:])
	h.Write(c.Nonce[:])
	return h.Sum(nil)
}

// Dispatch intentionally remains impossible in V2-07: no device-specific
// safety certification or credentialed hardware transport exists.
func (s Service) Dispatch(context.Context, Scope, Command, Approval, time.Time) error {
	return ErrDenied
}
