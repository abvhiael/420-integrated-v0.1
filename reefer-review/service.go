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
	CanEdit(context.Context, string, Publication) (bool, error)
	CanTombstone(context.Context, string, Publication) (bool, error)
	CanRead(context.Context, string, Publication) (bool, error)
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
	ListAll(context.Context) ([]Publication, error)
	BindIdempotency(context.Context, string, string, string) (string, error)
	AppendRevision(context.Context, PublicationRevision) (PublicationRevision, error)
	UpdateRevision(context.Context, PublicationRevision) error
	GetRevision(context.Context, string, string) (PublicationRevision, error)
	ListRevisions(context.Context, string) ([]PublicationRevision, error)
	AppendModerationEvent(context.Context, ModerationEvent) (ModerationEvent, error)
	ListModerationEvents(context.Context, string) ([]ModerationEvent, error)
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

func (s Service) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC()
	}
	return time.Now().UTC()
}

func (s Service) requireActiveActor(ctx context.Context, actor string) (string, error) {
	actor = strings.TrimSpace(actor)
	if actor == "" {
		return "", ErrUnauthorized
	}
	active, err := s.Identity.Active(ctx, actor)
	if err != nil {
		return "", err
	}
	if !active {
		return "", ErrUnauthorized
	}
	return actor, nil
}

func bodyDigest(body string) string {
	sum := sha256.Sum256([]byte(body))
	return hex.EncodeToString(sum[:])
}

func (s Service) CreateDraft(ctx context.Context, actor string, req CreateDraftRequest) (Publication, error) {
	if err := s.validate(); err != nil {
		return Publication{}, err
	}
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
		if errors.Is(err, ErrUnauthorized) && strings.TrimSpace(actor) == "" {
			return Publication{}, ErrInvalidInput
		}
		return Publication{}, err
	}
	req.Title = strings.TrimSpace(req.Title)
	req.IdempotencyKey = strings.TrimSpace(req.IdempotencyKey)
	if req.IdempotencyKey == "" || req.Title == "" || strings.TrimSpace(req.Body) == "" || !validVisibility(req.Visibility) {
		return Publication{}, ErrInvalidInput
	}

	digest := bodyDigest(req.Body)
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
	if id == proposed {
		if existing, e := s.Store.Get(ctx, proposed); e == nil {
			return existing, nil
		}
	}

	ref, err := s.Blobs.Put(ctx, digest, []byte(req.Body))
	if err != nil {
		return Publication{}, err
	}
	now := s.now()
	revision, err := s.Store.AppendRevision(ctx, PublicationRevision{
		PublicationID: proposed,
		Editor:        actor,
		Title:         req.Title,
		Summary:       strings.TrimSpace(req.Summary),
		BodyRef:       ref,
		BodyDigest:    digest,
		Visibility:    req.Visibility,
		CreatedAt:     now,
	})
	if err != nil {
		return Publication{}, err
	}
	p := Publication{
		ID: proposed, Namespace: ServiceID, Version: "v2", Author: actor,
		Title: req.Title, Summary: strings.TrimSpace(req.Summary), BodyRef: ref, BodyDigest: digest,
		Visibility: req.Visibility, Status: StatusDraft, Source: "USER_AUTHORED",
		CurrentRevisionID: revision.ID, Revision: revision.Number,
		CreatedAt: now, UpdatedAt: now,
	}
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
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
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
	now := s.now()
	p.RightsClaim = claim
	p.Status = StatusPublished
	p.PublishedAt = &now
	p.UpdatedAt = now
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, nil, err
	}
	revision, err := s.Store.GetRevision(ctx, p.ID, p.CurrentRevisionID)
	if err != nil {
		return Publication{}, nil, err
	}
	revision.RightsClaim = claim
	if err := s.Store.UpdateRevision(ctx, revision); err != nil {
		return Publication{}, nil, err
	}
	return p, s.publishProjections(ctx, p), nil
}

func (s Service) publishProjections(ctx context.Context, p Publication) []string {
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
	return warnings
}

func (s Service) Update(ctx context.Context, actor, id string, req UpdatePublicationRequest) (Publication, []string, error) {
	if err := s.validate(); err != nil {
		return Publication{}, nil, err
	}
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
		return Publication{}, nil, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, nil, err
	}
	if p.Status != StatusDraft && p.Status != StatusPublished {
		return Publication{}, nil, ErrConflict
	}
	ok, err := s.Auth.CanEdit(ctx, actor, p)
	if err != nil {
		return Publication{}, nil, err
	}
	if !ok {
		return Publication{}, nil, ErrUnauthorized
	}
	req.Title = strings.TrimSpace(req.Title)
	if req.Title == "" || strings.TrimSpace(req.Body) == "" || !validVisibility(req.Visibility) {
		return Publication{}, nil, ErrInvalidInput
	}

	digest := bodyDigest(req.Body)
	ref, err := s.Blobs.Put(ctx, digest, []byte(req.Body))
	if err != nil {
		return Publication{}, nil, err
	}
	now := s.now()
	revision := PublicationRevision{
		PublicationID: p.ID, Editor: actor, Title: req.Title, Summary: strings.TrimSpace(req.Summary),
		BodyRef: ref, BodyDigest: digest, Visibility: req.Visibility, CreatedAt: now,
	}
	if p.Status == StatusPublished {
		claim, e := s.Rights.Assert(ctx, actor, digest)
		if e != nil {
			return Publication{}, nil, e
		}
		if strings.TrimSpace(claim) == "" {
			return Publication{}, nil, fmt.Errorf("rights assertion empty")
		}
		revision.RightsClaim = claim
	}
	revision, err = s.Store.AppendRevision(ctx, revision)
	if err != nil {
		return Publication{}, nil, err
	}

	wasPublic := p.Status == StatusPublished && p.Visibility == VisibilityPublic
	p.Title = revision.Title
	p.Summary = revision.Summary
	p.BodyRef = revision.BodyRef
	p.BodyDigest = revision.BodyDigest
	p.Visibility = revision.Visibility
	p.RightsClaim = revision.RightsClaim
	p.CurrentRevisionID = revision.ID
	p.Revision = revision.Number
	p.UpdatedAt = now
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, nil, err
	}

	warnings := []string{}
	if p.Status == StatusPublished {
		if wasPublic && p.Visibility != VisibilityPublic {
			if err := s.Search.Delete(ctx, p.ID); err != nil {
				warnings = append(warnings, "search-delete:"+err.Error())
			}
		}
		if p.Visibility == VisibilityPublic {
			if err := s.Search.Upsert(ctx, p); err != nil {
				warnings = append(warnings, "search:"+err.Error())
			}
		}
	}
	return p, warnings, nil
}

func (s Service) Moderate(ctx context.Context, actor, id, action, reason string) (Publication, ModerationEvent, error) {
	if err := s.validate(); err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	ok, err := s.Auth.CanModerate(ctx, actor, p)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	if !ok {
		return Publication{}, ModerationEvent{}, ErrUnauthorized
	}
	from := p.Status
	action = strings.ToUpper(strings.TrimSpace(action))
	switch action {
	case "HIDE":
		if p.Status != StatusPublished {
			return Publication{}, ModerationEvent{}, ErrConflict
		}
		p.Status = StatusHidden
		_ = s.Search.Delete(ctx, p.ID)
	case "RESTORE":
		if p.Status != StatusHidden {
			return Publication{}, ModerationEvent{}, ErrConflict
		}
		p.Status = StatusPublished
		if p.Visibility == VisibilityPublic {
			_ = s.Search.Upsert(ctx, p)
		}
	default:
		return Publication{}, ModerationEvent{}, ErrInvalidInput
	}
	now := s.now()
	p.UpdatedAt = now
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	event, err := s.Store.AppendModerationEvent(ctx, ModerationEvent{
		PublicationID: p.ID, Actor: actor, Action: action, Reason: strings.TrimSpace(reason),
		FromStatus: from, ToStatus: p.Status, CreatedAt: now,
	})
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	return p, event, nil
}

func (s Service) Tombstone(ctx context.Context, actor, id, reason string) (Publication, ModerationEvent, error) {
	if err := s.validate(); err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	if p.Status == StatusTombstoned {
		return Publication{}, ModerationEvent{}, ErrConflict
	}
	ok, err := s.Auth.CanTombstone(ctx, actor, p)
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	if !ok {
		return Publication{}, ModerationEvent{}, ErrUnauthorized
	}
	from := p.Status
	p.Status = StatusTombstoned
	p.UpdatedAt = s.now()
	_ = s.Search.Delete(ctx, p.ID)
	if err := s.Store.Put(ctx, p); err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	event, err := s.Store.AppendModerationEvent(ctx, ModerationEvent{
		PublicationID: p.ID, Actor: actor, Action: "TOMBSTONE", Reason: strings.TrimSpace(reason),
		FromStatus: from, ToStatus: StatusTombstoned, CreatedAt: p.UpdatedAt,
	})
	if err != nil {
		return Publication{}, ModerationEvent{}, err
	}
	return p, event, nil
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

func (s Service) GetForActor(ctx context.Context, actor, id string) (Publication, []byte, error) {
	if err := s.validate(); err != nil {
		return Publication{}, nil, err
	}
	p, body, err := s.Get(ctx, id)
	if err != nil {
		return Publication{}, nil, err
	}
	actor = strings.TrimSpace(actor)
	if actor == "" {
		if p.Status == StatusPublished && (p.Visibility == VisibilityPublic || p.Visibility == VisibilityUnlisted) {
			return p, body, nil
		}
		return Publication{}, nil, ErrNotFound
	}
	if _, err := s.requireActiveActor(ctx, actor); err != nil {
		return Publication{}, nil, err
	}
	ok, err := s.Auth.CanRead(ctx, actor, p)
	if err != nil {
		return Publication{}, nil, err
	}
	if !ok {
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

func (s Service) ListEditorial(ctx context.Context, actor string, offset, limit int) ([]Publication, int, error) {
	if limit < 1 || limit > 100 || offset < 0 {
		return nil, 0, ErrInvalidInput
	}
	var err error
	actor, err = s.requireActiveActor(ctx, actor)
	if err != nil {
		return nil, 0, err
	}
	all, err := s.Store.ListAll(ctx)
	if err != nil {
		return nil, 0, err
	}
	visible := make([]Publication, 0, len(all))
	for _, p := range all {
		if actor == p.Author {
			visible = append(visible, p)
			continue
		}
		ok, e := s.Auth.CanModerate(ctx, actor, p)
		if e != nil {
			return nil, 0, e
		}
		if ok {
			visible = append(visible, p)
		}
	}
	total := len(visible)
	if offset > total {
		return nil, total, ErrInvalidInput
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return append([]Publication(nil), visible[offset:end]...), total, nil
}

func (s Service) ListRevisions(ctx context.Context, actor, id string) ([]PublicationRevision, error) {
	actor, err := s.requireActiveActor(ctx, actor)
	if err != nil {
		return nil, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	allowed := actor == p.Author
	if !allowed {
		allowed, err = s.Auth.CanEdit(ctx, actor, p)
		if err != nil {
			return nil, err
		}
	}
	if !allowed {
		allowed, err = s.Auth.CanModerate(ctx, actor, p)
		if err != nil {
			return nil, err
		}
	}
	if !allowed {
		return nil, ErrUnauthorized
	}
	return s.Store.ListRevisions(ctx, id)
}

func (s Service) ListModerationHistory(ctx context.Context, actor, id string) ([]ModerationEvent, error) {
	actor, err := s.requireActiveActor(ctx, actor)
	if err != nil {
		return nil, err
	}
	p, err := s.Store.Get(ctx, id)
	if err != nil {
		return nil, err
	}
	allowed := actor == p.Author
	if !allowed {
		allowed, err = s.Auth.CanModerate(ctx, actor, p)
		if err != nil {
			return nil, err
		}
	}
	if !allowed {
		return nil, ErrUnauthorized
	}
	return s.Store.ListModerationEvents(ctx, id)
}
