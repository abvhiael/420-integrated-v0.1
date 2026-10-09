// Package facility defines authenticated, tenant-scoped facility/room/zone operations.
// Infrastructure adapters and HTTP sessions are deliberately separate.
package facility

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/420integrated/420-integrated/grow/security"
)

var ErrDenied = errors.New("facility resource unavailable")
var ErrInvalid = errors.New("invalid facility input")
var ErrConflict = errors.New("facility revision conflict")

type Kind string

const (
	Facility Kind = "FACILITY"
	Room     Kind = "ROOM"
	Zone     Kind = "ZONE"
)

type Record struct {
	TenantID   string
	ID         string
	ParentID   string
	FacilityID string
	Name       string
	Kind       Kind
	Revision   int64
}
type Scope struct {
	Principal  security.Principal
	Membership security.Grant
	TenantID   string
}
type Store interface {
	// Store methods MUST execute within one verified tenant-scoped transaction,
	// with SET LOCAL grow.tenant_id and all predicates bound to the same tenant.
	Create(context.Context, Record) (Record, error)
	Get(context.Context, string, string, Kind) (Record, error)
	List(context.Context, string, Kind, string) ([]Record, error)
	Update(context.Context, Record, int64) (Record, error)
}

// Service never accepts an authority-free tenant, even from an authenticated caller.
type Service struct{ store Store }

func New(store Store) Service { return Service{store: store} }
func validName(s string) bool {
	return s == strings.TrimSpace(s) && utf8.ValidString(s) && utf8.RuneCountInString(s) > 0 && utf8.RuneCountInString(s) <= 160
}
func validID(s string) bool {
	return len(s) > 0 && len(s) <= 128 && strings.TrimSpace(s) == s && !strings.ContainsAny(s, " /\\\t\r\n")
}
func allowed(s Scope, rec Record, action security.Action) bool {
	if !validID(s.TenantID) || s.TenantID != rec.TenantID {
		return false
	}
	target := security.Resource{TenantID: rec.TenantID}
	switch rec.Kind {
	case Facility:
		target.FacilityID = rec.ID
	case Room:
		target.FacilityID = rec.ParentID
	case Zone:
		// Zones are scoped through a verified room-parent chain by calling code;
		// this layer cannot grant zone-scoped membership without a concrete facility.
		target.FacilityID = rec.FacilityID
		target.ZoneID = rec.ID
	default:
		return false
	}
	return security.Authorize(s.Principal, s.Membership, target, action)
}
func (svc Service) Create(ctx context.Context, s Scope, rec Record) (Record, error) {
	if svc.store == nil || !validID(rec.ID) || !validID(rec.TenantID) || !validName(rec.Name) || rec.Revision != 0 {
		return Record{}, ErrInvalid
	}
	if rec.Kind == Facility {
		if rec.ParentID != "" {
			return Record{}, ErrInvalid
		}
	} else if rec.Kind == Room || rec.Kind == Zone {
		if !validID(rec.ParentID) {
			return Record{}, ErrInvalid
		}
	} else {
		return Record{}, ErrInvalid
	}
	if !allowed(s, rec, security.FacilityManage) {
		return Record{}, ErrDenied
	}
	if rec.ParentID != "" {
		parentKind := Facility
		if rec.Kind == Zone {
			parentKind = Room
		}
		parent, err := svc.store.Get(ctx, s.TenantID, rec.ParentID, parentKind)
		if err != nil || parent.TenantID != s.TenantID || parent.Kind != parentKind {
			return Record{}, ErrDenied
		}
		if !allowed(s, parent, security.FacilityManage) {
			return Record{}, ErrDenied
		}
		if rec.Kind == Zone && (!validID(rec.FacilityID) || rec.FacilityID != parent.ParentID) {
			return Record{}, ErrDenied
		}
	}
	return svc.store.Create(ctx, rec)
}
func tenantPreflight(s Scope) bool {
	return s.Principal.Authenticated && s.Principal.SubjectID != "" &&
		s.Principal.SubjectID == s.Membership.SubjectID &&
		s.Membership.State == security.Active &&
		s.Membership.TenantID != "" && s.Membership.TenantID == s.TenantID
}
func (svc Service) Get(ctx context.Context, s Scope, kind Kind, id string) (Record, error) {
	if !tenantPreflight(s) {
		return Record{}, ErrDenied
	}
	if svc.store == nil || !validID(s.TenantID) || !validID(id) {
		return Record{}, ErrDenied
	}
	rec, err := svc.store.Get(ctx, s.TenantID, id, kind)
	if err != nil || rec.TenantID != s.TenantID || rec.Kind != kind || !allowed(s, rec, security.View) {
		return Record{}, ErrDenied
	}
	return rec, nil
}
func (svc Service) List(ctx context.Context, s Scope, kind Kind, parentID string) ([]Record, error) {
	if !tenantPreflight(s) {
		return nil, ErrDenied
	}
	if svc.store == nil || !validID(s.TenantID) || kind != Facility && kind != Room && kind != Zone {
		return nil, ErrDenied
	}
	if kind != Facility && !validID(parentID) {
		return nil, ErrDenied
	}
	if kind != Facility {
		parentKind := Facility
		if kind == Zone {
			parentKind = Room
		}
		parent, err := svc.Get(ctx, s, parentKind, parentID)
		if err != nil {
			return nil, ErrDenied
		}
		if !allowed(s, parent, security.View) {
			return nil, ErrDenied
		}
	}
	records, err := svc.store.List(ctx, s.TenantID, kind, parentID)
	if err != nil {
		return nil, err
	}
	visible := make([]Record, 0, len(records))
	for _, rec := range records {
		if rec.TenantID != s.TenantID || rec.Kind != kind {
			return nil, ErrDenied
		}
		if rec.ParentID != parentID && kind != Facility {
			return nil, ErrDenied
		}
		if allowed(s, rec, security.View) {
			visible = append(visible, rec)
		}
	}
	return visible, nil
}
func (svc Service) Rename(ctx context.Context, s Scope, kind Kind, id, name string, expected int64) (Record, error) {
	if svc.store == nil || !validName(name) || expected < 1 {
		return Record{}, ErrInvalid
	}
	rec, err := svc.Get(ctx, s, kind, id)
	if err != nil || !allowed(s, rec, security.FacilityManage) {
		return Record{}, ErrDenied
	}
	if rec.Revision != expected {
		return Record{}, ErrConflict
	}
	rec.Name = name
	return svc.store.Update(ctx, rec, expected)
}
