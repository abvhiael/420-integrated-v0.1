package reeferreview

import (
	"context"
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
)

type Memory struct {
	mu         sync.RWMutex
	pubs       map[string]Publication
	blobs      map[string][]byte
	idem       map[string]idemRecord
	revisions  map[string][]PublicationRevision
	moderation map[string][]ModerationEvent
}

type idemRecord struct {
	ID          string
	Fingerprint string
}

func NewMemory() *Memory {
	return &Memory{
		pubs:       map[string]Publication{},
		blobs:      map[string][]byte{},
		idem:       map[string]idemRecord{},
		revisions:  map[string][]PublicationRevision{},
		moderation: map[string][]ModerationEvent{},
	}
}

func (m *Memory) Put(ctx context.Context, p Publication) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pubs[p.ID] = p
	return nil
}

func (m *Memory) Get(ctx context.Context, id string) (Publication, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	p, ok := m.pubs[id]
	if !ok {
		return Publication{}, ErrNotFound
	}
	return p, nil
}

func (m *Memory) BindIdempotency(ctx context.Context, actor, key, fp string) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	k := actor + "\x00" + key
	if r, ok := m.idem[k]; ok {
		if r.Fingerprint != fp {
			return "", ErrConflict
		}
		return r.ID, nil
	}
	id := stableID(actor, key)
	m.idem[k] = idemRecord{ID: id, Fingerprint: fp}
	return id, nil
}

func (m *Memory) PutBlob(ctx context.Context, key string, b []byte) (string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	ref := "blob:" + key
	m.blobs[ref] = append([]byte(nil), b...)
	return ref, nil
}

func (m *Memory) GetBlob(ctx context.Context, ref string) ([]byte, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	b, ok := m.blobs[ref]
	if !ok {
		return nil, ErrNotFound
	}
	return append([]byte(nil), b...), nil
}

type MemoryBlob struct{ M *Memory }

func (b MemoryBlob) Put(ctx context.Context, key string, v []byte) (string, error) {
	return b.M.PutBlob(ctx, key, v)
}

func (b MemoryBlob) Get(ctx context.Context, ref string) ([]byte, error) {
	return b.M.GetBlob(ctx, ref)
}

func (m *Memory) ListPublic(offset, limit int) ([]Publication, int, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	all := make([]Publication, 0, len(m.pubs))
	for _, p := range m.pubs {
		if p.Status == StatusPublished && p.Visibility == VisibilityPublic {
			all = append(all, p)
		}
	}
	sort.Slice(all, func(i, j int) bool { return all[i].CreatedAt.After(all[j].CreatedAt) })
	total := len(all)
	if offset < 0 || offset > total {
		return nil, total, ErrInvalidInput
	}
	end := offset + limit
	if end > total {
		end = total
	}
	return append([]Publication(nil), all[offset:end]...), total, nil
}

func (m *Memory) List(ctx context.Context, offset, limit int) ([]Publication, int, error) {
	return m.ListPublic(offset, limit)
}

func (m *Memory) ListAll(ctx context.Context) ([]Publication, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	all := make([]Publication, 0, len(m.pubs))
	for _, p := range m.pubs {
		all = append(all, p)
	}
	sort.Slice(all, func(i, j int) bool {
		if all[i].UpdatedAt.Equal(all[j].UpdatedAt) {
			return all[i].ID < all[j].ID
		}
		return all[i].UpdatedAt.After(all[j].UpdatedAt)
	})
	return all, nil
}

func (m *Memory) AppendRevision(ctx context.Context, revision PublicationRevision) (PublicationRevision, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if strings.TrimSpace(revision.PublicationID) == "" {
		return PublicationRevision{}, ErrInvalidInput
	}
	rows := m.revisions[revision.PublicationID]
	revision.Number = len(rows) + 1
	revision.ID = fmt.Sprintf("rev_%s_%06d", revision.PublicationID, revision.Number)
	m.revisions[revision.PublicationID] = append(rows, revision)
	return revision, nil
}

func (m *Memory) UpdateRevision(ctx context.Context, revision PublicationRevision) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := m.revisions[revision.PublicationID]
	for i := range rows {
		if rows[i].ID == revision.ID {
			rows[i] = revision
			m.revisions[revision.PublicationID] = rows
			return nil
		}
	}
	return ErrNotFound
}

func (m *Memory) GetRevision(ctx context.Context, publicationID, revisionID string) (PublicationRevision, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	for _, revision := range m.revisions[publicationID] {
		if revision.ID == revisionID {
			return revision, nil
		}
	}
	return PublicationRevision{}, ErrNotFound
}

func (m *Memory) ListRevisions(ctx context.Context, publicationID string) ([]PublicationRevision, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rows := append([]PublicationRevision(nil), m.revisions[publicationID]...)
	sort.Slice(rows, func(i, j int) bool { return rows[i].Number > rows[j].Number })
	return rows, nil
}

func (m *Memory) AppendModerationEvent(ctx context.Context, event ModerationEvent) (ModerationEvent, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	rows := m.moderation[event.PublicationID]
	event.ID = fmt.Sprintf("mod_%s_%06d", event.PublicationID, len(rows)+1)
	m.moderation[event.PublicationID] = append(rows, event)
	return event, nil
}

func (m *Memory) ListModerationEvents(ctx context.Context, publicationID string) ([]ModerationEvent, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	rows := append([]ModerationEvent(nil), m.moderation[publicationID]...)
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].CreatedAt.Equal(rows[j].CreatedAt) {
			return rows[i].ID > rows[j].ID
		}
		return rows[i].CreatedAt.After(rows[j].CreatedAt)
	})
	return rows, nil
}

type AllowIdentity struct{}

func (AllowIdentity) Active(context.Context, string) (bool, error) { return true, nil }

type DevAuthorizer struct{}

func (DevAuthorizer) CanPublish(ctx context.Context, actor string, p Publication) (bool, error) {
	return actor != "" && (actor == p.Author || actor == "publisher.420"), nil
}

func (DevAuthorizer) CanModerate(ctx context.Context, actor string, p Publication) (bool, error) {
	return actor == "moderator.420" || actor == "publisher.420", nil
}

func (DevAuthorizer) CanEdit(ctx context.Context, actor string, p Publication) (bool, error) {
	return actor != "" && (actor == p.Author || actor == "publisher.420"), nil
}

func (DevAuthorizer) CanTombstone(ctx context.Context, actor string, p Publication) (bool, error) {
	return actor != "" && (actor == p.Author || actor == "publisher.420"), nil
}

func (DevAuthorizer) CanRead(ctx context.Context, actor string, p Publication) (bool, error) {
	if p.Status == StatusTombstoned {
		return false, nil
	}
	if p.Status == StatusDraft {
		return actor == p.Author || actor == "publisher.420", nil
	}
	if p.Status == StatusHidden {
		return actor == p.Author || actor == "moderator.420" || actor == "publisher.420", nil
	}
	if p.Status != StatusPublished {
		return false, nil
	}
	switch p.Visibility {
	case VisibilityPublic, VisibilityUnlisted:
		return true, nil
	case VisibilityPrivate:
		return actor == p.Author || actor == "publisher.420", nil
	case VisibilityFollowers, VisibilityCommunityOnly:
		return actor != "", nil
	case VisibilityOrganizationMembers:
		return actor == p.Author || actor == "publisher.420" || strings.HasSuffix(actor, ".org.420"), nil
	case VisibilityModerators:
		return actor == "moderator.420" || actor == "publisher.420", nil
	case VisibilityAdmins:
		return actor == "publisher.420", nil
	default:
		return false, nil
	}
}

type DevRights struct{}

func (DevRights) Assert(ctx context.Context, actor, digest string) (string, error) {
	if actor == "" || digest == "" {
		return "", errors.New("missing rights input")
	}
	return "dev-rights:" + digest, nil
}

type NoopSearch struct{}

func (NoopSearch) Upsert(context.Context, Publication) error { return nil }
func (NoopSearch) Delete(context.Context, string) error      { return nil }

type NoopNotifications struct{}

func (NoopNotifications) Published(context.Context, Publication) error { return nil }

type NoopMail struct{}

func (NoopMail) Published(context.Context, Publication) error { return nil }
