package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"
)

const integrationOutboxSchemaVersion = 1

type IntegrationKind string

const (
	IntegrationSearchUpsert IntegrationKind = "SEARCH_UPSERT"
	IntegrationSearchDelete IntegrationKind = "SEARCH_DELETE"
	IntegrationNotification IntegrationKind = "NOTIFICATION"
	IntegrationMail         IntegrationKind = "MAIL"
)

type IntegrationState string

const (
	IntegrationPending   IntegrationState = "PENDING"
	IntegrationDelivered IntegrationState = "DELIVERED"
	IntegrationDead      IntegrationState = "DEAD"
)

var (
	ErrIntegrationConflict = errors.New("reefer review: integration idempotency conflict")
	ErrIntegrationStore    = errors.New("reefer review: integration outbox corrupt")
)

type IntegrationJob struct {
	ID            string           `json:"id"`
	Kind          IntegrationKind  `json:"kind"`
	PublicationID string           `json:"publication_id"`
	Revision      int              `json:"revision,omitempty"`
	Recipient     string           `json:"recipient,omitempty"`
	Fingerprint   string           `json:"fingerprint"`
	State         IntegrationState `json:"state"`
	Attempts      int              `json:"attempts"`
	NextAttemptAt time.Time        `json:"next_attempt_at"`
	LastError     string           `json:"last_error,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

type integrationOutboxData struct {
	SchemaVersion int                       `json:"schema_version"`
	Jobs          map[string]IntegrationJob `json:"jobs"`
}

type IntegrationOutbox struct {
	mu       sync.Mutex
	path     string
	lockPath string
	now      func() time.Time
}

func OpenIntegrationOutbox(path string) (*IntegrationOutbox, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("reefer review: integration outbox path required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return nil, err
	}
	q := &IntegrationOutbox{path: abs, lockPath: abs + ".lock", now: func() time.Time { return time.Now().UTC() }}
	if err := q.withLock(context.Background(), true, func() error {
		d, missing, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		if missing {
			return q.writeUnlocked(d)
		}
		return nil
	}); err != nil {
		return nil, err
	}
	return q, nil
}

func (q *IntegrationOutbox) Path() string { return q.path }

func newIntegrationOutboxData() integrationOutboxData {
	return integrationOutboxData{SchemaVersion: integrationOutboxSchemaVersion, Jobs: map[string]IntegrationJob{}}
}

func (q *IntegrationOutbox) withLock(ctx context.Context, exclusive bool, fn func() error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	q.mu.Lock()
	defer q.mu.Unlock()
	f, err := os.OpenFile(q.lockPath, os.O_CREATE|os.O_RDWR, 0o600)
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
	return fn()
}

func (q *IntegrationOutbox) loadUnlocked() (integrationOutboxData, bool, error) {
	raw, err := os.ReadFile(q.path)
	if errors.Is(err, os.ErrNotExist) {
		return newIntegrationOutboxData(), true, nil
	}
	if err != nil {
		return integrationOutboxData{}, false, err
	}
	var d integrationOutboxData
	if err := json.Unmarshal(raw, &d); err != nil {
		return integrationOutboxData{}, false, fmt.Errorf("%w: %v", ErrIntegrationStore, err)
	}
	if d.SchemaVersion != integrationOutboxSchemaVersion {
		return integrationOutboxData{}, false, fmt.Errorf("%w: schema %d", ErrIntegrationStore, d.SchemaVersion)
	}
	if d.Jobs == nil {
		d.Jobs = map[string]IntegrationJob{}
	}
	for id, job := range d.Jobs {
		if err := validateIntegrationJob(job); err != nil || id != job.ID {
			return integrationOutboxData{}, false, fmt.Errorf("%w: invalid job %q", ErrIntegrationStore, id)
		}
	}
	return d, false, nil
}

func (q *IntegrationOutbox) writeUnlocked(d integrationOutboxData) error {
	d.SchemaVersion = integrationOutboxSchemaVersion
	if d.Jobs == nil {
		d.Jobs = map[string]IntegrationJob{}
	}
	raw, err := json.MarshalIndent(d, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	dir := filepath.Dir(q.path)
	tmp, err := os.CreateTemp(dir, ".reefer-review-integrations-*")
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
	if err := os.Rename(name, q.path); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Chmod(q.path, 0o600); err != nil {
		return err
	}
	df, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer df.Close()
	return df.Sync()
}

func validateIntegrationJob(job IntegrationJob) error {
	if strings.TrimSpace(job.ID) == "" || strings.TrimSpace(job.PublicationID) == "" || strings.TrimSpace(job.Fingerprint) == "" {
		return ErrInvalidInput
	}
	switch job.Kind {
	case IntegrationSearchUpsert, IntegrationSearchDelete:
		if strings.TrimSpace(job.Recipient) != "" {
			return ErrInvalidInput
		}
	case IntegrationNotification, IntegrationMail:
		if strings.TrimSpace(job.Recipient) == "" {
			return ErrInvalidInput
		}
	default:
		return ErrInvalidInput
	}
	switch job.State {
	case IntegrationPending, IntegrationDelivered, IntegrationDead:
	default:
		return ErrInvalidInput
	}
	if job.CreatedAt.IsZero() || job.UpdatedAt.IsZero() || job.NextAttemptAt.IsZero() {
		return ErrInvalidInput
	}
	return nil
}

func integrationJobID(kind IntegrationKind, publicationID string, revision int, recipient string) string {
	material := fmt.Sprintf("%s|%s|%s|%d|%s", ServiceID, kind, strings.TrimSpace(publicationID), revision, strings.ToLower(strings.TrimSpace(recipient)))
	sum := sha256.Sum256([]byte(material))
	return "rrint_" + hex.EncodeToString(sum[:])
}

func integrationFingerprint(parts ...string) string {
	sum := sha256.Sum256([]byte(strings.Join(parts, "\x00")))
	return hex.EncodeToString(sum[:])
}

func (q *IntegrationOutbox) Enqueue(ctx context.Context, job IntegrationJob) error {
	return q.enqueue(ctx, job, false)
}

func (q *IntegrationOutbox) EnsurePending(ctx context.Context, job IntegrationJob) error {
	return q.enqueue(ctx, job, true)
}

func (q *IntegrationOutbox) enqueue(ctx context.Context, job IntegrationJob, force bool) error {
	return q.withLock(ctx, true, func() error {
		d, _, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		now := q.now().UTC()
		if job.State == "" {
			job.State = IntegrationPending
		}
		if job.CreatedAt.IsZero() {
			job.CreatedAt = now
		}
		job.UpdatedAt = now
		if job.NextAttemptAt.IsZero() || force {
			job.NextAttemptAt = now
		}
		if err := validateIntegrationJob(job); err != nil {
			return err
		}
		if existing, ok := d.Jobs[job.ID]; ok {
			if existing.Fingerprint != job.Fingerprint || existing.Kind != job.Kind ||
				existing.PublicationID != job.PublicationID || existing.Revision != job.Revision ||
				!strings.EqualFold(existing.Recipient, job.Recipient) {
				return ErrIntegrationConflict
			}
			if !force {
				return nil
			}
			existing.State = IntegrationPending
			existing.Attempts = 0
			existing.LastError = ""
			existing.NextAttemptAt = now
			existing.UpdatedAt = now
			d.Jobs[existing.ID] = existing
			return q.writeUnlocked(d)
		}
		d.Jobs[job.ID] = job
		return q.writeUnlocked(d)
	})
}

func (q *IntegrationOutbox) Pending(ctx context.Context, now time.Time, limit int) ([]IntegrationJob, error) {
	if limit <= 0 {
		limit = 100
	}
	var out []IntegrationJob
	err := q.withLock(ctx, false, func() error {
		d, _, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		for _, job := range d.Jobs {
			if job.State == IntegrationPending && !job.NextAttemptAt.After(now) {
				out = append(out, job)
			}
		}
		sort.Slice(out, func(i, j int) bool {
			if out[i].NextAttemptAt.Equal(out[j].NextAttemptAt) {
				if out[i].CreatedAt.Equal(out[j].CreatedAt) {
					return out[i].ID < out[j].ID
				}
				return out[i].CreatedAt.Before(out[j].CreatedAt)
			}
			return out[i].NextAttemptAt.Before(out[j].NextAttemptAt)
		})
		if len(out) > limit {
			out = out[:limit]
		}
		return nil
	})
	return out, err
}

func (q *IntegrationOutbox) MarkDelivered(ctx context.Context, id string) error {
	return q.updateJob(ctx, id, func(job *IntegrationJob, now time.Time) {
		job.State = IntegrationDelivered
		job.LastError = ""
		job.UpdatedAt = now
	})
}

func retryDelay(attempt int) time.Duration {
	if attempt < 1 {
		attempt = 1
	}
	delay := time.Minute
	for i := 1; i < attempt && delay < time.Hour; i++ {
		delay *= 2
		if delay > time.Hour {
			delay = time.Hour
		}
	}
	return delay
}

func (q *IntegrationOutbox) MarkFailure(ctx context.Context, id string, cause error) error {
	return q.updateJob(ctx, id, func(job *IntegrationJob, now time.Time) {
		job.Attempts++
		job.LastError = strings.TrimSpace(cause.Error())
		if len(job.LastError) > 512 {
			job.LastError = job.LastError[:512]
		}
		if job.Attempts >= 5 {
			job.State = IntegrationDead
		} else {
			job.State = IntegrationPending
			job.NextAttemptAt = now.Add(retryDelay(job.Attempts))
		}
		job.UpdatedAt = now
	})
}

func (q *IntegrationOutbox) updateJob(ctx context.Context, id string, fn func(*IntegrationJob, time.Time)) error {
	return q.withLock(ctx, true, func() error {
		d, _, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		job, ok := d.Jobs[strings.TrimSpace(id)]
		if !ok {
			return ErrNotFound
		}
		fn(&job, q.now().UTC())
		if err := validateIntegrationJob(job); err != nil {
			return err
		}
		d.Jobs[job.ID] = job
		return q.writeUnlocked(d)
	})
}

func (q *IntegrationOutbox) Get(ctx context.Context, id string) (IntegrationJob, error) {
	var out IntegrationJob
	err := q.withLock(ctx, false, func() error {
		d, _, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		job, ok := d.Jobs[strings.TrimSpace(id)]
		if !ok {
			return ErrNotFound
		}
		out = job
		return nil
	})
	return out, err
}

func (q *IntegrationOutbox) List(ctx context.Context) ([]IntegrationJob, error) {
	var out []IntegrationJob
	err := q.withLock(ctx, false, func() error {
		d, _, err := q.loadUnlocked()
		if err != nil {
			return err
		}
		for _, job := range d.Jobs {
			out = append(out, job)
		}
		sort.Slice(out, func(i, j int) bool {
			if out[i].CreatedAt.Equal(out[j].CreatedAt) {
				return out[i].ID < out[j].ID
			}
			return out[i].CreatedAt.Before(out[j].CreatedAt)
		})
		return nil
	})
	return out, err
}
