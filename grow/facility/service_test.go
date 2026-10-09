package facility

import (
	"context"
	"errors"
	"github.com/420integrated/420-integrated/grow/security"
	"testing"
)

type memory struct{ items map[string]Record }

func key(t, id string) string { return t + "/" + id }
func (m *memory) Create(_ context.Context, r Record) (Record, error) {
	k := key(r.TenantID, r.ID)
	if _, ok := m.items[k]; ok {
		return Record{}, ErrConflict
	}
	r.Revision = 1
	m.items[k] = r
	return r, nil
}
func (m *memory) Get(_ context.Context, t, id string, k Kind) (Record, error) {
	r, ok := m.items[key(t, id)]
	if !ok || r.Kind != k {
		return Record{}, errors.New("not found")
	}
	return r, nil
}
func (m *memory) List(_ context.Context, t string, k Kind, p string) ([]Record, error) {
	a := []Record{}
	for _, r := range m.items {
		if r.TenantID == t && r.Kind == k && (r.ParentID == p || k == Facility) {
			a = append(a, r)
		}
	}
	return a, nil
}
func (m *memory) Update(_ context.Context, r Record, expected int64) (Record, error) {
	old, ok := m.items[key(r.TenantID, r.ID)]
	if !ok || old.Revision != expected {
		return Record{}, ErrConflict
	}
	r.Revision++
	m.items[key(r.TenantID, r.ID)] = r
	return r, nil
}
func scope(tenant string, role security.Role) Scope {
	return Scope{Principal: security.Principal{SubjectID: "u", Authenticated: true}, Membership: security.Grant{SubjectID: "u", TenantID: tenant, Role: role, State: security.Active}, TenantID: tenant}
}
func TestFacilityRoomZoneAndIsolation(t *testing.T) {
	ctx := context.Background()
	m := &memory{items: map[string]Record{}}
	s := New(m)
	owner := scope("a", security.Owner)
	f, e := s.Create(ctx, owner, Record{TenantID: "a", ID: "f", Kind: Facility, Name: "Greenhouse"})
	if e != nil || f.Revision != 1 {
		t.Fatalf("facility %v", e)
	}
	r, e := s.Create(ctx, owner, Record{TenantID: "a", ID: "room", Kind: Room, ParentID: "f", Name: "Room One"})
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Create(ctx, owner, Record{TenantID: "a", ID: "zone", Kind: Zone, ParentID: r.ID, FacilityID: "f", Name: "East"})
	if e != nil {
		t.Fatal(e)
	}
	_, e = s.Create(ctx, owner, Record{TenantID: "a", ID: "bad", Kind: Zone, ParentID: "room", FacilityID: "other", Name: "Spoof"})
	if !errors.Is(e, ErrDenied) {
		t.Fatalf("cross-parent zone: %v", e)
	}
	_, e = s.Get(ctx, scope("b", security.Owner), Facility, "f")
	if !errors.Is(e, ErrDenied) {
		t.Fatal("cross tenant read")
	}
	_, e = s.Create(ctx, scope("b", security.Owner), Record{TenantID: "b", ID: "bad", Kind: Room, ParentID: "f", Name: "Cross tenant"})
	if !errors.Is(e, ErrDenied) {
		t.Fatal("cross tenant parent")
	}
	for _, role := range []security.Role{security.Technician, security.Reviewer, security.Maintainer, "PUBLIC"} {
		_, e = s.Rename(ctx, scope("a", role), Facility, "f", "Hacked", 1)
		if !errors.Is(e, ErrDenied) {
			t.Fatalf("role %s modified facility: %v", role, e)
		}
	}
	_, e = s.Rename(ctx, owner, Facility, "f", "Renamed", 3)
	if !errors.Is(e, ErrConflict) {
		t.Fatal("stale revision accepted")
	}
	got, e := s.Rename(ctx, owner, Facility, "f", "Renamed", 1)
	if e != nil || got.Revision != 2 {
		t.Fatalf("rename: %v", e)
	}
	_, e = s.Create(ctx, Scope{TenantID: "a", Membership: owner.Membership}, Record{TenantID: "a", ID: "anon", Kind: Facility, Name: "Sneak"})
	if !errors.Is(e, ErrDenied) {
		t.Fatal("unauthenticated create")
	}
	_, e = s.Create(ctx, owner, Record{TenantID: "a", ID: "z", Kind: Facility, Name: " "})
	if !errors.Is(e, ErrInvalid) {
		t.Fatal("bad name accepted")
	}
}
func TestReadBoundaries(t *testing.T) {
	ctx := context.Background()
	m := &memory{items: map[string]Record{key("a", "f"): {TenantID: "a", ID: "f", Kind: Facility, Name: "F", Revision: 1}, key("b", "secret"): {TenantID: "b", ID: "secret", Kind: Facility, Name: "SECRET", Revision: 1}}}
	s := New(m)
	records, e := s.List(ctx, scope("a", security.Owner), Facility, "")
	if e != nil || len(records) != 1 || records[0].ID != "f" {
		t.Fatalf("leak: %+v %v", records, e)
	}
	_, e = s.List(ctx, scope("a", security.Maintainer), Facility, "")
	if e != nil {
		t.Fatal(e)
	}
}

type rejectingStore struct{}

func (rejectingStore) Create(context.Context, Record) (Record, error) {
	panic("unauthorized create reached store")
}
func (rejectingStore) Get(context.Context, string, string, Kind) (Record, error) {
	panic("unauthorized get reached store")
}
func (rejectingStore) List(context.Context, string, Kind, string) ([]Record, error) {
	panic("unauthorized list reached store")
}
func (rejectingStore) Update(context.Context, Record, int64) (Record, error) {
	panic("unauthorized update reached store")
}
func TestUnauthorizedContextCannotQueryStorage(t *testing.T) {
	s := New(rejectingStore{})
	bad := scope("a", security.Owner)
	bad.Principal.Authenticated = false
	if _, e := s.Get(context.Background(), bad, Facility, "f"); !errors.Is(e, ErrDenied) {
		t.Fatal("unauthenticated get reached storage")
	}
	if _, e := s.List(context.Background(), bad, Facility, ""); !errors.Is(e, ErrDenied) {
		t.Fatal("unauthenticated list reached storage")
	}
	bad = scope("a", security.Owner)
	bad.Membership.State = security.Revoked
	if _, e := s.Get(context.Background(), bad, Room, "r"); !errors.Is(e, ErrDenied) {
		t.Fatal("revoked read reached storage")
	}
}
