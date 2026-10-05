package mail

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"testing"
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

type testBlobs struct{ data map[string][]byte }

func (b *testBlobs) PutPrivate(_ context.Context, owner string, body []byte) (string, string, error) {
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
	v, ok := b.data[ref]
	if !ok {
		return nil, errors.New("missing blob")
	}
	return append([]byte(nil), v...), nil
}

type testNotify struct{ count int }

func (n *testNotify) NotifyMail(_ context.Context, _ Notification) error {
	n.count++
	return nil
}

func testService() (*Service, *testNotify) {
	n := &testNotify{}
	s := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, &testBlobs{}, n)
	s.Now = func() time.Time { return time.Unix(1700000000, 0).UTC() }
	return s, n
}

func TestSendInboxReadAndIdempotency(t *testing.T) {
	s, n := testService()
	ctx := context.Background()
	req := SendRequest{IdempotencyKey: "k1", Sender: "alice.420", Recipient: "bob.420", Subject: "hello", Body: "private body", Source: "420/service/reefer-review/v1"}
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
	if n.count != 1 {
		t.Fatalf("notification count=%d", n.count)
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
	req := SendRequest{IdempotencyKey: "k1", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "y", Source: "test"}
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
	req := SendRequest{IdempotencyKey: "same", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "one", Source: "test"}
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
	req := SendRequest{IdempotencyKey: "k", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "body", Source: "test"}
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
	req := SendRequest{IdempotencyKey: "big", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: string(big), Source: "test"}
	if _, err := s.Send(ctx, "alice.420", req); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("oversize accepted: %v", err)
	}
	for i := 0; i < 3; i++ {
		r := SendRequest{IdempotencyKey: fmt.Sprintf("%d", i), Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "b", Source: "test"}
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
