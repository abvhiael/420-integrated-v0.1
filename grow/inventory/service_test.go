package inventory

import (
	"context"
	"errors"
	"math"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/grow/security"
)

type fakeStore struct {
	lot     Lot
	balance float64
	entries []Entry
	keys    map[string]bool
}

func (f *fakeStore) Create(_ context.Context, l Lot, _ string) error {
	if f.lot.ID != "" {
		return ErrConflict
	}
	f.lot = l
	f.balance = l.Opening
	return nil
}
func (f *fakeStore) Apply(_ context.Context, e Entry) error {
	if f.keys == nil {
		f.keys = map[string]bool{}
	}
	if f.keys[e.IdempotencyKey] {
		return ErrConflict
	}
	if e.LotID != f.lot.ID || e.FacilityID != f.lot.FacilityID || e.ZoneID != f.lot.ZoneID || e.TenantID != f.lot.TenantID {
		return ErrDenied
	}
	next := f.balance
	switch e.Kind {
	case "ISSUE", "CONSUME", "ADJUST_OUT", "TRANSFER_OUT":
		next -= e.Quantity
	default:
		next += e.Quantity
	}
	if next < 0 || next > 1000000 {
		return ErrConflict
	}
	f.balance = next
	f.keys[e.IdempotencyKey] = true
	f.entries = append(f.entries, e)
	return nil
}
func (f *fakeStore) Snapshot(_ context.Context, tenant, facility, zone, lot string, limit int) (Snapshot, error) {
	if tenant != f.lot.TenantID || facility != f.lot.FacilityID || zone != f.lot.ZoneID || lot != f.lot.ID {
		return Snapshot{}, ErrDenied
	}
	out := Snapshot{Lot: f.lot, Balance: f.balance}
	for _, e := range f.entries {
		if len(out.Entries) < limit {
			out.Entries = append(out.Entries, e)
		}
	}
	return out, nil
}
func owner(tenant string, role security.Role) Scope {
	return Scope{TenantID: tenant, Principal: security.Principal{SubjectID: "u", Authenticated: true},
		Grant: security.Grant{SubjectID: "u", TenantID: tenant, State: security.Active, Role: role}}
}
func TestInventoryAccountingReplayAndExports(t *testing.T) {
	db := &fakeStore{}
	s := New(db)
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	scope := owner("t", security.Owner)
	lot := Lot{TenantID: "t", FacilityID: "f", ZoneID: "z", ID: "l", Kind: "INPUT", Unit: "g", Label: "Input", Opening: 100}
	if err := s.Create(ctx, scope, lot); err != nil {
		t.Fatal(err)
	}
	e := Entry{TenantID: "t", FacilityID: "f", ZoneID: "z", LotID: "l", ID: "e", Kind: "ISSUE", Reason: "used", Actor: "u",
		Source: "manual", IdempotencyKey: "key", Quantity: 30, OccurredAt: now}
	if err := s.Apply(ctx, scope, e, now); err != nil {
		t.Fatal(err)
	}
	if err := s.Apply(ctx, scope, e, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("replay: %v", err)
	}
	if db.balance != 70 {
		t.Fatal("replay changed balance")
	}
	e.IdempotencyKey = "next"
	e.ID = "next"
	e.Quantity = 80
	if err := s.Apply(ctx, scope, e, now); !errors.Is(err, ErrConflict) {
		t.Fatalf("overdraft: %v", err)
	}
	if db.balance != 70 {
		t.Fatal("overdraft changed balance")
	}
	snap, err := s.Snapshot(ctx, scope, "f", "z", "l", 10)
	if err != nil || snap.Balance != 70 || len(snap.Entries) != 1 {
		t.Fatalf("snapshot %+v %v", snap, err)
	}
	out, err := s.Export(ctx, owner("t", security.Reviewer), "f", "z", "l", "CA-SK", 10)
	if err != nil || !strings.Contains(string(out.CSV), "LEDGER,CA-SK,l") {
		t.Fatalf("export %s %v", out.CSV, err)
	}
	if _, err = s.Export(ctx, scope, "f", "z", "l", "INVALID", 10); !errors.Is(err, ErrInvalid) {
		t.Fatal("unsupported template")
	}
	if _, err = s.Export(ctx, owner("t", security.Technician), "f", "z", "l", "CA-SK", 10); !errors.Is(err, ErrDenied) {
		t.Fatal("unauthorized export")
	}
	if _, err = s.Snapshot(ctx, owner("other", security.Owner), "f", "z", "l", 10); !errors.Is(err, ErrDenied) {
		t.Fatal("tenant leak")
	}
	if _, err = s.Snapshot(ctx, scope, "f", "z", "l", 0); !errors.Is(err, ErrInvalid) {
		t.Fatal("unbounded view")
	}
	if _, err = s.Snapshot(ctx, scope, "f", "z", "l", 0); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid limit")
	}
}
func TestInventoryBadUnitsRolesAndValues(t *testing.T) {
	db := &fakeStore{}
	s := New(db)
	ctx := context.Background()
	scope := owner("t", security.Owner)
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	l := Lot{TenantID: "t", FacilityID: "f", ZoneID: "z", ID: "l", Kind: "HARVEST", Unit: "g", Label: "Lot", HarvestID: "h", Opening: 10}
	for _, mutate := range []func(*Lot){
		func(l *Lot) { l.Opening = math.NaN() },
		func(l *Lot) { l.Opening = math.Inf(1) },
		func(l *Lot) { l.Opening = -1 },
		func(l *Lot) { l.Unit = "ounces" },
		func(l *Lot) { l.HarvestID = "" },
	} {
		x := l
		mutate(&x)
		if err := s.Create(ctx, scope, x); !errors.Is(err, ErrInvalid) {
			t.Fatal(err)
		}
	}
	if err := s.Create(ctx, owner("t", security.Technician), l); !errors.Is(err, ErrDenied) {
		t.Fatal("technician created lot")
	}
	if err := s.Create(ctx, scope, l); err != nil {
		t.Fatal(err)
	}
	base := Entry{TenantID: "t", FacilityID: "f", ZoneID: "z", LotID: "l", ID: "e", Kind: "CONSUME", Reason: "reason", Actor: "u",
		Source: "manual", IdempotencyKey: "k", Quantity: 1, OccurredAt: now}
	for _, change := range []func(*Entry){
		func(e *Entry) { e.Quantity = math.NaN() },
		func(e *Entry) { e.Quantity = -1 },
		func(e *Entry) { e.Quantity = math.Inf(1) },
		func(e *Entry) { e.Actor = "other" },
		func(e *Entry) { e.Kind = "STEAL" },
		func(e *Entry) { e.Reason = "" },
		func(e *Entry) { e.OccurredAt = now.Add(6 * time.Minute) },
		func(e *Entry) { e.Kind = "TRANSFER_OUT" },
	} {
		e := base
		change(&e)
		if err := s.Apply(ctx, scope, e, now); !errors.Is(err, ErrInvalid) {
			t.Fatalf("bad movement: %v", err)
		}
	}
	if err := s.Apply(ctx, owner("other", security.Owner), base, now); !errors.Is(err, ErrDenied) {
		t.Fatal("cross tenant write")
	}
	if err := s.Apply(ctx, owner("t", security.Reviewer), base, now); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer mutation")
	}
}
func TestCSVInjection(t *testing.T) {
	for _, v := range []string{"=SUM(1,2)", "+cmd", "-cmd", "@cmd"} {
		if !strings.HasPrefix(cell(v), "'") {
			t.Fatal("unsafe spreadsheet cell", v)
		}
	}
}

type transferRecorder struct {
	fakeStore
	received bool
}

func (f *transferRecorder) Transfer(_ context.Context, from, to Entry) error {
	f.received = true
	if from.Kind != "TRANSFER_OUT" || to.Kind != "TRANSFER_IN" {
		return ErrInvalid
	}
	return nil
}
func TestPairedTransferAuthorizationAndValidation(t *testing.T) {
	now := time.Date(2026, 10, 9, 0, 0, 0, 0, time.UTC)
	ctx := context.Background()
	db := &transferRecorder{}
	s := New(db)
	a := Entry{TenantID: "t", FacilityID: "f", ZoneID: "z", LotID: "a",
		ID: "out", Kind: "TRANSFER_OUT", ReferenceID: "move-1", IdempotencyKey: "out-1",
		Quantity: 4, Reason: "custody move", Actor: "u", Source: "manual", OccurredAt: now}
	b := a
	b.LotID = "b"
	b.ID = "in"
	b.Kind = "TRANSFER_IN"
	b.IdempotencyKey = "in-1"
	if err := s.Transfer(ctx, owner("t", security.Owner), a, b, now); err != nil || !db.received {
		t.Fatalf("paired transfer denied: %v", err)
	}
	for _, change := range []func(*Entry){
		func(e *Entry) { e.ReferenceID = "different" },
		func(e *Entry) { e.LotID = "a" },
		func(e *Entry) { e.Quantity = 3 },
		func(e *Entry) { e.Actor = "other" },
		func(e *Entry) { e.TenantID = "other" },
		func(e *Entry) { e.IdempotencyKey = "out-1" },
	} {
		bad := b
		change(&bad)
		if err := s.Transfer(ctx, owner("t", security.Owner), a, bad, now); err == nil {
			t.Fatal("invalid custody pair accepted")
		}
	}
	if err := s.Transfer(ctx, owner("t", security.Technician), a, b, now); !errors.Is(err, ErrDenied) {
		t.Fatal("technician bypassed inventory adjustment")
	}
	if err := s.Apply(ctx, owner("t", security.Owner), a, now); !errors.Is(err, ErrInvalid) {
		t.Fatal("unpaired transfer accepted")
	}
}
