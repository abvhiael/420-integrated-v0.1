package mail

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
)

func TestOutboxQueueDeliveryLifecycle(t *testing.T) {
	s, n := testService()
	ctx := context.Background()
	req := SendRequest{IdempotencyKey: "queue-1", Sender: "alice.420", Recipient: "bob.420", Subject: "queued", Body: "private queued body", Source: ServiceID}

	queued, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	if queued.Status != DeliveryQueued || queued.Attempts != 0 {
		t.Fatalf("unexpected queued state: %+v", queued)
	}
	state, err := s.GetMailboxState(ctx, "alice.420", queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if state.Folder != FolderOutbox {
		t.Fatalf("queued message folder=%s", state.Folder)
	}
	items, err := s.ListOutbox(ctx, "alice.420")
	if err != nil || len(items) != 1 || items[0].ID != queued.ID {
		t.Fatalf("unexpected outbox: %+v err=%v", items, err)
	}

	delivered, err := s.ProcessDelivery(ctx, "alice.420", queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if delivered.Status != DeliveryDelivered || delivered.Attempts != 1 || delivered.DeliveredAt == nil {
		t.Fatalf("unexpected delivered state: %+v", delivered)
	}
	sender, err := s.GetMailboxState(ctx, "alice.420", queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if sender.Folder != FolderSent {
		t.Fatalf("sender folder=%s", sender.Folder)
	}
	inbox, err := s.Inbox(ctx, "bob.420", "", 10)
	if err != nil || len(inbox.Items) != 1 || inbox.Items[0].ID != queued.ID {
		t.Fatalf("recipient delivery missing: %+v err=%v", inbox, err)
	}
	if n.Count() != 1 {
		t.Fatalf("notification count=%d", n.Count())
	}
}

func TestOutboxRetryFailureAndCancel(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	req := SendRequest{IdempotencyKey: "retry-1", Sender: "alice.420", Recipient: "bob.420", Subject: "retry", Body: "body", Source: ServiceID}
	queued, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	s.Messenger = testPolicy{blocked: true}

	for attempt := 1; attempt <= MaxDeliveryAttempts; attempt++ {
		current, err := s.ProcessDelivery(ctx, "alice.420", queued.ID)
		if err == nil {
			t.Fatal("blocked delivery unexpectedly succeeded")
		}
		if attempt < MaxDeliveryAttempts && current.Status != DeliveryRetrying {
			t.Fatalf("attempt %d status=%s", attempt, current.Status)
		}
		if attempt == MaxDeliveryAttempts && current.Status != DeliveryFailed {
			t.Fatalf("terminal status=%s", current.Status)
		}
	}
	if _, err := s.RetryDelivery(ctx, "alice.420", queued.ID); !errors.Is(err, ErrDeliveryConflict) {
		t.Fatalf("exhausted delivery retry accepted: %v", err)
	}

	req.IdempotencyKey = "cancel-1"
	cancelledJob, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	cancelled, err := s.CancelDelivery(ctx, "alice.420", cancelledJob.ID)
	if err != nil {
		t.Fatal(err)
	}
	if cancelled.Status != DeliveryCancelled || cancelled.CancelledAt == nil {
		t.Fatalf("cancel evidence missing: %+v", cancelled)
	}
	if _, err := s.ProcessDelivery(ctx, "alice.420", cancelledJob.ID); !errors.Is(err, ErrDeliveryConflict) {
		t.Fatalf("cancelled delivery processed: %v", err)
	}
}

func TestOutboxOwnerIsolationAndIdempotency(t *testing.T) {
	s, _ := testService()
	ctx := context.Background()
	req := SendRequest{IdempotencyKey: "idem", Sender: "alice.420", Recipient: "bob.420", Subject: "x", Body: "body", Source: ServiceID}
	first, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}
	second, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil || second.ID != first.ID {
		t.Fatalf("queue replay mismatch: %+v err=%v", second, err)
	}
	req.Body = "changed"
	if _, err := s.QueueDelivery(ctx, "alice.420", req); !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("conflicting replay accepted: %v", err)
	}
	if _, err := s.GetDelivery(ctx, "bob.420", first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign delivery visible: %v", err)
	}
	if _, err := s.CancelDelivery(ctx, "bob.420", first.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("foreign cancellation accepted: %v", err)
	}
}

func TestOutboxDurableRestart(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "mail.json")
	blobs := &testBlobs{}
	store, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, blobs, &testNotify{}, store)
	req := SendRequest{IdempotencyKey: "durable-queue", Sender: "alice.420", Recipient: "bob.420", Subject: "restart", Body: "secret queue body", Source: ServiceID}
	queued, err := s.QueueDelivery(ctx, "alice.420", req)
	if err != nil {
		t.Fatal(err)
	}

	reopened, err := OpenDurableStore(path)
	if err != nil {
		t.Fatal(err)
	}
	s2 := NewService(testIDs{"alice.420": true, "bob.420": true}, testPolicy{}, blobs, &testNotify{}, reopened)
	got, err := s2.GetDelivery(ctx, "alice.420", queued.ID)
	if err != nil {
		t.Fatal(err)
	}
	if got.Status != DeliveryQueued || got.StagingBodyRef == "" {
		t.Fatalf("durable queue lost state: %+v", got)
	}
}
