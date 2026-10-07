package reeferreview

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
)

const DurableStoreSchemaVersion = 1

var (
	ErrDurableStoreCorrupt   = errors.New("reefer review: durable store corrupt")
	ErrDurableStoreSchemaNew = errors.New("reefer review: durable store schema too new")
)

type durableIdempotencyRecord struct {
	ID          string `json:"id"`
	Fingerprint string `json:"fingerprint"`
}

type durableStoreData struct {
	SchemaVersion int                                 `json:"schema_version"`
	Publications  map[string]Publication              `json:"publications"`
	Idempotency   map[string]durableIdempotencyRecord `json:"idempotency"`
	Revisions     map[string][]PublicationRevision    `json:"revisions"`
	Moderation    map[string][]ModerationEvent        `json:"moderation"`
}

type DurableStore struct {
	mu       sync.Mutex
	path     string
	lockPath string
}

func OpenDurableStore(path string) (*DurableStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("reefer review: durable store path required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return nil, err
	}
	s := &DurableStore{path: abs, lockPath: abs + ".lock"}
	if err := s.initialize(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *DurableStore) Durable() bool { return true }
func (s *DurableStore) Path() string  { return s.path }

func newDurableStoreData() durableStoreData {
	return durableStoreData{
		SchemaVersion: DurableStoreSchemaVersion,
		Publications:  map[string]Publication{},
		Idempotency:   map[string]durableIdempotencyRecord{},
		Revisions:     map[string][]PublicationRevision{},
		Moderation:    map[string][]ModerationEvent{},
	}
}

func normalizeDurableStoreData(d *durableStoreData) {
	if d.SchemaVersion == 0 {
		d.SchemaVersion = DurableStoreSchemaVersion
	}
	if d.Publications == nil {
		d.Publications = map[string]Publication{}
	}
	if d.Idempotency == nil {
		d.Idempotency = map[string]durableIdempotencyRecord{}
	}
	if d.Revisions == nil {
		d.Revisions = map[string][]PublicationRevision{}
	}
	if d.Moderation == nil {
		d.Moderation = map[string][]ModerationEvent{}
	}
}

func (s *DurableStore) initialize(ctx context.Context) error {
	return s.withLock(ctx, true, func() error {
		d, missing, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		if missing {
			return s.writeUnlocked(d)
		}
		return nil
	})
}

func (s *DurableStore) withLock(ctx context.Context, exclusive bool, fn func() error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	f, err := os.OpenFile(s.lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return err
	}
	defer f.Close()

	mode := syscall.LOCK_SH
	if exclusive {
		mode = syscall.LOCK_EX
	}
	if err := syscall.Flock(int(f.Fd()), mode); err != nil {
		return err
	}
	defer syscall.Flock(int(f.Fd()), syscall.LOCK_UN)

	if err := ctx.Err(); err != nil {
		return err
	}
	return fn()
}

func (s *DurableStore) loadUnlocked() (durableStoreData, bool, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return newDurableStoreData(), true, nil
	}
	if err != nil {
		return durableStoreData{}, false, err
	}
	var d durableStoreData
	if err := json.Unmarshal(raw, &d); err != nil {
		return durableStoreData{}, false, fmt.Errorf("%w: %v", ErrDurableStoreCorrupt, err)
	}
	if d.SchemaVersion > DurableStoreSchemaVersion {
		return durableStoreData{}, false, ErrDurableStoreSchemaNew
	}
	normalizeDurableStoreData(&d)
	d.SchemaVersion = DurableStoreSchemaVersion
	if err := validateDurableStoreData(&d); err != nil {
		return durableStoreData{}, false, fmt.Errorf("%w: %v", ErrDurableStoreCorrupt, err)
	}
	return d, false, nil
}

func (s *DurableStore) writeUnlocked(d durableStoreData) error {
	d.SchemaVersion = DurableStoreSchemaVersion
	normalizeDurableStoreData(&d)
	if err := validateDurableStoreData(&d); err != nil {
		return fmt.Errorf("%w: %v", ErrDurableStoreCorrupt, err)
	}
	raw, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')

	dir := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(dir, ".reefer-review-store-*")
	if err != nil {
		return err
	}
	name := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(name)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return err
	}
	if _, err := tmp.Write(raw); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Rename(name, s.path); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Chmod(s.path, 0o600); err != nil {
		return err
	}
	df, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer df.Close()
	return df.Sync()
}

func (s *DurableStore) view(ctx context.Context, fn func(durableStoreData) error) error {
	return s.withLock(ctx, false, func() error {
		d, _, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		return fn(d)
	})
}

func (s *DurableStore) update(ctx context.Context, fn func(*durableStoreData) error) error {
	return s.withLock(ctx, true, func() error {
		d, _, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		if err := fn(&d); err != nil {
			return err
		}
		return s.writeUnlocked(d)
	})
}

func validateDurableStoreData(d *durableStoreData) error {
	if d.SchemaVersion != DurableStoreSchemaVersion {
		return fmt.Errorf("schema version %d", d.SchemaVersion)
	}
	for id, p := range d.Publications {
		if id == "" || p.ID != id || p.Author == "" || p.CurrentRevisionID == "" || p.Revision < 1 {
			return fmt.Errorf("invalid publication %q", id)
		}
		rows := d.Revisions[id]
		if len(rows) < p.Revision {
			return fmt.Errorf("publication %q revision gap", id)
		}
		found := false
		for i, r := range rows {
			if r.PublicationID != id || r.Number != i+1 || r.ID == "" {
				return fmt.Errorf("invalid revision sequence for %q", id)
			}
			if r.ID == p.CurrentRevisionID {
				if r.Number != p.Revision || r.BodyRef != p.BodyRef || r.BodyDigest != p.BodyDigest {
					return fmt.Errorf("publication %q current revision mismatch", id)
				}
				found = true
			}
		}
		if !found {
			return fmt.Errorf("publication %q current revision missing", id)
		}
	}
	for key, r := range d.Idempotency {
		if key == "" || r.ID == "" || r.Fingerprint == "" {
			return fmt.Errorf("invalid idempotency %q", key)
		}
	}
	for pid, rows := range d.Moderation {
		for i, e := range rows {
			if e.PublicationID != pid || e.ID == "" {
				return fmt.Errorf("invalid moderation %q[%d]", pid, i)
			}
		}
	}
	return nil
}

func durableIdemKey(actor, key string) string { return actor + "\x00" + key }

func (s *DurableStore) Put(ctx context.Context, p Publication) error {
	return s.update(ctx, func(d *durableStoreData) error {
		if strings.TrimSpace(p.ID) == "" {
			return ErrInvalidInput
		}
		d.Publications[p.ID] = p
		return nil
	})
}

func (s *DurableStore) Get(ctx context.Context, id string) (Publication, error) {
	var out Publication
	err := s.view(ctx, func(d durableStoreData) error {
		p, ok := d.Publications[id]
		if !ok {
			return ErrNotFound
		}
		out = p
		return nil
	})
	return out, err
}

func (s *DurableStore) List(ctx context.Context, offset, limit int) ([]Publication, int, error) {
	var out []Publication
	total := 0
	err := s.view(ctx, func(d durableStoreData) error {
		all := make([]Publication, 0, len(d.Publications))
		for _, p := range d.Publications {
			if p.Status == StatusPublished && p.Visibility == VisibilityPublic {
				all = append(all, p)
			}
		}
		sort.Slice(all, func(i, j int) bool {
			if all[i].CreatedAt.Equal(all[j].CreatedAt) {
				return all[i].ID < all[j].ID
			}
			return all[i].CreatedAt.After(all[j].CreatedAt)
		})
		total = len(all)
		if offset < 0 || offset > total {
			return ErrInvalidInput
		}
		end := offset + limit
		if end > total {
			end = total
		}
		out = append([]Publication(nil), all[offset:end]...)
		return nil
	})
	return out, total, err
}

func (s *DurableStore) ListAll(ctx context.Context) ([]Publication, error) {
	var out []Publication
	err := s.view(ctx, func(d durableStoreData) error {
		for _, p := range d.Publications {
			out = append(out, p)
		}
		sort.Slice(out, func(i, j int) bool {
			if out[i].UpdatedAt.Equal(out[j].UpdatedAt) {
				return out[i].ID < out[j].ID
			}
			return out[i].UpdatedAt.After(out[j].UpdatedAt)
		})
		return nil
	})
	return out, err
}

func (s *DurableStore) BindIdempotency(ctx context.Context, actor, key, fp string) (string, error) {
	var id string
	err := s.update(ctx, func(d *durableStoreData) error {
		k := durableIdemKey(actor, key)
		if r, ok := d.Idempotency[k]; ok {
			if r.Fingerprint != fp {
				return ErrConflict
			}
			id = r.ID
			return nil
		}
		id = stableID(actor, key)
		d.Idempotency[k] = durableIdempotencyRecord{ID: id, Fingerprint: fp}
		return nil
	})
	return id, err
}

func sameDurableRevision(a, b PublicationRevision) bool {
	return a.PublicationID == b.PublicationID &&
		a.Editor == b.Editor &&
		a.Title == b.Title &&
		a.Summary == b.Summary &&
		a.BodyRef == b.BodyRef &&
		a.BodyDigest == b.BodyDigest &&
		a.RightsClaim == b.RightsClaim &&
		a.Visibility == b.Visibility
}

func (s *DurableStore) AppendRevision(ctx context.Context, r PublicationRevision) (PublicationRevision, error) {
	var out PublicationRevision
	err := s.update(ctx, func(d *durableStoreData) error {
		rows := d.Revisions[r.PublicationID]
		if len(rows) > 0 && sameDurableRevision(rows[len(rows)-1], r) {
			out = rows[len(rows)-1]
			return nil
		}
		r.Number = len(rows) + 1
		r.ID = fmt.Sprintf("rev_%s_%06d", r.PublicationID, r.Number)
		d.Revisions[r.PublicationID] = append(rows, r)
		out = r
		return nil
	})
	return out, err
}

func (s *DurableStore) UpdateRevision(ctx context.Context, r PublicationRevision) error {
	return s.update(ctx, func(d *durableStoreData) error {
		rows := d.Revisions[r.PublicationID]
		for i := range rows {
			if rows[i].ID == r.ID {
				rows[i] = r
				d.Revisions[r.PublicationID] = rows
				return nil
			}
		}
		return ErrNotFound
	})
}

func (s *DurableStore) GetRevision(ctx context.Context, pid, rid string) (PublicationRevision, error) {
	var out PublicationRevision
	err := s.view(ctx, func(d durableStoreData) error {
		for _, r := range d.Revisions[pid] {
			if r.ID == rid {
				out = r
				return nil
			}
		}
		return ErrNotFound
	})
	return out, err
}

func (s *DurableStore) ListRevisions(ctx context.Context, pid string) ([]PublicationRevision, error) {
	var out []PublicationRevision
	err := s.view(ctx, func(d durableStoreData) error {
		out = append([]PublicationRevision(nil), d.Revisions[pid]...)
		sort.Slice(out, func(i, j int) bool { return out[i].Number > out[j].Number })
		return nil
	})
	return out, err
}

func (s *DurableStore) AppendModerationEvent(ctx context.Context, e ModerationEvent) (ModerationEvent, error) {
	var out ModerationEvent
	err := s.update(ctx, func(d *durableStoreData) error {
		rows := d.Moderation[e.PublicationID]
		e.ID = fmt.Sprintf("mod_%s_%06d", e.PublicationID, len(rows)+1)
		d.Moderation[e.PublicationID] = append(rows, e)
		out = e
		return nil
	})
	return out, err
}

func (s *DurableStore) ListModerationEvents(ctx context.Context, pid string) ([]ModerationEvent, error) {
	var out []ModerationEvent
	err := s.view(ctx, func(d durableStoreData) error {
		out = append([]ModerationEvent(nil), d.Moderation[pid]...)
		sort.Slice(out, func(i, j int) bool {
			if out[i].CreatedAt.Equal(out[j].CreatedAt) {
				return out[i].ID > out[j].ID
			}
			return out[i].CreatedAt.After(out[j].CreatedAt)
		})
		return nil
	})
	return out, err
}
