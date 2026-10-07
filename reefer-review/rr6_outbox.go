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
	"time"
)

const IntegrationOutboxSchemaVersion = 1

type IntegrationOperationKind string

const (
	IntegrationSearchUpsert IntegrationOperationKind = "SEARCH_UPSERT"
	IntegrationSearchDelete IntegrationOperationKind = "SEARCH_DELETE"
	IntegrationNotifications IntegrationOperationKind = "NOTIFICATIONS"
	IntegrationMail          IntegrationOperationKind = "MAIL"
)

type IntegrationOperation struct {
	ID            string                   `json:"id"`
	Kind          IntegrationOperationKind `json:"kind"`
	PublicationID string                   `json:"publication_id"`
	Revision      int                      `json:"revision"`
	Publication   *Publication             `json:"publication,omitempty"`
	Attempts      int                      `json:"attempts"`
	LastError     string                   `json:"last_error,omitempty"`
	CreatedAt     time.Time                `json:"created_at"`
	UpdatedAt     time.Time                `json:"updated_at"`
}

type integrationOutboxData struct {
	SchemaVersion int                             `json:"schema_version"`
	Pending       map[string]IntegrationOperation `json:"pending"`
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
		return nil, ErrIntegrationConfiguration
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return nil, err
	}
	o := &IntegrationOutbox{path: abs, lockPath: abs + ".lock", now: time.Now}
	if err := o.initialize(context.Background()); err != nil {
		return nil, err
	}
	return o, nil
}

func newIntegrationOutboxData() integrationOutboxData {
	return integrationOutboxData{SchemaVersion: IntegrationOutboxSchemaVersion, Pending: map[string]IntegrationOperation{}}
}

func normalizeIntegrationOutboxData(d *integrationOutboxData) {
	if d.SchemaVersion == 0 {
		d.SchemaVersion = IntegrationOutboxSchemaVersion
	}
	if d.Pending == nil {
		d.Pending = map[string]IntegrationOperation{}
	}
}

func (o *IntegrationOutbox) initialize(ctx context.Context) error {
	return o.withLock(ctx, true, func() error {
		data, missing, err := o.loadUnlocked()
		if err != nil {
			return err
		}
		if missing {
			return o.writeUnlocked(data)
		}
		return nil
	})
}

func (o *IntegrationOutbox) withLock(ctx context.Context, exclusive bool, fn func() error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	o.mu.Lock()
	defer o.mu.Unlock()
	f, err := os.OpenFile(o.lockPath, os.O_CREATE|os.O_RDWR, 0o600)
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

func (o *IntegrationOutbox) loadUnlocked() (integrationOutboxData, bool, error) {
	raw, err := os.ReadFile(o.path)
	if errors.Is(err, os.ErrNotExist) {
		return newIntegrationOutboxData(), true, nil
	}
	if err != nil {
		return integrationOutboxData{}, false, err
	}
	var data integrationOutboxData
	if err := json.Unmarshal(raw, &data); err != nil {
		return integrationOutboxData{}, false, err
	}
	if data.SchemaVersion != IntegrationOutboxSchemaVersion {
		return integrationOutboxData{}, false, fmt.Errorf("reefer review: unsupported integration outbox schema %d", data.SchemaVersion)
	}
	normalizeIntegrationOutboxData(&data)
	if err := validateIntegrationOutboxData(data); err != nil {
		return integrationOutboxData{}, false, err
	}
	return data, false, nil
}

func (o *IntegrationOutbox) writeUnlocked(data integrationOutboxData) error {
	data.SchemaVersion = IntegrationOutboxSchemaVersion
	normalizeIntegrationOutboxData(&data)
	if err := validateIntegrationOutboxData(data); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	raw = append(raw, '\n')
	dir := filepath.Dir(o.path)
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
	if err := os.Rename(name, o.path); err != nil {
		_ = os.Remove(name)
		return err
	}
	if err := os.Chmod(o.path, 0o600); err != nil {
		return err
	}
	dirFile, err := os.Open(dir)
	if err != nil {
		return err
	}
	defer dirFile.Close()
	return dirFile.Sync()
}

func validateIntegrationOutboxData(data integrationOutboxData) error {
	if data.SchemaVersion != IntegrationOutboxSchemaVersion {
		return ErrIntegrationConfiguration
	}
	for id, op := range data.Pending {
		if id == "" || op.ID != id || strings.TrimSpace(op.PublicationID) == "" || op.CreatedAt.IsZero() || op.UpdatedAt.IsZero() {
			return ErrIntegrationConfiguration
		}
		switch op.Kind {
		case IntegrationSearchUpsert, IntegrationNotifications, IntegrationMail:
			if op.Publication == nil || op.Publication.ID != op.PublicationID || op.Revision < 1 {
				return ErrIntegrationConfiguration
			}
		case IntegrationSearchDelete:
		default:
			return ErrIntegrationConfiguration
		}
	}
	return nil
}

func (o *IntegrationOutbox) update(ctx context.Context, fn func(*integrationOutboxData) error) error {
	return o.withLock(ctx, true, func() error {
		data, _, err := o.loadUnlocked()
		if err != nil {
			return err
		}
		if err := fn(&data); err != nil {
			return err
		}
		return o.writeUnlocked(data)
	})
}

func (o *IntegrationOutbox) view(ctx context.Context, fn func(integrationOutboxData) error) error {
	return o.withLock(ctx, false, func() error {
		data, _, err := o.loadUnlocked()
		if err != nil {
			return err
		}
		return fn(data)
	})
}

func integrationOperationID(kind IntegrationOperationKind, publicationID string, revision int) string {
	return integrationKey(string(kind), publicationID, revision, "")
}

func (o *IntegrationOutbox) Enqueue(ctx context.Context, op IntegrationOperation) (IntegrationOperation, error) {
	op.PublicationID = strings.TrimSpace(op.PublicationID)
	if op.PublicationID == "" {
		return IntegrationOperation{}, ErrIntegrationConfiguration
	}
	if op.ID == "" {
		op.ID = integrationOperationID(op.Kind, op.PublicationID, op.Revision)
	}
	now := o.now().UTC()
	var out IntegrationOperation
	err := o.update(ctx, func(data *integrationOutboxData) error {
		if existing, ok := data.Pending[op.ID]; ok {
			out = existing
			return nil
		}
		op.CreatedAt = now
		op.UpdatedAt = now
		data.Pending[op.ID] = op
		out = op
		return nil
	})
	return out, err
}

func (o *IntegrationOutbox) MarkFailed(ctx context.Context, id string, cause error) error {
	return o.update(ctx, func(data *integrationOutboxData) error {
		op, ok := data.Pending[id]
		if !ok {
			return nil
		}
		op.Attempts++
		if cause != nil {
			op.LastError = strings.TrimSpace(cause.Error())
			if len(op.LastError) > 256 {
				op.LastError = op.LastError[:256]
			}
		}
		op.UpdatedAt = o.now().UTC()
		data.Pending[id] = op
		return nil
	})
}

func (o *IntegrationOutbox) Complete(ctx context.Context, id string) error {
	return o.update(ctx, func(data *integrationOutboxData) error {
		delete(data.Pending, id)
		return nil
	})
}

func (o *IntegrationOutbox) Pending(ctx context.Context) ([]IntegrationOperation, error) {
	var out []IntegrationOperation
	err := o.view(ctx, func(data integrationOutboxData) error {
		out = make([]IntegrationOperation, 0, len(data.Pending))
		for _, op := range data.Pending {
			out = append(out, op)
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

type QueuedSearch struct {
	Outbox   *IntegrationOutbox
	Delegate Search
}

func (q QueuedSearch) Upsert(ctx context.Context, p Publication) error {
	if q.Outbox == nil || q.Delegate == nil {
		return ErrIntegrationConfiguration
	}
	op, err := q.Outbox.Enqueue(ctx, IntegrationOperation{
		Kind: IntegrationSearchUpsert, PublicationID: p.ID, Revision: p.Revision, Publication: &p,
	})
	if err != nil {
		return err
	}
	if err := q.Delegate.Upsert(ctx, p); err != nil {
		_ = q.Outbox.MarkFailed(ctx, op.ID, err)
		return err
	}
	return q.Outbox.Complete(ctx, op.ID)
}

func (q QueuedSearch) Delete(ctx context.Context, publicationID string) error {
	if q.Outbox == nil || q.Delegate == nil {
		return ErrIntegrationConfiguration
	}
	op, err := q.Outbox.Enqueue(ctx, IntegrationOperation{
		Kind: IntegrationSearchDelete, PublicationID: publicationID,
	})
	if err != nil {
		return err
	}
	if err := q.Delegate.Delete(ctx, publicationID); err != nil {
		_ = q.Outbox.MarkFailed(ctx, op.ID, err)
		return err
	}
	return q.Outbox.Complete(ctx, op.ID)
}

type QueuedNotifications struct {
	Outbox   *IntegrationOutbox
	Delegate Notifications
}

func (q QueuedNotifications) Published(ctx context.Context, p Publication) error {
	if q.Outbox == nil || q.Delegate == nil {
		return ErrIntegrationConfiguration
	}
	op, err := q.Outbox.Enqueue(ctx, IntegrationOperation{
		Kind: IntegrationNotifications, PublicationID: p.ID, Revision: p.Revision, Publication: &p,
	})
	if err != nil {
		return err
	}
	if err := q.Delegate.Published(ctx, p); err != nil {
		_ = q.Outbox.MarkFailed(ctx, op.ID, err)
		return err
	}
	return q.Outbox.Complete(ctx, op.ID)
}

type QueuedMail struct {
	Outbox   *IntegrationOutbox
	Delegate Mail
}

func (q QueuedMail) Published(ctx context.Context, p Publication) error {
	if q.Outbox == nil || q.Delegate == nil {
		return ErrIntegrationConfiguration
	}
	op, err := q.Outbox.Enqueue(ctx, IntegrationOperation{
		Kind: IntegrationMail, PublicationID: p.ID, Revision: p.Revision, Publication: &p,
	})
	if err != nil {
		return err
	}
	if err := q.Delegate.Published(ctx, p); err != nil {
		_ = q.Outbox.MarkFailed(ctx, op.ID, err)
		return err
	}
	return q.Outbox.Complete(ctx, op.ID)
}

type IntegrationReconciler struct {
	Outbox        *IntegrationOutbox
	Search        Search
	Notifications Notifications
	Mail          Mail
}

type IntegrationReconcileReport struct {
	Attempted int
	Completed int
	Failed    int
}

func (r IntegrationReconciler) ReconcileOnce(ctx context.Context) (IntegrationReconcileReport, error) {
	if r.Outbox == nil || r.Search == nil || r.Notifications == nil || r.Mail == nil {
		return IntegrationReconcileReport{}, ErrIntegrationConfiguration
	}
	pending, err := r.Outbox.Pending(ctx)
	if err != nil {
		return IntegrationReconcileReport{}, err
	}
	report := IntegrationReconcileReport{}
	var errs []error
	for _, op := range pending {
		report.Attempted++
		var deliverErr error
		switch op.Kind {
		case IntegrationSearchUpsert:
			deliverErr = r.Search.Upsert(ctx, *op.Publication)
		case IntegrationSearchDelete:
			deliverErr = r.Search.Delete(ctx, op.PublicationID)
		case IntegrationNotifications:
			deliverErr = r.Notifications.Published(ctx, *op.Publication)
		case IntegrationMail:
			deliverErr = r.Mail.Published(ctx, *op.Publication)
		default:
			deliverErr = ErrIntegrationConfiguration
		}
		if deliverErr != nil {
			report.Failed++
			_ = r.Outbox.MarkFailed(ctx, op.ID, deliverErr)
			errs = append(errs, fmt.Errorf("%s: %w", op.ID, deliverErr))
			continue
		}
		if err := r.Outbox.Complete(ctx, op.ID); err != nil {
			report.Failed++
			errs = append(errs, err)
			continue
		}
		report.Completed++
	}
	return report, errors.Join(errs...)
}
