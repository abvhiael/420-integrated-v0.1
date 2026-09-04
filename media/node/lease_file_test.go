package node

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func leaseJob(v byte) [32]byte {
	var id [32]byte
	id[31] = v
	return id
}

func TestFileLeaseSurvivesProcessRestart(t *testing.T) {
	path := filepath.Join(t.TempDir(), "leases.json")
	store1, err := NewFileLeaseStore(path, "node-a", time.Minute)
	if err != nil { t.Fatal(err) }
	lease, ok, err := store1.Acquire(context.Background(), leaseJob(1))
	if err != nil || !ok { t.Fatalf("acquire ok=%v err=%v", ok, err) }
	_ = lease // simulate crash: no Release

	store2, err := NewFileLeaseStore(path, "node-b", time.Minute)
	if err != nil { t.Fatal(err) }
	_, ok, err = store2.Acquire(context.Background(), leaseJob(1))
	if err != nil { t.Fatal(err) }
	if ok { t.Fatal("second process acquired unexpired persisted lease") }
}

func TestExpiredFileLeaseCanBeRecovered(t *testing.T) {
	path := filepath.Join(t.TempDir(), "leases.json")
	base := time.Unix(100, 0)
	store1, _ := NewFileLeaseStore(path, "node-a", time.Second)
	store1.now = func() time.Time { return base }
	_, ok, err := store1.Acquire(context.Background(), leaseJob(2))
	if err != nil || !ok { t.Fatalf("acquire ok=%v err=%v", ok, err) }

	store2, _ := NewFileLeaseStore(path, "node-b", time.Second)
	store2.now = func() time.Time { return base.Add(2 * time.Second) }
	lease, ok, err := store2.Acquire(context.Background(), leaseJob(2))
	if err != nil || !ok { t.Fatalf("recovery ok=%v err=%v", ok, err) }
	if err := lease.Renew(context.Background()); err != nil { t.Fatal(err) }
}

func TestOldOwnerCannotRenewAfterTakeover(t *testing.T) {
	path := filepath.Join(t.TempDir(), "leases.json")
	base := time.Unix(200, 0)
	store1, _ := NewFileLeaseStore(path, "node-a", time.Second)
	store1.now = func() time.Time { return base }
	oldLease, ok, err := store1.Acquire(context.Background(), leaseJob(3))
	if err != nil || !ok { t.Fatalf("acquire ok=%v err=%v", ok, err) }

	store2, _ := NewFileLeaseStore(path, "node-b", time.Second)
	store2.now = func() time.Time { return base.Add(2 * time.Second) }
	_, ok, err = store2.Acquire(context.Background(), leaseJob(3))
	if err != nil || !ok { t.Fatalf("takeover ok=%v err=%v", ok, err) }

	store1.now = func() time.Time { return base.Add(2 * time.Second) }
	if err := oldLease.Renew(context.Background()); !errors.Is(err, ErrLeaseLost) {
		t.Fatalf("old owner renew err=%v", err)
	}
}

func TestCorruptLeaseStateFailsClosed(t *testing.T) {
	path := filepath.Join(t.TempDir(), "leases.json")
	if err := os.WriteFile(path, []byte("not-json"), 0o600); err != nil { t.Fatal(err) }
	store, err := NewFileLeaseStore(path, "node-a", time.Minute)
	if err != nil { t.Fatal(err) }
	_, ok, err := store.Acquire(context.Background(), leaseJob(4))
	if err == nil || ok { t.Fatalf("expected corrupt state failure ok=%v err=%v", ok, err) }
}

func TestReleaseDoesNotDeleteNewOwnerLease(t *testing.T) {
	path := filepath.Join(t.TempDir(), "leases.json")
	base := time.Unix(300, 0)
	store1, _ := NewFileLeaseStore(path, "node-a", time.Second)
	store1.now = func() time.Time { return base }
	oldLease, ok, err := store1.Acquire(context.Background(), leaseJob(5))
	if err != nil || !ok { t.Fatalf("acquire ok=%v err=%v", ok, err) }

	store2, _ := NewFileLeaseStore(path, "node-b", time.Minute)
	store2.now = func() time.Time { return base.Add(2 * time.Second) }
	_, ok, err = store2.Acquire(context.Background(), leaseJob(5))
	if err != nil || !ok { t.Fatalf("takeover ok=%v err=%v", ok, err) }

	if err := oldLease.Release(); err != nil { t.Fatal(err) }
	_, ok, err = store1.Acquire(context.Background(), leaseJob(5))
	if err != nil { t.Fatal(err) }
	if ok { t.Fatal("stale release deleted current owner lease") }
}
