package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

var (
	ErrInvalidInput = errors.New("invalid input")
	ErrUnauthorized = errors.New("unauthorized")
	ErrNotFound     = errors.New("not found")
	ErrConflict     = errors.New("conflict")
)

type Identity interface {
	Active(context.Context, string) (bool, error)
}
type Authorizer interface {
	CanPublish(context.Context, string, Publication) (bool, error)
	CanModerate(context.Context, string, Publication) (bool, error)
}
type Rights interface {
	Assert(context.Context, string, string) (string, error)
}
type BlobStore interface {
	Put(context.Context, string, []byte) (string, error)
	Get(context.Context, string) ([]byte, error)
}
type Store interface {
	Put(context.Context, Publication) error
	Get(context.Context, string) (Publication, error)
	List(context.Context, int, int) ([]Publication, int, error)
	BindIdempotency(context.Context, string, string, string) (string, error)
}
type Search interface {
	Upsert(context.Context, Publication) error
	Delete(context.Context, string) error
}
type Notifications interface {
	Published(context.Context, Publication) error
}
type Mail interface {
	Published(context.Context, Publication) error
}

type Service struct {
	Identity      Identity
	Auth          Authorizer
	Rights        Rights
	Blobs         BlobStore
	Store         Store
	Search        Search
	Notifications Notifications
	Mail          Mail
	Now           func() time.Time
}

func (s Service) validate() error {
	if s.Identity == nil || s.Auth == nil || s.Rights == nil || s.Blobs == nil || s.Store == nil || s.Search == nil || s.Notifications == nil || s.Mail == nil {
		return errors.New("reefer review dependencies incomplete")
	}
	return nil
}

func validVisibility(v Visibility) bool {
	switch v {
	case VisibilityPublic, VisibilityUnlisted, VisibilityFollowers, VisibilityCommunityOnly, VisibilityPrivate, VisibilityOrganizationMembers, VisibilityModerators, VisibilityAdmins:
		return true
	default:
		return false
	}
}

func (s Service) CreateDraft(ctx context.Context, actor string, req CreateDraftRequest) (Publication, error) {
	if err := s.validate(); err != nil {
		return Publication{}, err
	}
	actor = strings.TrimSpace(actor)
	req.Title = strings.TrimSpace(req.Title)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if actor == "" || req.IdempotencyKey == "" || req.Title == "" || strings.TrimSpace(req.Body) == "" || !validVisibility(req.Visibility) {
		return Publication{}, ErrInvalidInput
	}
	active, err := s.Identity.Active(ctx, actor)
	if err != nil {
		return Publication{}, err
	}
	if !active {
		return Publication{}, ErrUnauthorized
	}
	body := []byte(req.Body)
	sum := sha256.Sum256(body)
	digest := hex.EncodeToString(sum[:])
	fpSum := sha256.Sum256([]byte(req.Title + "\x00" + digest + "\x00" + string(req.Visibility)))
	fingerprint := hex.EncodeToString(fpSum[:])
	proposed := stableID(actor, req.IdempotencyKey)
	id, err := s.Store.BindIdempotency(ctx, actor, req.IdempotencyKey, fingerprint)
	if err != nil {
		return Publication{}, err
	}
	if id != "" && id != proposed {
		p, e := s.Store.Get(ctx, id)
		return p, e
	}
	ref, err := s.Blobs.Put(ctx, digest, body)
	if err != nil {
		return Publication{}, err
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	p := Publication{ID: proposed, Namespace: ServiceID, Version: "v1", Author: actor, Title: req.Title, Summary: strings.TrimSpace(req.Summary), BodyRef: ref, BodyDigest: digest, Visibility: req.Visibility, Status: StatusDraft, Source: "USER_AUTHORED", CreatedAt: now, UpdatedAt: now}
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, err
	}
	return p, nil
}

func stableID(actor, key string) string {
	h := sha256.Sum256([]byte(ServiceID + "\x00" + actor + "\x00" + key))
	return "pub_" + hex.EncodeToString(h[:12])
}

func (s Service) Publish(ctx context.Context, actor, id string) (Publication, []string, error) {
	if err := s.validate(); err != nil {
		return Publication{}, nil, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, nil, err
	}
	if p.Status != StatusDraft {
		return Publication{}, nil, ErrConflict
	}
	ok, err := s.Auth.CanPublish(ctx, actor, p)
	if err != nil {
		return Publication{}, nil, err
	}
	if !ok {
		return Publication{}, nil, ErrUnauthorized
	}
	claim, err := s.Rights.Assert(ctx, actor, p.BodyDigest)
	if err != nil {
		return Publication{}, nil, err
	}
	if strings.TrimSpace(claim) == "" {
		return Publication{}, nil, fmt.Errorf("rights assertion empty")
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	p.RightsClaim = claim
	p.Status = StatusPublished
	p.PublishedAt = &now
	p.UpdatedAt = now
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, nil, err
	}
	warnings := []string{}
	if p.Visibility == VisibilityPublic {
		if err := s.Search.Upsert(ctx, p); err != nil {
			warnings = append(warnings, "search:"+err.Error())
		}
	}
	if err := s.Notifications.Published(ctx, p); err != nil {
		warnings = append(warnings, "notifications:"+err.Error())
	}
	if err := s.Mail.Published(ctx, p); err != nil {
		warnings = append(warnings, "mail:"+err.Error())
	}
	return p, warnings, nil
}

func (s Service) Moderate(ctx context.Context, actor, id, action string) (Publication, error) {
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, err
	}
	ok, err := s.Auth.CanModerate(ctx, actor, p)
	if err != nil {
		return Publication{}, err
	}
	if !ok {
		return Publication{}, ErrUnauthorized
	}
	switch strings.ToUpper(strings.TrimSpace(action)) {
	case "HIDE":
		if p.Status != StatusPublished {
			return Publication{}, ErrConflict
		}
		p.Status = StatusHidden
		_ = s.Search.Delete(ctx, p.ID)
	case "RESTORE":
		if p.Status != StatusHidden {
			return Publication{}, ErrConflict
		}
		p.Status = StatusPublished
		if p.Visibility == VisibilityPublic {
			_ = s.Search.Upsert(ctx, p)
		}
	default:
		return Publication{}, ErrInvalidInput
	}
	now := time.Now().UTC()
	if s.Now != nil {
		now = s.Now().UTC()
	}
	p.UpdatedAt = now
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, err
	}
	return p, nil
}

func (s Service) Get(ctx context.Context, id string) (Publication, []byte, error) {
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, nil, err
	}
	b, err := s.Blobs.Get(ctx, p.BodyRef)
	return p, b, err
}

func (s Service) GetPublic(ctx context.Context, id string) (Publication, []byte, error) {
	p, body, err := s.Get(ctx, id)
	if err != nil {
		return Publication{}, nil, err
	}
	if p.Status != StatusPublished || p.Visibility != VisibilityPublic {
		return Publication{}, nil, ErrNotFound
	}
	return p, body, nil
}

func (s Service) List(ctx context.Context, offset, limit int) ([]Publication, int, error) {
	if limit < 1 || limit > 100 {
		return nil, 0, ErrInvalidInput
	}
	return s.Store.List(ctx, offset, limit)
}
