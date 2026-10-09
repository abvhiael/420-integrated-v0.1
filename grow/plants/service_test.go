package plants

import (
	"context"
	"errors"
	"github.com/420integrated/420-integrated/grow/security"
	"testing"
)

type fakeStore struct {
	plants  map[string]Plant
	lineage map[string][]string
}

func key(tenant, id string) string { return tenant + "/" + id }
func (s *fakeStore) Get(_ context.Context, t, id string) (Plant, error) {
	p, ok := s.plants[key(t, id)]
	if !ok {
		return Plant{}, ErrDenied
	}
	return p, nil
}
func (s *fakeStore) Create(_ context.Context, p Plant) (Plant, error) {
	k := key(p.TenantID, p.ID)
	if _, exists := s.plants[k]; exists {
		return Plant{}, ErrConflict
	}
	p.Revision = 1
	s.plants[k] = p
	return p, nil
}
func (s *fakeStore) ChangeStage(_ context.Context, p Plant, rev int64, actor string) (Plant, error) {
	old := s.plants[key(p.TenantID, p.ID)]
	if old.Revision != rev {
		return Plant{}, ErrConflict
	}
	p.Revision = rev + 1
	s.plants[key(p.TenantID, p.ID)] = p
	return p, nil
}
func (s *fakeStore) Ancestors(_ context.Context, t, id string) ([]string, error) {
	result := []string{}
	seen := map[string]bool{}
	var walk func(string)
	walk = func(cur string) {
		for _, p := range s.lineage[key(t, cur)] {
			if !seen[p] {
				seen[p] = true
				result = append(result, p)
				walk(p)
			}
		}
	}
	walk(id)
	return result, nil
}
func (s *fakeStore) Link(_ context.Context, e Edge) error {
	s.lineage[key(e.TenantID, e.ChildID)] = append(s.lineage[key(e.TenantID, e.ChildID)], e.ParentID)
	return nil
}
func scope(t string, role security.Role) Scope {
	return Scope{Principal: security.Principal{SubjectID: "u", Authenticated: true}, Membership: security.Grant{SubjectID: "u", TenantID: t, Role: role, State: security.Active}, TenantID: t}
}
func TestPlantLifecycleGeneticsAndTenantSafety(t *testing.T) {
	ctx := context.Background()
	db := &fakeStore{plants: map[string]Plant{}, lineage: map[string][]string{}}
	svc := New(db)
	owner := scope("a", security.Owner)
	for _, p := range []Plant{{TenantID: "a", FacilityID: "f", ZoneID: "z", ID: "parent", Label: "Mother", State: Vegetative}, {TenantID: "a", FacilityID: "f", ZoneID: "z", ID: "clone", Label: "Cutting", State: Clone}} {
		if _, err := svc.Create(ctx, owner, p); err != nil {
			t.Fatal(err)
		}
	}
	if err := svc.Link(ctx, owner, "clone", "parent", "CLONE_PARENT"); err != nil {
		t.Fatal(err)
	}
	if err := svc.Link(ctx, owner, "parent", "clone", "SEED_PARENT"); !errors.Is(err, ErrInvalid) {
		t.Fatal("cycle allowed", err)
	}
	if _, err := svc.Get(ctx, scope("b", security.Owner), "parent"); !errors.Is(err, ErrDenied) {
		t.Fatal("cross tenant leak")
	}
	if _, err := svc.Transition(ctx, scope("a", security.Reviewer), "clone", Vegetative, 1); !errors.Is(err, ErrDenied) {
		t.Fatal("reviewer wrote")
	}
	if _, err := svc.Transition(ctx, owner, "clone", Harvested, 1); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid jump")
	}
	if _, err := svc.Transition(ctx, owner, "clone", Vegetative, 10); !errors.Is(err, ErrConflict) {
		t.Fatal("stale revision")
	}
	if p, err := svc.Transition(ctx, owner, "clone", Vegetative, 1); err != nil || p.Revision != 2 {
		t.Fatalf("valid stage: %+v %v", p, err)
	}
	if _, err := svc.Transition(ctx, owner, "clone", Clone, 2); !errors.Is(err, ErrInvalid) {
		t.Fatal("backwards transition")
	}
}

type panicStore struct{}

func (panicStore) Get(context.Context, string, string) (Plant, error) { panic("unauthorized lookup") }
func (panicStore) Create(context.Context, Plant) (Plant, error)       { panic("unauthorized creation") }
func (panicStore) ChangeStage(context.Context, Plant, int64, string) (Plant, error) {
	panic("unauthorized mutation")
}
func (panicStore) Ancestors(context.Context, string, string) ([]string, error) {
	panic("unauthorized lineage")
}
func (panicStore) Link(context.Context, Edge) error { panic("unauthorized link") }
func TestUnauthorizedNeverReadsStorage(t *testing.T) {
	s := New(panicStore{})
	bad := scope("a", security.Owner)
	bad.Principal.Authenticated = false
	if _, err := s.Get(context.Background(), bad, "p"); !errors.Is(err, ErrDenied) {
		t.Fatal(err)
	}
	if err := s.Link(context.Background(), bad, "p", "q", "SEED_PARENT"); !errors.Is(err, ErrDenied) {
		t.Fatal(err)
	}
}
