package hardening

import (
	"errors"
	"strings"
	"sync"
	"time"
)

type AbusePolicy struct {
	MaxEvents int
	Window    time.Duration
}

func (p AbusePolicy) Validate() error {
	if p.MaxEvents < 1 { return errors.New("max events must be positive") }
	if p.Window <= 0 { return errors.New("abuse window must be positive") }
	return nil
}

type abuseBucket struct {
	started time.Time
	count   int
}

type Guard struct {
	mu      sync.Mutex
	policy  AbusePolicy
	buckets map[string]abuseBucket
	failed  map[string]bool
}

func NewGuard(policy AbusePolicy) (*Guard, error) {
	if err := policy.Validate(); err != nil { return nil, err }
	return &Guard{policy: policy, buckets: map[string]abuseBucket{}, failed: map[string]bool{}}, nil
}

// Allow applies presentation/delivery abuse controls only. A denial must never
// be interpreted as changing the canonical event represented by the alert.
func (g *Guard) Allow(scope string, now time.Time) (bool, time.Duration, error) {
	scope = strings.TrimSpace(strings.ToLower(scope))
	if scope == "" || now.IsZero() { return false, 0, errors.New("scope and time are required") }
	g.mu.Lock()
	defer g.mu.Unlock()
	bucket := g.buckets[scope]
	if bucket.started.IsZero() || !now.Before(bucket.started.Add(g.policy.Window)) {
		bucket = abuseBucket{started: now}
	}
	if bucket.count >= g.policy.MaxEvents {
		retry := bucket.started.Add(g.policy.Window).Sub(now)
		if retry < 0 { retry = 0 }
		g.buckets[scope] = bucket
		return false, retry, nil
	}
	bucket.count++
	g.buckets[scope] = bucket
	return true, 0, nil
}

func (g *Guard) SetProviderFailed(provider string, failed bool) error {
	provider = strings.TrimSpace(strings.ToLower(provider))
	if provider == "" { return errors.New("provider is required") }
	g.mu.Lock()
	defer g.mu.Unlock()
	g.failed[provider] = failed
	return nil
}

func (g *Guard) ProviderAvailable(provider string) bool {
	provider = strings.TrimSpace(strings.ToLower(provider))
	g.mu.Lock()
	defer g.mu.Unlock()
	return provider != "" && !g.failed[provider]
}
