package delivery

import (
	"errors"
	"strings"
	"sync"
	"time"
)

type RateLimitPolicy struct {
	MaxDeliveries int
	Window        time.Duration
}

func (p RateLimitPolicy) Validate() error {
	if p.MaxDeliveries < 1 { return errors.New("max deliveries must be positive") }
	if p.Window <= 0 { return errors.New("rate limit window must be positive") }
	return nil
}

type RateDecision struct {
	Allowed    bool
	Remaining  int
	RetryAfter time.Duration
}

type rateBucket struct {
	windowStart time.Time
	count       int
}

type RateLimiter struct {
	mu      sync.Mutex
	policy  RateLimitPolicy
	buckets map[string]rateBucket
}

func NewRateLimiter(policy RateLimitPolicy) (*RateLimiter, error) {
	if err := policy.Validate(); err != nil { return nil, err }
	return &RateLimiter{policy: policy, buckets: map[string]rateBucket{}}, nil
}

func (r *RateLimiter) Allow(provider, destination string, now time.Time) (RateDecision, error) {
	provider = strings.TrimSpace(strings.ToLower(provider))
	destination = strings.TrimSpace(strings.ToLower(destination))
	if provider == "" || destination == "" { return RateDecision{}, errors.New("rate limit identity is required") }
	if now.IsZero() { return RateDecision{}, errors.New("rate limit time is required") }
	key := provider + "|" + destination

	r.mu.Lock()
	defer r.mu.Unlock()
	bucket := r.buckets[key]
	if bucket.windowStart.IsZero() || !now.Before(bucket.windowStart.Add(r.policy.Window)) {
		bucket = rateBucket{windowStart: now}
	}
	if bucket.count >= r.policy.MaxDeliveries {
		retry := bucket.windowStart.Add(r.policy.Window).Sub(now)
		if retry < 0 { retry = 0 }
		r.buckets[key] = bucket
		return RateDecision{Allowed:false, Remaining:0, RetryAfter:retry}, nil
	}
	bucket.count++
	r.buckets[key] = bucket
	return RateDecision{Allowed:true, Remaining:r.policy.MaxDeliveries-bucket.count}, nil
}
