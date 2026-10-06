package mail

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
	ErrStoreCorrupt      = errors.New("mail: durable store corrupt")
	ErrStoreSchemaTooNew = errors.New("mail: durable store schema newer than supported")
	ErrStoreTransaction  = errors.New("mail: durable store transaction failed")
)

type storeData struct {
	SchemaVersion int
	Messages      map[string]Message
	ByIdem        map[string]string
	Mailbox       map[string]MailboxState
	MailboxIndex  map[string][]string
}

type diskStoreData struct {
	SchemaVersion   int                     `json:"schema_version"`
	Messages        map[string]Message      `json:"messages"`
	ByIdem          map[string]string       `json:"idempotency"`
	Mailbox         map[string]MailboxState `json:"mailbox"`
	MailboxIndex    map[string][]string     `json:"mailbox_index"`
	Fingerprints    map[string]string       `json:"fingerprints,omitempty"`
	IdempotencyKeys map[string]string       `json:"idempotency_keys,omitempty"`
}

type MailStore interface {
	View(context.Context, func(*storeData) error) error
	Update(context.Context, func(*storeData) error) error
	Durable() bool
}

type MemoryStore struct {
	mu   sync.RWMutex
	data storeData
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{data: newStoreData()}
}

func (s *MemoryStore) Durable() bool { return false }

func (s *MemoryStore) View(ctx context.Context, fn func(*storeData) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	return fn(&s.data)
}

func (s *MemoryStore) Update(ctx context.Context, fn func(*storeData) error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	next := cloneStoreData(s.data)
	if err := fn(&next); err != nil {
		return err
	}
	normalizeStoreData(&next)
	rebuildMailboxIndex(&next)
	if err := validateStoreData(&next); err != nil {
		return fmt.Errorf("%w: %v", ErrStoreTransaction, err)
	}
	s.data = next
	return nil
}

type DurableStore struct {
	path     string
	lockPath string
	mu       sync.Mutex
}

func OpenDurableStore(path string) (*DurableStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, errors.New("mail: durable store path required")
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err := os.MkdirAll(filepath.Dir(abs), 0o700); err != nil {
		return nil, fmt.Errorf("mail: create durable store directory: %w", err)
	}
	s := &DurableStore{path: abs, lockPath: abs + ".lock"}
	if err := s.initialize(context.Background()); err != nil {
		return nil, err
	}
	return s, nil
}

func (s *DurableStore) Durable() bool { return true }

func (s *DurableStore) Path() string { return s.path }

func (s *DurableStore) initialize(ctx context.Context) error {
	return s.withLock(ctx, true, func() error {
		data, migrated, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		if migrated || !fileExists(s.path) {
			return s.writeUnlocked(data)
		}
		return nil
	})
}

func (s *DurableStore) View(ctx context.Context, fn func(*storeData) error) error {
	return s.withLock(ctx, false, func() error {
		data, _, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		return fn(&data)
	})
}

func (s *DurableStore) Update(ctx context.Context, fn func(*storeData) error) error {
	return s.withLock(ctx, true, func() error {
		data, _, err := s.loadUnlocked()
		if err != nil {
			return err
		}
		next := cloneStoreData(data)
		if err := fn(&next); err != nil {
			return err
		}
		normalizeStoreData(&next)
		rebuildMailboxIndex(&next)
		if err := validateStoreData(&next); err != nil {
			return fmt.Errorf("%w: %v", ErrStoreTransaction, err)
		}
		return s.writeUnlocked(next)
	})
}

func (s *DurableStore) withLock(ctx context.Context, exclusive bool, fn func() error) error {
	if err := ctx.Err(); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	lockFile, err := os.OpenFile(s.lockPath, os.O_CREATE|os.O_RDWR, 0o600)
	if err != nil {
		return fmt.Errorf("mail: open durable store lock: %w", err)
	}
	defer lockFile.Close()

	mode := syscall.LOCK_SH
	if exclusive {
		mode = syscall.LOCK_EX
	}
	if err := syscall.Flock(int(lockFile.Fd()), mode); err != nil {
		return fmt.Errorf("mail: acquire durable store lock: %w", err)
	}
	defer syscall.Flock(int(lockFile.Fd()), syscall.LOCK_UN)

	if err := ctx.Err(); err != nil {
		return err
	}
	return fn()
}

func (s *DurableStore) loadUnlocked() (storeData, bool, error) {
	raw, err := os.ReadFile(s.path)
	if errors.Is(err, os.ErrNotExist) {
		return newStoreData(), true, nil
	}
	if err != nil {
		return storeData{}, false, fmt.Errorf("mail: read durable store: %w", err)
	}
	var disk diskStoreData
	if err := json.Unmarshal(raw, &disk); err != nil {
		return storeData{}, false, fmt.Errorf("%w: decode: %v", ErrStoreCorrupt, err)
	}
	if disk.SchemaVersion > DurableStoreSchemaVersion {
		return storeData{}, false, fmt.Errorf("%w: got %d want <= %d", ErrStoreSchemaTooNew, disk.SchemaVersion, DurableStoreSchemaVersion)
	}
	migrated := disk.SchemaVersion < DurableStoreSchemaVersion
	data := storeData{
		SchemaVersion: disk.SchemaVersion,
		Messages:      disk.Messages,
		ByIdem:        disk.ByIdem,
		Mailbox:       disk.Mailbox,
		MailboxIndex:  disk.MailboxIndex,
	}
	normalizeStoreData(&data)
	for id, fp := range disk.Fingerprints {
		msg, ok := data.Messages[id]
		if !ok {
			continue
		}
		msg.Fingerprint = fp
		msg.IdempotencyKey = disk.IdempotencyKeys[id]
		data.Messages[id] = msg
	}
	if data.SchemaVersion == 0 {
		data.SchemaVersion = DurableStoreSchemaVersion
		migrated = true
	}
	rebuildMailboxIndex(&data)
	if err := validateStoreData(&data); err != nil {
		return storeData{}, false, fmt.Errorf("%w: %v", ErrStoreCorrupt, err)
	}
	return data, migrated, nil
}

func (s *DurableStore) writeUnlocked(data storeData) error {
	data.SchemaVersion = DurableStoreSchemaVersion
	normalizeStoreData(&data)
	rebuildMailboxIndex(&data)
	if err := validateStoreData(&data); err != nil {
		return fmt.Errorf("%w: %v", ErrStoreTransaction, err)
	}

	disk := diskStoreData{
		SchemaVersion:   DurableStoreSchemaVersion,
		Messages:        data.Messages,
		ByIdem:          data.ByIdem,
		Mailbox:         data.Mailbox,
		MailboxIndex:    data.MailboxIndex,
		Fingerprints:    map[string]string{},
		IdempotencyKeys: map[string]string{},
	}
	for id, msg := range data.Messages {
		if msg.Fingerprint != "" {
			disk.Fingerprints[id] = msg.Fingerprint
		}
		if msg.IdempotencyKey != "" {
			disk.IdempotencyKeys[id] = msg.IdempotencyKey
		}
	}
	raw, err := json.MarshalIndent(disk, "", "  ")
	if err != nil {
		return fmt.Errorf("mail: encode durable store: %w", err)
	}
	raw = append(raw, '\n')

	dir := filepath.Dir(s.path)
	tmp, err := os.CreateTemp(dir, ".420mail-store-*")
	if err != nil {
		return fmt.Errorf("mail: create durable store temp file: %w", err)
	}
	tmpName := tmp.Name()
	cleanup := func() {
		tmp.Close()
		_ = os.Remove(tmpName)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return fmt.Errorf("mail: chmod durable store temp file: %w", err)
	}
	if _, err := tmp.Write(raw); err != nil {
		cleanup()
		return fmt.Errorf("mail: write durable store temp file: %w", err)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return fmt.Errorf("mail: sync durable store temp file: %w", err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return fmt.Errorf("mail: close durable store temp file: %w", err)
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		_ = os.Remove(tmpName)
		return fmt.Errorf("mail: atomically replace durable store: %w", err)
	}
	if err := os.Chmod(s.path, 0o600); err != nil {
		return fmt.Errorf("mail: chmod durable store: %w", err)
	}
	dirFile, err := os.Open(dir)
	if err != nil {
		return fmt.Errorf("mail: open durable store directory for sync: %w", err)
	}
	defer dirFile.Close()
	if err := dirFile.Sync(); err != nil {
		return fmt.Errorf("mail: sync durable store directory: %w", err)
	}
	return nil
}

func newStoreData() storeData {
	return storeData{
		SchemaVersion: DurableStoreSchemaVersion,
		Messages:      map[string]Message{},
		ByIdem:        map[string]string{},
		Mailbox:       map[string]MailboxState{},
		MailboxIndex:  map[string][]string{},
	}
}

func normalizeStoreData(data *storeData) {
	if data.SchemaVersion == 0 {
		data.SchemaVersion = DurableStoreSchemaVersion
	}
	if data.Messages == nil {
		data.Messages = map[string]Message{}
	}
	if data.ByIdem == nil {
		data.ByIdem = map[string]string{}
	}
	if data.Mailbox == nil {
		data.Mailbox = map[string]MailboxState{}
	}
	if data.MailboxIndex == nil {
		data.MailboxIndex = map[string][]string{}
	}
}

func cloneStoreData(src storeData) storeData {
	dst := storeData{
		SchemaVersion: src.SchemaVersion,
		Messages:      make(map[string]Message, len(src.Messages)),
		ByIdem:        make(map[string]string, len(src.ByIdem)),
		Mailbox:       make(map[string]MailboxState, len(src.Mailbox)),
		MailboxIndex:  make(map[string][]string, len(src.MailboxIndex)),
	}
	for k, v := range src.Messages {
		dst.Messages[k] = v
	}
	for k, v := range src.ByIdem {
		dst.ByIdem[k] = v
	}
	for k, v := range src.Mailbox {
		dst.Mailbox[k] = v
	}
	for k, v := range src.MailboxIndex {
		dst.MailboxIndex[k] = append([]string(nil), v...)
	}
	return dst
}

func mailboxIndexKey(owner string, folder MailboxFolder) string {
	return owner + "\x00" + string(folder)
}

func rebuildMailboxIndex(data *storeData) {
	data.MailboxIndex = map[string][]string{}
	for key, state := range data.Mailbox {
		if state.DeletedAt != nil {
			continue
		}
		idx := mailboxIndexKey(state.Owner, state.Folder)
		data.MailboxIndex[idx] = append(data.MailboxIndex[idx], key)
	}
	for idx := range data.MailboxIndex {
		sort.Strings(data.MailboxIndex[idx])
	}
}

func validateStoreData(data *storeData) error {
	if data.SchemaVersion != DurableStoreSchemaVersion {
		return fmt.Errorf("schema version %d", data.SchemaVersion)
	}
	for idem, id := range data.ByIdem {
		msg, ok := data.Messages[id]
		if !ok {
			return fmt.Errorf("idempotency %q points to missing message %q", idem, id)
		}
		if msg.Fingerprint == "" || msg.IdempotencyKey == "" {
			return fmt.Errorf("message %q missing durable idempotency evidence", id)
		}
	}
	for key, state := range data.Mailbox {
		msg, ok := data.Messages[state.MessageID]
		if !ok {
			return fmt.Errorf("mailbox %q points to missing message %q", key, state.MessageID)
		}
		if key != mailboxKey(state.Owner, state.MessageID) {
			return fmt.Errorf("mailbox key mismatch for %q", key)
		}
		if state.Owner != msg.Sender && state.Owner != msg.Recipient {
			return fmt.Errorf("mailbox owner %q is not a message participant", state.Owner)
		}
		if !isMailboxFolder(state.Folder) {
			return fmt.Errorf("mailbox %q has invalid folder %q", key, state.Folder)
		}
	}
	return nil
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}
