package delivery

import (
	"testing"
	"time"
)

func testQueue(t *testing.T) *Queue {
	t.Helper()
	q, err := NewQueue(Policy{MaxAttempts: 3, BaseBackoff: time.Second, MaxBackoff: 4 * time.Second})
	if err != nil { t.Fatal(err) }
	return q
}

func TestDeterministicEnqueueDeduplicates(t *testing.T) {
	q := testQueue(t)
	now := time.Unix(100, 0)
	req := EnqueueRequest{SubscriptionID: " Sub-A ", EventID: "EVT-1", Provider: "Push", Destination: "device-1", Severity: SeverityWarning}
	first, created, err := q.Enqueue(req, now)
	if err != nil || !created { t.Fatalf("first enqueue: created=%v err=%v", created, err) }
	second, created, err := q.Enqueue(req, now.Add(time.Second))
	if err != nil || created { t.Fatalf("duplicate enqueue: created=%v err=%v", created, err) }
	if first.Key != second.Key { t.Fatalf("dedup keys differ: %q != %q", first.Key, second.Key) }
}

func TestDueOrdersSeverityThenPriority(t *testing.T) {
	q := testQueue(t)
	now := time.Unix(200, 0)
	items := []EnqueueRequest{
		{SubscriptionID:"a", EventID:"1", Provider:"push", Destination:"x", Severity:SeverityInfo, Priority:99},
		{SubscriptionID:"b", EventID:"2", Provider:"push", Destination:"y", Severity:SeverityCritical, Priority:1},
		{SubscriptionID:"c", EventID:"3", Provider:"push", Destination:"z", Severity:SeverityWarning, Priority:50},
	}
	for _, req := range items { if _,_,err := q.Enqueue(req, now); err != nil { t.Fatal(err) } }
	due := q.Due(now, 10)
	if len(due) != 3 { t.Fatalf("expected 3 due, got %d", len(due)) }
	if due[0].Severity != SeverityCritical || due[1].Severity != SeverityWarning || due[2].Severity != SeverityInfo {
		t.Fatalf("unexpected severity order: %+v", due)
	}
}

func TestRetryBackoffAndDeadLetter(t *testing.T) {
	q := testQueue(t)
	now := time.Unix(300, 0)
	rec, _, err := q.Enqueue(EnqueueRequest{SubscriptionID:"a", EventID:"1", Provider:"push", Destination:"x", Severity:SeverityInfo}, now)
	if err != nil { t.Fatal(err) }

	r1, err := q.MarkFailed(rec.Key, "temporary", now)
	if err != nil { t.Fatal(err) }
	if r1.Status != StatusRetry || !r1.NextAttempt.Equal(now.Add(time.Second)) { t.Fatalf("bad retry1: %+v", r1) }

	r2, err := q.MarkFailed(rec.Key, "temporary", now.Add(time.Second))
	if err != nil { t.Fatal(err) }
	if r2.Status != StatusRetry || !r2.NextAttempt.Equal(now.Add(3*time.Second)) { t.Fatalf("bad retry2: %+v", r2) }

	r3, err := q.MarkFailed(rec.Key, "still bad", now.Add(3*time.Second))
	if err != nil { t.Fatal(err) }
	if r3.Status != StatusDead || !r3.NextAttempt.IsZero() { t.Fatalf("expected dead letter: %+v", r3) }
}

func TestFailureIsolationAcrossDestinations(t *testing.T) {
	q := testQueue(t)
	now := time.Unix(400, 0)
	a,_,_ := q.Enqueue(EnqueueRequest{SubscriptionID:"a", EventID:"evt", Provider:"push", Destination:"device-a", Severity:SeverityWarning}, now)
	b,_,_ := q.Enqueue(EnqueueRequest{SubscriptionID:"a", EventID:"evt", Provider:"push", Destination:"device-b", Severity:SeverityWarning}, now)
	if _, err := q.MarkFailed(a.Key, "provider down", now); err != nil { t.Fatal(err) }
	if err := q.MarkDelivered(b.Key, now); err != nil { t.Fatal(err) }
	ar,_ := q.Get(a.Key); br,_ := q.Get(b.Key)
	if ar.Status != StatusRetry { t.Fatalf("expected a retry, got %s", ar.Status) }
	if br.Status != StatusDelivered { t.Fatalf("expected b delivered, got %s", br.Status) }
}

func TestPayloadIsDefensivelyCloned(t *testing.T) {
	q := testQueue(t)
	now := time.Unix(500,0)
	payload := []byte("abc")
	rec,_,err := q.Enqueue(EnqueueRequest{SubscriptionID:"a", EventID:"1", Provider:"push", Destination:"x", Severity:SeverityInfo, Payload:payload}, now)
	if err != nil { t.Fatal(err) }
	payload[0] = 'z'
	stored,_ := q.Get(rec.Key)
	if string(stored.Payload) != "abc" { t.Fatalf("payload mutated: %q", stored.Payload) }
}
