package monitoring

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type Service struct {
	mu      sync.RWMutex
	store   *Store
	sender  *Sender
	collect func(context.Context, time.Time) Snapshot
	latest  Snapshot
	ready   bool
}

func NewService(store *Store, sender *Sender, collect func(context.Context, time.Time) Snapshot) *Service {
	return &Service{store: store, sender: sender, collect: collect}
}
func (s *Service) Cycle(ctx context.Context, now time.Time) error {
	snapshot := s.collect(ctx, now)
	failure := s.store.DeliveryFailure()
	for i := range snapshot.Conditions {
		if snapshot.Conditions[i].Rule == "delivery_failure" {
			snapshot.Conditions[i] = condition("delivery_failure", failure)
		}
	}
	if err := snapshot.Validate(); err != nil || len(snapshot.Conditions) != len(severities) {
		s.set(Snapshot{Schema: Schema, ObservedAt: now, Metrics: map[string]float64{}}, false)
		return errors.New("MONITOR_OBSERVATION_INVALID")
	}
	if err := s.store.Observe(snapshot); err != nil {
		s.set(snapshot, false)
		return err
	}
	if err := s.store.Deliver(ctx, s.sender, now); err != nil {
		s.set(snapshot, false)
		return err
	}
	currentFailure := s.store.DeliveryFailure()
	if currentFailure != failure {
		for i := range snapshot.Conditions {
			if snapshot.Conditions[i].Rule == "delivery_failure" {
				snapshot.Conditions[i] = condition("delivery_failure", currentFailure)
			}
		}
		if err := s.store.Observe(snapshot); err != nil {
			s.set(snapshot, false)
			return err
		}
	}
	healthy := !currentFailure
	for _, v := range snapshot.Conditions {
		if v.State != "OK" && v.Rule != "delivery_failure" {
			healthy = false
		}
	}
	s.set(snapshot, healthy)
	return nil
}
func (s *Service) set(snapshot Snapshot, ready bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.latest = snapshot
	s.ready = ready
}
func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/live", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintln(w, `{"schema":"420-stake-monitor-v1","live":true,"canonicalAuthority":false}`)
	})
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		ready := s.ready
		s.mu.RUnlock()
		w.Header().Set("Content-Type", "application/json")
		if !ready {
			w.WriteHeader(503)
		}
		_ = json.NewEncoder(w).Encode(struct {
			Schema             string `json:"schema"`
			Ready              bool   `json:"ready"`
			CanonicalAuthority bool   `json:"canonicalAuthority"`
		}{Schema, ready, false})
	})
	mux.HandleFunc("/v1/alarms", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(s.store.Records())
	})
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		s.mu.RLock()
		snapshot, ready := s.latest, s.ready
		s.mu.RUnlock()
		w.Header().Set("Content-Type", "text/plain; version=0.0.4")
		fmt.Fprintf(w, "stake_monitor_ready %d\nstake_monitor_observed_timestamp_seconds %d\n", boolInt(ready), snapshot.ObservedAt.Unix())
		keys := make([]string, 0, len(snapshot.Metrics))
		for key := range snapshot.Metrics {
			keys = append(keys, key)
		}
		sort.Strings(keys)
		for _, key := range keys {
			fmt.Fprintf(w, "stake_%s %.12g\n", key, snapshot.Metrics[key])
		}
		states := map[string]string{}
		for _, c := range snapshot.Conditions {
			states[c.Rule] = c.State
		}
		rules := make([]string, 0, len(severities))
		for rule := range severities {
			rules = append(rules, rule)
		}
		sort.Strings(rules)
		for _, rule := range rules {
			state := states[rule]
			known := state == "OK" || state == "FIRING"
			active := state == "FIRING" || (!known && s.store.Active(rule))
			fmt.Fprintf(w, "stake_alarm_active{rule=%q,severity=%q} %d\nstake_signal_known{rule=%q} %d\n", rule, severities[rule], boolInt(active), rule, boolInt(known))
		}
		attempts := uint64(0)
		counts := map[string]int{}
		for _, rec := range s.store.Records() {
			counts[rec.Status]++
			attempts += rec.TotalAttempts
		}
		fmt.Fprintf(w, "stake_alarm_delivery_attempts_total %d\n", attempts)
		for _, status := range []string{"pending", "retry", "delivered", "dead_letter"} {
			fmt.Fprintf(w, "stake_alarm_delivery_records{status=%q} %d\n", status, counts[status])
		}
	})
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "GET" || strings.Contains(r.URL.Path, "..") {
			http.Error(w, "read-only operator telemetry", http.StatusMethodNotAllowed)
			return
		}
		mux.ServeHTTP(w, r)
	})
}
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
