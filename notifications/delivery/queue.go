package delivery

import (
	"errors"
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"
)

type Status string

const (
	StatusPending   Status = "pending"
	StatusRetry     Status = "retry"
	StatusDelivered Status = "delivered"
	StatusDead      Status = "dead_letter"
)

type Severity uint8

const (
	SeverityInfo Severity = iota + 1
	SeverityWarning
	SeverityCritical
)

type EnqueueRequest struct {
	SubscriptionID string
	EventID        string
	Provider       string
	Destination    string
	Severity       Severity
	Priority       int
	Payload        []byte
}

type Record struct {
	Key          string
	SubscriptionID string
	EventID      string
	Provider     string
	Destination  string
	Severity     Severity
	Priority     int
	Payload      []byte
	Status       Status
	Attempts     int
	NextAttempt  time.Time
	LastError    string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type Policy struct {
	MaxAttempts int
	BaseBackoff time.Duration
	MaxBackoff  time.Duration
}

func (p Policy) Validate() error {
	if p.MaxAttempts < 1 { return errors.New("max attempts must be positive") }
	if p.BaseBackoff <= 0 { return errors.New("base backoff must be positive") }
	if p.MaxBackoff < p.BaseBackoff { return errors.New("max backoff must be >= base backoff") }
	return nil
}

type Queue struct {
	mu      sync.Mutex
	policy  Policy
	records map[string]*Record
}

func NewQueue(policy Policy) (*Queue, error) {
	if err := policy.Validate(); err != nil { return nil, err }
	return &Queue{policy: policy, records: map[string]*Record{}}, nil
}

func DeterministicKey(subscriptionID, eventID, provider, destination string) (string, error) {
	parts := []string{subscriptionID, eventID, provider, destination}
	for i, p := range parts {
		p = strings.TrimSpace(strings.ToLower(p))
		if p == "" { return "", errors.New("delivery key fields must not be empty") }
		parts[i] = p
	}
	return strings.Join(parts, "|"), nil
}

func (q *Queue) Enqueue(req EnqueueRequest, now time.Time) (Record, bool, error) {
	key, err := DeterministicKey(req.SubscriptionID, req.EventID, req.Provider, req.Destination)
	if err != nil { return Record{}, false, err }
	if req.Severity < SeverityInfo || req.Severity > SeverityCritical { return Record{}, false, errors.New("invalid severity") }
	if now.IsZero() { return Record{}, false, errors.New("enqueue time is required") }

	q.mu.Lock()
	defer q.mu.Unlock()
	if existing, ok := q.records[key]; ok {
		return clone(*existing), false, nil
	}
	rec := &Record{
		Key: key, SubscriptionID: req.SubscriptionID, EventID: req.EventID,
		Provider: req.Provider, Destination: req.Destination, Severity: req.Severity,
		Priority: req.Priority, Payload: append([]byte(nil), req.Payload...), Status: StatusPending,
		NextAttempt: now, CreatedAt: now, UpdatedAt: now,
	}
	q.records[key] = rec
	return clone(*rec), true, nil
}

func (q *Queue) Due(now time.Time, limit int) []Record {
	q.mu.Lock()
	defer q.mu.Unlock()
	if limit <= 0 { limit = len(q.records) }
	out := make([]Record, 0)
	for _, rec := range q.records {
		if (rec.Status == StatusPending || rec.Status == StatusRetry) && !rec.NextAttempt.After(now) {
			out = append(out, clone(*rec))
		}
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Severity != out[j].Severity { return out[i].Severity > out[j].Severity }
		if out[i].Priority != out[j].Priority { return out[i].Priority > out[j].Priority }
		if !out[i].NextAttempt.Equal(out[j].NextAttempt) { return out[i].NextAttempt.Before(out[j].NextAttempt) }
		return out[i].Key < out[j].Key
	})
	if len(out) > limit { out = out[:limit] }
	return out
}

func (q *Queue) MarkDelivered(key string, now time.Time) error {
	q.mu.Lock(); defer q.mu.Unlock()
	rec, ok := q.records[key]; if !ok { return errors.New("delivery record not found") }
	if rec.Status == StatusDead { return errors.New("dead-letter delivery cannot be delivered") }
	rec.Status = StatusDelivered; rec.UpdatedAt = now; rec.LastError = ""; return nil
}

func (q *Queue) MarkFailed(key, message string, now time.Time) (Record, error) {
	q.mu.Lock(); defer q.mu.Unlock()
	rec, ok := q.records[key]; if !ok { return Record{}, errors.New("delivery record not found") }
	if rec.Status == StatusDelivered { return Record{}, errors.New("delivered record cannot fail") }
	rec.Attempts++
	rec.LastError = safeError(message)
	rec.UpdatedAt = now
	if rec.Attempts >= q.policy.MaxAttempts {
		rec.Status = StatusDead
		rec.NextAttempt = time.Time{}
		return clone(*rec), nil
	}
	rec.Status = StatusRetry
	rec.NextAttempt = now.Add(q.backoff(rec.Attempts))
	return clone(*rec), nil
}

func (q *Queue) Get(key string) (Record, bool) {
	q.mu.Lock(); defer q.mu.Unlock()
	rec, ok := q.records[key]; if !ok { return Record{}, false }
	return clone(*rec), true
}

func (q *Queue) backoff(attempt int) time.Duration {
	d := q.policy.BaseBackoff
	for i := 1; i < attempt; i++ {
		if d >= q.policy.MaxBackoff/2 { return q.policy.MaxBackoff }
		d *= 2
	}
	if d > q.policy.MaxBackoff { return q.policy.MaxBackoff }
	return d
}

func safeError(v string) string {
	v = strings.TrimSpace(v)
	if v == "" { return "delivery_failed" }
	if len(v) > 256 { return fmt.Sprintf("%s", v[:256]) }
	return v
}

func clone(r Record) Record {
	r.Payload = append([]byte(nil), r.Payload...)
	return r
}
