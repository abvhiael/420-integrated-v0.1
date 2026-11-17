package monitoring

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/420integrated/420-integrated/consensus/recovery"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

func validateEndpoint(raw string, external bool) error {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return errors.New("invalid operator destination")
	}
	ip := net.ParseIP(u.Hostname())
	local := ip != nil && ip.IsLoopback()
	if u.Scheme != "https" && !(u.Scheme == "http" && local) {
		return errors.New("operator delivery requires HTTPS or literal loopback simulation")
	}
	if !local && !external {
		return errors.New("external alarm delivery is disabled")
	}
	return nil
}

type Sender struct {
	client       *http.Client
	destinations map[string]Destination
	tokens       map[string]string
}

func NewSender(c Config) (*Sender, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	s := &Sender{client: &http.Client{Timeout: 5 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("redirect forbidden") }, Transport: &http.Transport{Proxy: nil, MaxIdleConns: 8, IdleConnTimeout: 30 * time.Second}}, destinations: map[string]Destination{}, tokens: map[string]string{}}
	for _, d := range c.Destinations {
		s.destinations[d.ID] = d
		if d.BearerFile != "" {
			info, err := os.Lstat(d.BearerFile)
			if err != nil || !info.Mode().IsRegular() || info.Mode().Perm()&0077 != 0 {
				return nil, errors.New("private destination credential required")
			}
			raw, err := os.ReadFile(d.BearerFile)
			if err != nil {
				return nil, errors.New("destination credential unavailable")
			}
			secret := strings.TrimSpace(string(raw))
			if len(secret) < 16 || len(secret) > 4096 || strings.ContainsAny(secret, "\r\n\t ") {
				return nil, errors.New("invalid destination credential")
			}
			s.tokens[d.ID] = secret
		}
	}
	return s, nil
}
func (s *Sender) send(ctx context.Context, r Record) (code string, permanent bool, retryAfter time.Duration) {
	d, ok := s.destinations[r.Destination]
	if !ok {
		return "PERMANENT_REJECTION", true, 0
	}
	raw, _ := json.Marshal(r.Alarm)
	request, err := http.NewRequestWithContext(ctx, "POST", d.URL, bytes.NewReader(raw))
	if err != nil {
		return "DELIVERY_FAILED", false, 0
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Idempotency-Key", r.Alarm.ID)
	if token := s.tokens[r.Destination]; token != "" {
		request.Header.Set("Authorization", "Bearer "+token)
	}
	response, err := s.client.Do(request)
	if err != nil {
		return "DELIVERY_FAILED", false, 0
	}
	defer response.Body.Close()
	if response.StatusCode == 401 || response.StatusCode == 403 {
		return "AUTH_REJECTED", true, 0
	}
	if response.StatusCode == 429 || response.StatusCode >= 500 {
		if n, err := strconv.ParseUint(response.Header.Get("Retry-After"), 10, 32); err == nil {
			retryAfter = time.Duration(n) * time.Second
		}
		return "DELIVERY_FAILED", false, retryAfter
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return "PERMANENT_REJECTION", true, 0
	}
	var ack struct {
		ID     string `json:"id"`
		Status string `json:"status"`
	}
	raw, err = io.ReadAll(io.LimitReader(response.Body, 4097))
	if err != nil || len(raw) > 4096 || recovery.Decode(raw, &ack) != nil || ack.ID != r.Alarm.ID || (ack.Status != "accepted" && ack.Status != "delivered") {
		return "BAD_ACK", false, 0
	}
	return "", false, 0
}

// Deliver persists intent before sending, sends oldest incident transitions in
// order, then persists acknowledgment. A crash after remote acceptance retries
// the same idempotency key. Exactly-once effects require a durable receiver key.
func (s *Store) Deliver(ctx context.Context, sender *Sender, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.failed {
		return errors.New("monitor persistence latched")
	}
	d := s.copy()
	indices := make([]int, len(d.Records))
	for i := range indices {
		indices[i] = i
	}
	rank := map[string]int{"CRITICAL": 3, "MAJOR": 2, "WARN": 1}
	sort.SliceStable(indices, func(i, j int) bool {
		a, b := d.Records[indices[i]].Alarm, d.Records[indices[j]].Alarm
		if rank[a.Severity] != rank[b.Severity] {
			return rank[a.Severity] > rank[b.Severity]
		}
		return a.ObservedAt.Before(b.ObservedAt)
	})
	for _, i := range indices {
		r := &d.Records[i]
		if (r.Status != "pending" && r.Status != "retry") || r.NextAttempt.After(now) {
			continue
		}
		blocked := false
		for j := 0; j < i; j++ {
			prior := d.Records[j]
			if prior.Destination == r.Destination && prior.Alarm.Rule == r.Alarm.Rule && prior.Status != "delivered" {
				blocked = true
				break
			}
		}
		if blocked {
			continue
		}
		if r.Attempts >= s.config.MaxAttempts {
			r.Status = "dead_letter"
			r.NextAttempt = time.Time{}
			if err := s.persist(d); err != nil {
				return err
			}
			continue
		}
		if ctx.Err() != nil {
			return nil
		}
		// Reserve the attempt durably; interruption consumes an attempt and retains ID.
		r.Attempts++
		r.TotalAttempts++
		delay := s.config.RetryPolicy().BaseBackoff
		for n := 1; n < r.Attempts; n++ {
			if delay >= s.config.RetryPolicy().MaxBackoff/2 {
				delay = s.config.RetryPolicy().MaxBackoff
				break
			}
			delay *= 2
		}
		if delay > s.config.RetryPolicy().MaxBackoff {
			delay = s.config.RetryPolicy().MaxBackoff
		}
		r.Status = "retry"
		r.NextAttempt = now.Add(delay)
		r.Failure = "DELIVERY_FAILED"
		if err := s.persist(d); err != nil {
			return err
		}
		reserved := *r
		s.mu.Unlock()
		code, permanent, retryAfter := sender.send(ctx, reserved)
		s.mu.Lock()
		d = s.copy()
		r = &d.Records[i]
		if code == "" {
			r.Status = "delivered"
			r.Failure = ""
			r.NextAttempt = time.Time{}
		} else {
			r.Failure = code
			if permanent || r.Attempts >= s.config.MaxAttempts {
				r.Status = "dead_letter"
				r.NextAttempt = time.Time{}
			} else if retryAfter > delay {
				if retryAfter > s.config.RetryPolicy().MaxBackoff {
					retryAfter = s.config.RetryPolicy().MaxBackoff
				}
				r.NextAttempt = now.Add(retryAfter)
			}
		}
		if err := s.persist(d); err != nil {
			return err
		}
	}
	return nil
}
