package equipment

import (
	"context"
	"crypto/ed25519"
	"crypto/rand"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type fakeStore struct {
	d    Device
	read int
}

func (f *fakeStore) Device(_ context.Context, tenant, id string) (Device, error) {
	f.read++
	if tenant != f.d.TenantID || id != f.d.ID {
		return Device{}, ErrDenied
	}
	return f.d, nil
}
func (f *fakeStore) ClaimNonce(context.Context, string, string, [16]byte, time.Time) (bool, error) {
	return false, ErrUnavailable
}

type fakeAdapter struct{ called int }

func (f *fakeAdapter) Observe(_ context.Context, d Device) (Observation, error) {
	f.called++
	return Observation{DeviceID: d.ID, Value: 21, At: time.Now(), Healthy: true}, nil
}
func scoped(role security.Role) Scope {
	return Scope{Principal: security.Principal{SubjectID: "operator", Authenticated: true}, TenantID: "tenant-a",
		Grant: security.Grant{SubjectID: "operator", TenantID: "tenant-a", Role: role, State: security.Active}}
}
func device() Device {
	return Device{TenantID: "tenant-a", FacilityID: "facility", ZoneID: "zone", ID: "heater",
		Type: "heater", SafeMinimum: 15, SafeMaximum: 30, Online: true, InterlockOK: true}
}
func TestMonitoringReadOnlyAndTenantSecurity(t *testing.T) {
	store := &fakeStore{d: device()}
	adapter := &fakeAdapter{}
	svc := Service{Store: store, Adapter: adapter}
	o, err := svc.Monitor(context.Background(), scoped(security.Maintainer), "heater")
	if err != nil || o.Value != 21 || adapter.called != 1 {
		t.Fatalf("observation %v %+v", err, o)
	}
	s := scoped(security.Owner)
	s.Grant.TenantID = "tenant-b"
	if _, err := svc.Monitor(context.Background(), s, "heater"); !errors.Is(err, ErrDenied) {
		t.Fatal("tenant mismatch")
	}
	s = scoped(security.Owner)
	s.Principal.Authenticated = false
	before := store.read
	if _, err := svc.Monitor(context.Background(), s, "heater"); !errors.Is(err, ErrDenied) || store.read != before {
		t.Fatal("invalid principal queried storage")
	}
	s = scoped(security.Reviewer)
	if _, err := svc.Monitor(context.Background(), s, "heater"); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer observed equipment")
	}
	store.d.Online = false
	if _, err := svc.Monitor(context.Background(), scoped(security.Owner), "heater"); !errors.Is(err, ErrUnavailable) {
		t.Fatal("offline device allowed")
	}
}
func TestSignedControlPolicyNeverDispatches(t *testing.T) {
	pub, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	s := scoped(security.Owner)
	d := device()
	d.ControlSigningKey = pub
	c := Command{DeviceID: d.ID, Action: "SET_TARGET", Value: 22, ExpiresAt: now.Add(time.Minute)}
	c.Nonce[0] = 1
	a := Approval{SubjectID: "operator", PublicKey: pub, MFAConfirmed: true}
	a.Signature = ed25519.Sign(priv, approvalPayload(s, d, c))
	if err := VerifyControlApproval(s, d, c, a, now); err != nil {
		t.Fatalf("valid offline approval incorrectly rejected: %v", err)
	}
	if err := (Service{}).Dispatch(context.Background(), s, c, a, now); !errors.Is(err, ErrDenied) {
		t.Fatal("device actuation enabled")
	}
	for _, mutate := range []func(*Device, *Command, *Approval, *Scope){
		func(d *Device, c *Command, a *Approval, s *Scope) { d.ManualOverride = true },
		func(d *Device, c *Command, a *Approval, s *Scope) { d.InterlockOK = false },
		func(d *Device, c *Command, a *Approval, s *Scope) { d.Online = false },
		func(d *Device, c *Command, a *Approval, s *Scope) { c.Value = 100 },
		func(d *Device, c *Command, a *Approval, s *Scope) { c.ExpiresAt = now.Add(-time.Second) },
		func(d *Device, c *Command, a *Approval, s *Scope) { c.Nonce = [16]byte{} },
		func(d *Device, c *Command, a *Approval, s *Scope) { a.MFAConfirmed = false },
		func(d *Device, c *Command, a *Approval, s *Scope) { a.Signature[0] ^= 0xff },
		func(d *Device, c *Command, a *Approval, s *Scope) { s.Grant.Role = security.Technician },
		func(d *Device, c *Command, a *Approval, s *Scope) { s.TenantID = "other" },
		func(d *Device, c *Command, a *Approval, s *Scope) {
			d.ControlSigningKey = make([]byte, ed25519.PublicKeySize)
		},
	} {
		dd, cc, aa, ss := d, c, a, s
		aa.Signature = append([]byte(nil), a.Signature...)
		mutate(&dd, &cc, &aa, &ss)
		if err := VerifyControlApproval(ss, dd, cc, aa, now); !errors.Is(err, ErrDenied) {
			t.Fatalf("unsafe approval accepted: %+v", cc)
		}
	}
}
