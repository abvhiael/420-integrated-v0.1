package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"sync"
	"testing"
	"path/filepath"
	"strings"
	"time"
)

type testIDs map[string]bool

func (m testIDs) ResolveIdentity(_ context.Context, id string) error {
	if !m[id] {
		return errors.New("unknown identity")
	}
	return nil
}

type testPolicy struct{ blocked bool }

func (p testPolicy) CanMessage(_ context.Context, _, _ string) error {
	if p.blocked {
		return errors.New("blocked")
	}
	return nil
}

type testBlobs struct {
	mu   sync.Mutex
	data map[string][]byte
}

func (b *testBlobs) PutPrivate(_ context.Context, owner string, body []byte) (string, string, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.data == nil {
		b.data = map[string][]byte{}
	}
	sum := sha256.Sum256(body)
	d := hex.EncodeToString(sum[:])
	ref := fmt.Sprintf("private:%s:%s", owner, d[:16])
	b.data[ref] = append([]byte(nil), body...)
	return ref, d, nil
}

func (b *testBlobs) GetPrivate(_ context.Context, _ string, ref string) ([]byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	v, ok := b.data[ref]
	if !ok {
		return nil, errors.New("missing blob")
	}
	return append([]byte(nil), v...), nil
}

func (b *testBlobs) DeletePrivate(_ context.Context, _ string, ref string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.data[ref]; !ok {
		return errors.New("missing blob")
	}
	delete(b.data, ref)
	return nil
}

type testNotify struct {
	mu    sync.Mutex
	count int
}

func (n *testNotify) NotifyMail(_ context.Context, _ Notification) error {
	n.mu.Lock()
	n.count++
	n.mu.Unlock()
	return nil
}

func (n *testNotify) Count() int {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.count
}

func testService() (*Service, *testNotify) {
	n := &testNotify{}
	s := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, &testBlobs{}, n, NewMemoryStore())
	s.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	return s, n
}

func TestSendInboxReadAndIdempotency(t *testing.T) {
	s, n := testService()
	ctx := context.Background()
	req := SendRequest{IdempotencyKey: "k1", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "private body", Source: ServiceID}
	first, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID {
		t.Fatal("idempotent send created second message")
	}
	if n.Count() != 1 {
		t.Fatalf("notification count=%d", n.Count())
	}
	page, err := s.Inbox(ctx, "bob.420", "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Items) != 1 || page.Items[0].ID != first.ID {
		t.Fatalf("unexpected inbox: %+v", page)
	}
	body, msg, err := s.ReadBody(ctx, "bob.420", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if string(body) != "private body" || msg.BodyRef == "" || msg.BodyDigest == "" {
		t.Fatal("private body evidence missing")
	}
	read, err := s.MarkRead(ctx, "bob.420", first.ID)
	if err != nil {
		t.Fatal(err)
	}
	if read.ReadAt == nil {
		t.Fatal("read receipt missing")
	}
}

func TestAuthorizationAndPolicyFailures(t *testing.T) {
	ctx := context.Background()
	s, _ := testService()
	req := SendRequest{IdempotencyKey: "k1", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "y", Source: ServiceID}
	if _, err := s.Send(ctx, "mallory.420", req); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("want unauthorized, got %v", err)
	}
	s.Messenger = testPolicy{blocked: true}
	if _, err := s.Send(ctx, "alice.420", req); err == nil {
		t.Fatal("blocked sender unexpectedly sent")
	}
}

func TestIdempotencyConflict(t *testing.T) {
	ctx := context.Background()
	s, _ := testService()
	req := SendRequest{IdempotencyKey: "same", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "one", Source: ServiceID}
	if _, err := s.Send(ctx, "alice.420", req); err != nil {
		t.Fatal(err)
	}
	req.Body = "two"
	if _, err := s.Send(ctx, "alice.420", req); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("want conflict, got %v", err)
	}
}

func TestSenderCannotMarkReadOrForeignRead(t *testing.T) {
	ctx := context.Background()
	s, _ := testService()
	req := SendRequest{IdempotencyKey: "k", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "body", Source: ServiceID}
	msg, err := s.Send(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.MarkRead(ctx, "alice.420", msg.ID); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("sender marked read: %v", err)
	}
	if _, _, err := s.ReadBody(ctx, "mallory.420", msg.ID); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("foreign read: %v", err)
	}
}

func TestBoundsAndCursor(t *testing.T) {
	ctx := context.Background()
	s, _ := testService()
	big := make([]byte, MaxBodyBytes+1)
	req := SendRequest{IdempotencyKey: "big", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: string(big), Source: ServiceID}
	if _, err := s.Send(ctx, "alice.420", req); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("oversize accepted: %v", err)
	}
	for i := 0; i < 3; i++ {
		r := SendRequest{IdempotencyKey: fmt.Sprintf("%d", i), Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "b", Source: ServiceID}
		if _, err := s.Send(ctx, "alice.420", r); err != nil {
			t.Fatal(err)
		}
	}
	p1, err := s.Inbox(ctx, "bob.420", "", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(p1.Items) != 2 || p1.NextCursor == "" {
		t.Fatal("pagination missing")
	}
	p2, err := s.Inbox(ctx, "bob.420", p1.NextCursor, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(p2.Items) != 1 {
		t.Fatalf("second page len=%d", len(p2.Items))
	}
}

func TestRejectsSpoofedSource(t *testing.T) {
	ctx := context.Background()
	s, _ := testService()
	req := SendRequest{IdempotencyKey: "source", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "body", Source: "420/service/reefer-review/v1"}
	if _, err := s.Send(ctx, "alice.420", req); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("spoofed source accepted: %v", err)
	}
}

func TestMailboxInitialStates(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "states", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	sender, err := s.GetMailboxState(ctx, "alice.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if sender.Folder != FolderSent || sender.ReadAt == nil {
		t.Fatalf("unexpected sender mailbox state: %+v", sender)
	}
	recipient, err := s.GetMailboxState(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if recipient.Folder != FolderInbox || recipient.ReadAt != nil {
		t.Fatalf("unexpected recipient mailbox state: %+v", recipient)
	}
}

func TestRecipientMailboxLifecycle(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "lifecycle", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	archive := FolderArchive
	state, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &archive})
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive || state.PreviousFolder != FolderInbox || state.ArchivedAt == nil {
		t.Fatalf("archive transition missing evidence: %+v", state)
	}
	inbox, err := s.Inbox(ctx, "bob.420", "", 10)
	if err != nil {
		t.Fatal(err)
	}
	if len(inbox.Items) != 0 {
		t.Fatalf("archived message remained in inbox: %+v", inbox.Items)
	}
	junk := FolderJunk
	state, err = s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &junk})
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk || state.JunkedAt == nil {
		t.Fatalf("junk transition missing evidence: %+v", state)
	}
	trash := FolderTrash
	state, err = s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &trash})
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderTrash || state.PreviousFolder != FolderJunk || state.TrashedAt == nil {
		t.Fatalf("trash transition missing evidence: %+v", state)
	}
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &archive}); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("trash bypass should fail, got %v", err)
	}
	state, err = s.RestoreFromTrash(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderJunk {
		t.Fatalf("restore did not return to prior folder: %+v", state)
	}
}

func TestSenderMailboxLifecycleIsRestricted(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "sender-life", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	inbox := FolderInbox
	if _, err := s.UpdateMailbox(ctx, "alice.420", msg.ID, MailboxUpdate{Folder: &inbox}); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("sender moved sent mail into inbox: %v", err)
	}
	junk := FolderJunk
	if _, err := s.UpdateMailbox(ctx, "alice.420", msg.ID, MailboxUpdate{Folder: &junk}); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("sender moved sent mail into junk: %v", err)
	}
	archive := FolderArchive
	if _, err := s.UpdateMailbox(ctx, "alice.420", msg.ID, MailboxUpdate{Folder: &archive}); err != nil {
		t.Fatal(err)
	}
	trash := FolderTrash
	if _, err := s.UpdateMailbox(ctx, "alice.420", msg.ID, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	state, err := s.RestoreFromTrash(ctx, "alice.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderArchive {
		t.Fatalf("sender restore did not return to archive: %+v", state)
	}
}

func TestDraftsAndOutboxAreReservedForLaterLifecycleSteps(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "reserved", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	for _, folder := range []MailboxFolder{FolderDrafts, FolderOutbox} {
		f := folder
		if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &f}); !errors.Is(err, ErrInvalidTransition) {
			t.Fatalf("recipient moved delivered mail to reserved %s: %v", folder, err)
		}
		if _, err := s.UpdateMailbox(ctx, "alice.420", msg.ID, MailboxUpdate{Folder: &f}); !errors.Is(err, ErrInvalidTransition) {
			t.Fatalf("sender moved delivered mail to reserved %s: %v", folder, err)
		}
	}
	for _, folder := range []MailboxFolder{FolderDrafts, FolderOutbox} {
		page, err := s.Mailbox(ctx, "alice.420", folder, "", 10)
		if err != nil {
			t.Fatal(err)
		}
		if len(page.Items) != 0 {
			t.Fatalf("reserved %s unexpectedly populated: %+v", folder, page.Items)
		}
	}
}

func TestMailboxFlagsAndUnreadPreserveDeliveryReceipt(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "flags", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	yes := true
	state, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Read: &yes, Starred: &yes, Pinned: &yes, Muted: &yes})
	if err != nil {
		t.Fatal(err)
	}
	if state.ReadAt == nil || !state.Starred || !state.Pinned || !state.Muted {
		t.Fatalf("mailbox flags not applied: %+v", state)
	}
	var firstReceipt *time.Time
	if err := s.Store.View(ctx, func(data *storeData) error {
		firstReceipt = data.Messages[msg.ID].ReadAt
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if firstReceipt == nil {
		t.Fatal("recipient read did not establish message read receipt")
	}
	state, err = s.MarkUnread(ctx, "bob.420", msg.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.ReadAt != nil {
		t.Fatalf("mailbox unread failed: %+v", state)
	}
	var receiptAfterUnread *time.Time
	if err := s.Store.View(ctx, func(data *storeData) error {
		receiptAfterUnread = data.Messages[msg.ID].ReadAt
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if receiptAfterUnread == nil || !receiptAfterUnread.Equal(*firstReceipt) {
		t.Fatal("marking mailbox unread erased immutable first-read receipt")
	}
	if _, err := s.MarkUnread(ctx, "alice.420", msg.ID); !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("sender changed recipient read state: %v", err)
	}
}

func TestPermanentDeleteIsTrashOnlyAndOwnerScoped(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "delete", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if err := s.PermanentlyDelete(ctx, "bob.420", msg.ID); !errors.Is(err, ErrInvalidTransition) {
		t.Fatalf("permanent delete outside trash should fail: %v", err)
	}
	trash := FolderTrash
	if _, err := s.UpdateMailbox(ctx, "bob.420", msg.ID, MailboxUpdate{Folder: &trash}); err != nil {
		t.Fatal(err)
	}
	if err := s.PermanentlyDelete(ctx, "bob.420", msg.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetMailboxState(ctx, "bob.420", msg.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted mailbox state remained visible: %v", err)
	}
	if _, _, err := s.ReadBody(ctx, "bob.420", msg.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("deleted recipient retained body access: %v", err)
	}
	if _, _, err := s.ReadBody(ctx, "alice.420", msg.ID); err != nil {
		t.Fatalf("recipient deletion affected sender copy: %v", err)
	}
}

func TestForeignPrincipalCannotObserveOrMutateMailboxState(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "foreign-state", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.GetMailboxState(ctx, "mallory.420", msg.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign principal observed mailbox state: %v", err)
	}
	archive := FolderArchive
	if _, err := s.UpdateMailbox(ctx, "mallory.420", msg.ID, MailboxUpdate{Folder: &archive}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign principal mutated mailbox state: %v", err)
	}
}

func TestMailboxFolderPagination(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	for i := 0; i < 3; i++ {
		_, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: fmt.Sprintf("mailbox-%d", i), Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "body", Source: ServiceID})
		if err != nil {
			t.Fatal(err)
		}
	}
	p1, err := s.Mailbox(ctx, "bob.420", FolderInbox, "", 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(p1.Items) != 2 || p1.NextCursor == "" {
		t.Fatalf("mailbox first page invalid: %+v", p1)
	}
	p2, err := s.Mailbox(ctx, "bob.420", FolderInbox, p1.NextCursor, 2)
	if err != nil {
		t.Fatal(err)
	}
	if len(p2.Items) != 1 || p2.NextCursor != "" {
		t.Fatalf("mailbox second page invalid: %+v", p2)
	}
}

type insecureBlobStore struct{ testBlobs }

func (b *insecureBlobStore) PrivateBlobSecurity() PrivateBlobSecurityProfile {
	return PrivateBlobSecurityProfile{EncryptedAtRest: false, ExternalKeyCustody: true, OwnerScopedAccess: true}
}

type secureBlobStore struct{ testBlobs }

func (b *secureBlobStore) PrivateBlobSecurity() PrivateBlobSecurityProfile {
	return PrivateBlobSecurityProfile{EncryptedAtRest: true, ExternalKeyCustody: true, OwnerScopedAccess: true}
}

type corruptDigestBlobStore struct{ testBlobs }

func (b *corruptDigestBlobStore) PutPrivate(ctx context.Context, owner string, body []byte) (string, string, error) {
	ref, _, err := b.testBlobs.PutPrivate(ctx, owner, body)
	return ref, strings.Repeat("0", 64), err
}

func TestDurableServiceRequiresPrivateBlobSecurityProfile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "mail.json")
	if _, err := NewDurableService(testIDs{"alice.420": true}, testPolicy{}, &testBlobs{}, &testNotify{}, path); !errors.Is(err, ErrPrivateBlobSecurity) {
		t.Fatalf("durable service accepted blob store without security profile: %v", err)
	}
	if _, err := NewDurableService(testIDs{"alice.420": true}, testPolicy{}, &insecureBlobStore{}, &testNotify{}, path); !errors.Is(err, ErrPrivateBlobSecurity) {
		t.Fatalf("durable service accepted insecure blob profile: %v", err)
	}
	if _, err := NewDurableService(testIDs{"alice.420": true}, testPolicy{}, &secureBlobStore{}, &testNotify{}, path); err != nil {
		t.Fatalf("durable service rejected secure blob profile: %v", err)
	}
}

func TestPrivateBlobDigestIsVerifiedOnWriteAndRead(t *testing.T) {
	ctx := context.Background()
	s := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, &corruptDigestBlobStore{}, &testNotify{}, NewMemoryStore())
	if _, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "digest-write", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "private body", Source: ServiceID}); !errors.Is(err, ErrPrivateBlobIntegrity) {
		t.Fatalf("corrupt storage digest accepted: %v", err)
	}

	blobs := &testBlobs{}
	s = NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, blobs, &testNotify{}, NewMemoryStore())
	msg, err := s.Send(ctx, "alice.420", SendRequest{IdempotencyKey: "digest-read", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "private body", Source: ServiceID})
	if err != nil {
		t.Fatal(err)
	}
	blobs.mu.Lock()
	blobs.data[msg.BodyRef] = []byte("tampered body")
	blobs.mu.Unlock()
	if _, _, err := s.ReadBody(ctx, "bob.420", msg.ID); !errors.Is(err, ErrPrivateBlobIntegrity) {
		t.Fatalf("tampered private blob accepted: %v", err)
	}
}
