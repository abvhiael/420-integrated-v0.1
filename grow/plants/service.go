package plants

import (
	"context"
	"errors"
	"github.com/420integrated/420-integrated/grow/security"
	"strings"
)

type Stage string

const (
	Seed       Stage = "SEED"
	Clone      Stage = "CLONE"
	Vegetative Stage = "VEGETATIVE"
	Flowering  Stage = "FLOWERING"
	Harvested  Stage = "HARVESTED"
	Retired    Stage = "RETIRED"
)

var ErrDenied = errors.New("plant unavailable")
var ErrInvalid = errors.New("invalid plant transition or lineage")
var ErrConflict = errors.New("plant revision conflict")

type Plant struct {
	TenantID, FacilityID, ZoneID, ID, Label, CultivarID string
	State                                               Stage
	Revision                                            int64
}
type Edge struct {
	TenantID, ChildID, ParentID string
	Relation                    string
}
type Scope struct {
	Principal  security.Principal
	Membership security.Grant
	TenantID   string
}
type Store interface {
	Get(context.Context, string, string) (Plant, error)
	Create(context.Context, Plant) (Plant, error)
	ChangeStage(context.Context, Plant, int64, string) (Plant, error)
	Ancestors(context.Context, string, string) ([]string, error)
	Link(context.Context, Edge) error
}
type Service struct{ store Store }

func New(store Store) Service { return Service{store: store} }
func allowed(s Scope, p Plant, a security.Action) bool {
	return s.Principal.Authenticated && s.Principal.SubjectID != "" && s.TenantID != "" &&
		s.TenantID == s.Membership.TenantID && p.TenantID == s.TenantID &&
		p.FacilityID != "" && p.ZoneID != "" &&
		security.Authorize(s.Principal, s.Membership, security.Resource{TenantID: p.TenantID, FacilityID: p.FacilityID, ZoneID: p.ZoneID}, a)
}
func valid(p Plant) bool {
	return p.ID != "" && p.TenantID != "" && p.FacilityID != "" && p.ZoneID != "" &&
		len(p.Label) > 0 && len(p.Label) <= 160 && strings.TrimSpace(p.Label) == p.Label &&
		(p.State == Seed || p.State == Clone || p.State == Vegetative || p.State == Flowering || p.State == Harvested || p.State == Retired)
}
func (s Service) Create(ctx context.Context, scope Scope, p Plant) (Plant, error) {
	if s.store == nil || !valid(p) || p.Revision != 0 {
		return Plant{}, ErrInvalid
	}
	if !allowed(scope, p, security.PlantWrite) {
		return Plant{}, ErrDenied
	}
	return s.store.Create(ctx, p)
}
func (s Service) Get(ctx context.Context, scope Scope, id string) (Plant, error) {
	if s.store == nil || id == "" || scope.TenantID == "" || !scope.Principal.Authenticated ||
		scope.Principal.SubjectID == "" || scope.Principal.SubjectID != scope.Membership.SubjectID ||
		scope.Membership.TenantID != scope.TenantID || scope.Membership.State != security.Active {
		return Plant{}, ErrDenied
	}
	p, err := s.store.Get(ctx, scope.TenantID, id)
	if err != nil || p.ID != id || !allowed(scope, p, security.View) {
		return Plant{}, ErrDenied
	}
	return p, nil
}
func canMove(from, to Stage) bool {
	switch from {
	case Seed, Clone:
		return to == Vegetative || to == Retired
	case Vegetative:
		return to == Flowering || to == Retired
	case Flowering:
		return to == Harvested || to == Retired
	case Harvested:
		return to == Retired
	}
	return false
}
func (s Service) Transition(ctx context.Context, scope Scope, id string, to Stage, revision int64) (Plant, error) {
	p, err := s.Get(ctx, scope, id)
	if err != nil {
		return Plant{}, ErrDenied
	}
	if !allowed(scope, p, security.PlantWrite) {
		return Plant{}, ErrDenied
	}
	if revision != p.Revision {
		return Plant{}, ErrConflict
	}
	if !canMove(p.State, to) {
		return Plant{}, ErrInvalid
	}
	p.State = to
	return s.store.ChangeStage(ctx, p, revision, scope.Principal.SubjectID)
}
func (s Service) Link(ctx context.Context, scope Scope, childID, parentID, relation string) error {
	if childID == "" || parentID == "" || childID == parentID || relation != "CLONE_PARENT" && relation != "SEED_PARENT" {
		return ErrInvalid
	}
	child, err := s.Get(ctx, scope, childID)
	if err != nil || !allowed(scope, child, security.PlantWrite) {
		return ErrDenied
	}
	parent, err := s.Get(ctx, scope, parentID)
	if err != nil || parent.TenantID != child.TenantID {
		return ErrDenied
	}
	if relation == "CLONE_PARENT" && child.State != Clone {
		return ErrInvalid
	}
	ancestors, err := s.store.Ancestors(ctx, scope.TenantID, parentID)
	if err != nil {
		return err
	}
	for _, ancestor := range ancestors {
		if ancestor == childID {
			return ErrInvalid
		}
	}
	return s.store.Link(ctx, Edge{TenantID: scope.TenantID, ChildID: childID, ParentID: parentID, Relation: relation})
}
