package delivery

import (
	"testing"
	"time"
)

func TestRateLimiterAllowsThenThrottlesAndResets(t *testing.T) {
	limiter, err := NewRateLimiter(RateLimitPolicy{MaxDeliveries:2, Window:time.Minute})
	if err != nil { t.Fatal(err) }
	now := time.Unix(1000,0)
	first, err := limiter.Allow("Push", "Device-A", now)
	if err != nil || !first.Allowed || first.Remaining != 1 { t.Fatalf("first=%+v err=%v", first, err) }
	second, err := limiter.Allow("push", "device-a", now.Add(time.Second))
	if err != nil || !second.Allowed || second.Remaining != 0 { t.Fatalf("second=%+v err=%v", second, err) }
	third, err := limiter.Allow("push", "device-a", now.Add(2*time.Second))
	if err != nil || third.Allowed || third.RetryAfter <= 0 { t.Fatalf("third=%+v err=%v", third, err) }
	reset, err := limiter.Allow("push", "device-a", now.Add(time.Minute))
	if err != nil || !reset.Allowed || reset.Remaining != 1 { t.Fatalf("reset=%+v err=%v", reset, err) }
}

func TestRateLimiterIsolatesDestinations(t *testing.T) {
	limiter, _ := NewRateLimiter(RateLimitPolicy{MaxDeliveries:1, Window:time.Minute})
	now := time.Unix(2000,0)
	if d,_ := limiter.Allow("push","a",now); !d.Allowed { t.Fatal("a should be allowed") }
	if d,_ := limiter.Allow("push","a",now); d.Allowed { t.Fatal("a should be throttled") }
	if d,_ := limiter.Allow("push","b",now); !d.Allowed { t.Fatal("b should remain isolated") }
}
