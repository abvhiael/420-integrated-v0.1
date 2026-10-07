package reeferreview

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"sync"
	"testing"
	"time"

	mail420 "github.com/420integrated/420-integrated/mail"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

func rr6PublicPublication(id string) Publication {
	return Publication{
		ID:                id,
		Namespace:         ServiceID,
		Version:           "v2",
		Author:            "writer.420",
		Title:             "Public article",
		Summary:           "A public Reefer Review article",
		BodyRef:           "storage420:opaque",
		BodyDigest:        strings.Repeat("a", 64),
		RightsClaim:       "right-1",
		Visibility:        VisibilityPublic,
		Status:            StatusPublished,
		Source:            "USER_AUTHORED",
		CurrentRevisionID: "rev-1",
		Revision:          1,
		CreatedAt:         time.Date(2026, 10, 7, 12, 0, 0, 0, time.UTC),
		UpdatedAt:         time.Date(2026, 10, 7, 12, 1, 0, 0, time.UTC),
		RightsProvenance: &RightsProvenance{
			ServiceID:      RightsServiceID,
			SubjectID:      "subject-1",
			RightID:        "right-1",
			ClaimID:        "claim-1",
			HolderWallet:   "0x1111111111111111111111111111111111111111",
			EvidenceHash:   "evidence-1",
			ProvenanceHash: "provenance-1",
			BodyDigest:     strings.Repeat("a", 64),
			ChainID:        420,
			Network:        "testnet",
			RegistryRef:    "rights-registry",
			RouterRef:      "rights-router",
			BlockNumber:    42,
			BlockHash:      "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			VerifiedAt:     time.Date(2026, 10, 7, 12, 0, 30, 0, time.UTC),
		},
	}
}

type rr6SearchWriter struct {
	mu      sync.Mutex
	results map[string]searchresult.Result
	fail    bool
}

func newRR6SearchWriter() *rr6SearchWriter {
	return &rr6SearchWriter{results: map[string]searchresult.Result{}}
}

func (w *rr6SearchWriter) UpsertSearchResult(_ context.Context, r searchresult.Result) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.fail {
		return errors.New("search unavailable")
	}
	w.results[r.ID] = r
	return nil
}

func (w *rr6SearchWriter) DeleteSearchResult(_ context.Context, id string) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.fail {
		return errors.New("search unavailable")
	}
	delete(w.results, id)
	return nil
}

func (w *rr6SearchWriter) ListSearchResults(context.Context) ([]searchresult.Result, error) {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.fail {
		return nil, errors.New("search unavailable")
	}
	out := make([]searchresult.Result, 0, len(w.results))
	for _, r := range w.results {
		out = append(out, r)
	}
	return out, nil
}

func TestRR6SearchAdapterPublicOnlyAndRebuildable(t *testing.T) {
	ctx := context.Background()
	writer := newRR6SearchWriter()
	adapter := Search420Adapter{
		Writer: writer, ArticleBaseURL: "https://reefer.example",
		Now: func() time.Time { return time.Date(2026, 10, 7, 12, 2, 0, 0, time.UTC) },
	}
	p := rr6PublicPublication("pub-current")
	if err := adapter.Upsert(ctx, p); err != nil {
		t.Fatal(err)
	}
	rows, _ := writer.ListSearchResults(ctx)
	if len(rows) != 1 || rows[0].Presentation.Category != ReeferSearchCategory ||
		rows[0].Provenance.Source != "420Rights:public" ||
		!strings.Contains(rows[0].Presentation.CanonicalURL, "/articles/pub-current") {
		t.Fatalf("unexpected Search projection: %+v", rows)
	}

	private := rr6PublicPublication("private")
	private.Visibility = VisibilityPrivate
	if err := adapter.Upsert(ctx, private); !errors.Is(err, ErrProjectionNotPublic) {
		t.Fatalf("private publication projected: %v", err)
	}

	stale := rr6PublicPublication("stale")
	if err := adapter.Upsert(ctx, stale); err != nil {
		t.Fatal(err)
	}
	store := NewMemory()
	if err := store.Put(ctx, p); err != nil {
		t.Fatal(err)
	}
	report, err := adapter.Reconcile(ctx, store)
	if err != nil {
		t.Fatal(err)
	}
	rows, _ = writer.ListSearchResults(ctx)
	if report.Desired != 1 || report.Upserts != 1 || report.Deletes != 1 || len(rows) != 1 {
		t.Fatalf("bad Search reconcile: report=%+v rows=%+v", report, rows)
	}
}

type rr6NotificationAuthority struct {
	req     NotificationPublishRequest
	receipt NotificationPublishReceipt
	err     error
	calls   int
}

func (a *rr6NotificationAuthority) PublishReeferReview(_ context.Context, req NotificationPublishRequest) (NotificationPublishReceipt, error) {
	a.calls++
	a.req = req
	if a.err != nil {
		return NotificationPublishReceipt{}, a.err
	}
	return a.receipt, nil
}

func TestRR6NotificationsAdapterPreservesProvenanceAndConsentSuppression(t *testing.T) {
	authority := &rr6NotificationAuthority{receipt: NotificationPublishReceipt{
		DeliveryID: "notification-1",
		AcceptedAt: time.Date(2026, 10, 7, 12, 3, 0, 0, time.UTC),
		Accepted:   true,
	}}
	adapter := Notifications420Adapter{Authority: authority, ArticleBaseURL: "https://reefer.example"}
	p := rr6PublicPublication("notify")
	if err := adapter.Published(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	if authority.calls != 1 || authority.req.SourceService != ServiceID ||
		authority.req.PublicationID != p.ID || authority.req.RightsClaim != p.RightsClaim ||
		authority.req.ChainID != p.RightsProvenance.ChainID ||
		authority.req.BlockHash != p.RightsProvenance.BlockHash ||
		authority.req.IdempotencyKey == "" {
		t.Fatalf("notification provenance drifted: %+v", authority.req)
	}
	typ := reflect.TypeOf(NotificationPublishRequest{})
	for _, forbidden := range []string{"Body", "BodyRef", "Session", "Token", "PrivateKey"} {
		if _, ok := typ.FieldByName(forbidden); ok {
			t.Fatalf("notification request leaks private field %s", forbidden)
		}
	}

	authority.receipt = NotificationPublishReceipt{Suppressed: true}
	if err := adapter.Published(context.Background(), p); err != nil {
		t.Fatalf("consent suppression should be a valid non-delivery result: %v", err)
	}
	authority.receipt = NotificationPublishReceipt{}
	if err := adapter.Published(context.Background(), p); !errors.Is(err, ErrNotificationReceipt) {
		t.Fatalf("invalid notification receipt accepted: %v", err)
	}
}

type rr6MailSender struct {
	reqs []mail420.SendRequest
	fail bool
}

func (s *rr6MailSender) Send(_ context.Context, req mail420.SendRequest) (mail420.Message, error) {
	s.reqs = append(s.reqs, req)
	if s.fail {
		return mail420.Message{}, errors.New("mail unavailable")
	}
	return mail420.Message{ID: "mail-" + req.IdempotencyKey, Source: req.Source}, nil
}

type rr6MailAudience struct {
	recipients []string
	err        error
}

func (a rr6MailAudience) Recipients(context.Context, Publication) ([]string, error) {
	return append([]string(nil), a.recipients...), a.err
}

func TestRR6MailAdapterUsesCanonicalMailSourceAndIdempotency(t *testing.T) {
	sender := &rr6MailSender{}
	adapter := Mail420Adapter{
		Sender: sender,
		Audience: rr6MailAudience{recipients: []string{
			"bob.420", " alice.420 ", "bob.420", "",
		}},
		FromIdentity:   "reefer-review.420",
		ArticleBaseURL: "https://reefer.example",
	}
	p := rr6PublicPublication("mail")
	if err := adapter.Published(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	if len(sender.reqs) != 2 {
		t.Fatalf("want two unique internal recipients, got %d", len(sender.reqs))
	}
	for _, req := range sender.reqs {
		if req.Source != mail420.ServiceID || req.Sender != "reefer-review.420" ||
			req.IdempotencyKey == "" || !strings.Contains(req.Body, "https://reefer.example/articles/mail") {
			t.Fatalf("invalid canonical Mail request: %+v", req)
		}
	}
	firstKeys := []string{sender.reqs[0].IdempotencyKey, sender.reqs[1].IdempotencyKey}
	sender.reqs = nil
	if err := adapter.Published(context.Background(), p); err != nil {
		t.Fatal(err)
	}
	secondKeys := []string{sender.reqs[0].IdempotencyKey, sender.reqs[1].IdempotencyKey}
	if !reflect.DeepEqual(firstKeys, secondKeys) {
		t.Fatalf("mail idempotency drifted: %v %v", firstKeys, secondKeys)
	}
}

type rr6ToggleSearch struct {
	fail    bool
	upserts int
	deletes int
}

func (s *rr6ToggleSearch) Upsert(context.Context, Publication) error {
	s.upserts++
	if s.fail {
		return errors.New("search down")
	}
	return nil
}

func (s *rr6ToggleSearch) Delete(context.Context, string) error {
	s.deletes++
	if s.fail {
		return errors.New("search down")
	}
	return nil
}

type rr6ToggleNotifications struct {
	fail  bool
	calls int
}

func (n *rr6ToggleNotifications) Published(context.Context, Publication) error {
	n.calls++
	if n.fail {
		return errors.New("notifications down")
	}
	return nil
}

type rr6ToggleMail struct {
	fail  bool
	calls int
}

func (m *rr6ToggleMail) Published(context.Context, Publication) error {
	m.calls++
	if m.fail {
		return errors.New("mail down")
	}
	return nil
}

func TestRR6DurableOutboxAndFailureReconciliation(t *testing.T) {
	ctx := context.Background()
	path := t.TempDir() + "/integrations.json"
	outbox, err := OpenIntegrationOutbox(path)
	if err != nil {
		t.Fatal(err)
	}
	search := &rr6ToggleSearch{fail: true}
	notifications := &rr6ToggleNotifications{fail: true}
	mail := &rr6ToggleMail{fail: true}

	s := testService()
	s.Search = QueuedSearch{Outbox: outbox, Delegate: search}
	s.Notifications = QueuedNotifications{Outbox: outbox, Delegate: notifications}
	s.Mail = QueuedMail{Outbox: outbox, Delegate: mail}
	draft, err := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr6-outage", Title: "Outage", Body: "body", Visibility: VisibilityPublic,
	})
	if err != nil {
		t.Fatal(err)
	}
	pub, warnings, err := s.Publish(ctx, "writer.420", draft.ID)
	if err != nil || pub.Status != StatusPublished || len(warnings) != 3 {
		t.Fatalf("dependency outage changed canonical publication: pub=%+v warnings=%v err=%v", pub, warnings, err)
	}
	pending, err := outbox.Pending(ctx)
	if err != nil || len(pending) != 3 {
		t.Fatalf("pending integration work not retained: %+v err=%v", pending, err)
	}
	reopened, err := OpenIntegrationOutbox(path)
	if err != nil {
		t.Fatal(err)
	}
	pending, err = reopened.Pending(ctx)
	if err != nil || len(pending) != 3 {
		t.Fatalf("integration outbox did not survive restart: %+v err=%v", pending, err)
	}

	search.fail = false
	notifications.fail = false
	mail.fail = false
	report, err := (IntegrationReconciler{
		Outbox: reopened, Search: search, Notifications: notifications, Mail: mail,
	}).ReconcileOnce(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if report.Attempted != 3 || report.Completed != 3 || report.Failed != 0 {
		t.Fatalf("bad reconciliation report: %+v", report)
	}
	pending, err = reopened.Pending(ctx)
	if err != nil || len(pending) != 0 {
		t.Fatalf("reconciled operations remained pending: %+v err=%v", pending, err)
	}
}

func TestRR6SearchDeleteFailureSurvivesIgnoredModerationProjectionError(t *testing.T) {
	ctx := context.Background()
	outbox, err := OpenIntegrationOutbox(t.TempDir() + "/integrations.json")
	if err != nil {
		t.Fatal(err)
	}
	search := &rr6ToggleSearch{}
	s := testService()
	s.Search = QueuedSearch{Outbox: outbox, Delegate: search}
	draft, _ := s.CreateDraft(ctx, "writer.420", CreateDraftRequest{
		IdempotencyKey: "rr6-hide", Title: "Hide", Body: "body", Visibility: VisibilityPublic,
	})
	pub, _, _ := s.Publish(ctx, "writer.420", draft.ID)
	search.fail = true
	if _, _, err := s.Moderate(ctx, "moderator.420", pub.ID, "HIDE", "policy"); err != nil {
		t.Fatal(err)
	}
	pending, err := outbox.Pending(ctx)
	if err != nil || len(pending) != 1 || pending[0].Kind != IntegrationSearchDelete {
		t.Fatalf("ignored Search delete failure was not recoverable: %+v err=%v", pending, err)
	}
}
