package monitoring

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func testConfig(t *testing.T, url string) Config {
	t.Helper()
	return Config{Node: "validator-01", Listen: "127.0.0.1:0", StateDir: t.TempDir(), IntervalSeconds: 1, FreshSeconds: 45, MaxAttempts: 3, BaseBackoffSeconds: 1, MaxBackoffSeconds: 4, Destinations: []Destination{{ID: "local-operator", URL: url}}}
}
func observation(now time.Time, conditions ...Condition) Snapshot {
	return Snapshot{Schema: Schema, ObservedAt: now, Conditions: conditions, Metrics: map[string]float64{}}
}
func accepted(w http.ResponseWriter, r *http.Request) {
	var a Alarm
	_ = json.NewDecoder(r.Body).Decode(&a)
	_ = json.NewEncoder(w).Encode(map[string]string{"id": a.ID, "status": "accepted"})
}
func TestDurableAlarmDedupRetryRecoveryOrderingAndRestart(t *testing.T) {
	var mu sync.Mutex
	attempts := 0
	ids := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		defer mu.Unlock()
		attempts++
		ids = append(ids, r.Header.Get("Idempotency-Key"))
		if attempts == 1 {
			w.WriteHeader(503)
			return
		}
		accepted(w, r)
	}))
	defer server.Close()
	config := testConfig(t, server.URL)
	s, err := Open(config, true)
	if err != nil {
		t.Fatal(err)
	}
	sender, _ := NewSender(config)
	now := time.Unix(1000, 0).UTC()
	firing := observation(now, condition("gateway_sequence_mismatch", true))
	if err = s.Observe(firing); err != nil {
		t.Fatal(err)
	}
	if err = s.Observe(firing); err != nil {
		t.Fatal(err)
	}
	if len(s.Records()) != 1 {
		t.Fatal("duplicate episode")
	}
	if _, err = Open(config, false); err == nil {
		t.Fatal("concurrent owner")
	}
	if err = s.Deliver(context.Background(), sender, now); err != nil {
		t.Fatal(err)
	}
	if s.Records()[0].Status != "retry" {
		t.Fatal(s.Records())
	}
	s.Close()
	s, err = Open(config, false)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = s.Observe(observation(now.Add(time.Second), condition("gateway_sequence_mismatch", false))); err != nil {
		t.Fatal(err)
	}
	if err = s.Deliver(context.Background(), sender, now); err != nil {
		t.Fatal(err)
	}
	if len(ids) != 1 {
		t.Fatal("recovery overtook firing retry")
	}
	if err = s.Deliver(context.Background(), sender, now.Add(time.Second)); err != nil {
		t.Fatal(err)
	}
	records := s.Records()
	if len(ids) != 3 || ids[0] != ids[1] || ids[1] == ids[2] || records[0].Status != "delivered" || records[1].Alarm.Transition != "RECOVERED" || records[1].Status != "delivered" {
		t.Fatal(ids, records)
	}
	if err = s.Observe(observation(now.Add(2*time.Second), condition("gateway_sequence_mismatch", true))); err != nil {
		t.Fatal(err)
	}
	if s.Records()[2].Alarm.Episode != 2 || s.Records()[2].Alarm.ID == ids[0] {
		t.Fatal("new incident suppressed")
	}
}
func TestUnknownCannotResolveAndFailureDoesNotLeak(t *testing.T) {
	s, err := Open(testConfig(t, "http://127.0.0.1:1"), true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	now := time.Now().UTC()
	if err = s.Observe(observation(now, condition("persistence_failure", true))); err != nil {
		t.Fatal(err)
	}
	if err = s.Observe(observation(now.Add(time.Second), Condition{"persistence_failure", "UNKNOWN"})); err != nil {
		t.Fatal(err)
	}
	if len(s.Records()) != 1 || !s.data.Incidents["persistence_failure"].Active {
		t.Fatal("unknown recovered incident")
	}
	if err = s.Observe(observation(now.Add(-time.Second), condition("persistence_failure", false))); err == nil {
		t.Fatal("clock rollback accepted")
	}
	if err = s.Observe(observation(now, Condition{"postgres://secret", "FIRING"})); err == nil {
		t.Fatal("secret label accepted")
	}
	if err = s.Observe(Snapshot{Schema: Schema, ObservedAt: now, Metrics: map[string]float64{"password": 42}}); err == nil {
		t.Fatal("unbounded metric")
	}
}
func TestDeadLetterBadAckAuthAndExplicitRedrive(t *testing.T) {
	for _, mode := range []string{"bad-ack", "auth", "retry-after"} {
		t.Run(mode, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				switch mode {
				case "auth":
					w.WriteHeader(401)
					w.Write([]byte("token=secret"))
				case "retry-after":
					w.Header().Set("Retry-After", "999999")
					w.WriteHeader(429)
				default:
					w.Write([]byte(`{"id":"wrong-secret","status":"accepted"}`))
				}
			}))
			defer server.Close()
			c := testConfig(t, server.URL)
			s, err := Open(c, true)
			if err != nil {
				t.Fatal(err)
			}
			defer s.Close()
			sender, _ := NewSender(c)
			now := time.Now().UTC()
			s.Observe(observation(now, condition("signing_protection_failure", true)))
			for i := 0; i < 3; i++ {
				if err = s.Deliver(context.Background(), sender, now.Add(time.Duration(i)*10*time.Second)); err != nil {
					t.Fatal(err)
				}
			}
			r := s.Records()[0]
			if r.Status != "dead_letter" || r.Attempts > 3 || strings.Contains(r.Failure, "secret") {
				t.Fatal(r)
			}
			id := r.Alarm.ID
			if err = s.Redrive(); err != nil {
				t.Fatal(err)
			}
			r = s.Records()[0]
			if r.Status != "retry" || r.Alarm.ID != id || r.Redrives != 1 || r.TotalAttempts == 0 {
				t.Fatal(r)
			}
		})
	}
}
func TestPersistenceFailureLatchesAndCorruptionRejects(t *testing.T) {
	c := testConfig(t, "http://127.0.0.1:1")
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	backup := c.StateDir + "-backup"
	if err = os.Rename(c.StateDir, backup); err != nil {
		t.Fatal(err)
	}
	if err = os.WriteFile(c.StateDir, []byte("not-directory"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = s.Observe(observation(time.Now(), condition("safety_halt", true))); err == nil {
		t.Fatal("persistence failure hidden")
	}
	os.Remove(c.StateDir)
	os.Rename(backup, c.StateDir)
	if err = s.Observe(observation(time.Now(), condition("safety_halt", true))); err == nil {
		t.Fatal("continued after persistence failure")
	}
	s.Close()
	raw, _ := os.ReadFile(filepath.Join(c.StateDir, "state.json"))
	raw[len(raw)/2] ^= 1
	os.WriteFile(filepath.Join(c.StateDir, "state.json"), raw, 0600)
	if _, err = Open(c, false); err == nil {
		t.Fatal("corrupt outbox accepted")
	}
}
func TestDestinationSecurityAndConfigurationBinding(t *testing.T) {
	for _, u := range []string{"http://external.example/", "https://user:password@example/", "https://example/?token=secret", "http://localhost:80/"} {
		c := testConfig(t, u)
		if c.Validate() == nil {
			t.Fatal("unapproved endpoint", u)
		}
	}
	c := testConfig(t, "http://127.0.0.1:1")
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
	c.Destinations[0].URL = "http://127.0.0.1:2"
	if _, err = Open(c, false); err == nil {
		t.Fatal("pending destinations silently rerouted")
	}
}

func TestDispatchDoesNotBlockTelemetryAndNeverExportsAuthorization(t *testing.T) {
	started, release := make(chan struct{}), make(chan struct{})
	secret := "operator-private-credential-95"
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer "+secret {
			t.Error("missing destination authentication")
		}
		close(started)
		<-release
		accepted(w, r)
	}))
	defer server.Close()
	c := testConfig(t, server.URL)
	key := filepath.Join(t.TempDir(), "token")
	os.WriteFile(key, []byte(secret), 0600)
	c.Destinations[0].BearerFile = key
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	sender, err := NewSender(c)
	if err != nil {
		t.Fatal(err)
	}
	now := time.Now().UTC()
	s.Observe(observation(now, condition("safety_halt", true)))
	done := make(chan error, 1)
	go func() { done <- s.Deliver(context.Background(), sender, now) }()
	<-started
	read := make(chan []Record, 1)
	go func() { read <- s.Records() }()
	select {
	case records := <-read:
		raw, _ := json.Marshal(records)
		if strings.Contains(string(raw), secret) || strings.Contains(string(raw), server.URL) || strings.Contains(string(raw), "Bearer") {
			t.Fatal("private delivery configuration exported")
		}
	case <-time.After(time.Second):
		close(release)
		t.Fatal("destination outage blocked operator telemetry")
	}
	close(release)
	if err = <-done; err != nil {
		t.Fatal(err)
	}
}
func TestMissingStateCannotSilentlyInitialize(t *testing.T) {
	c := testConfig(t, "http://127.0.0.1:1")
	if _, err := Open(c, false); err == nil {
		t.Fatal("missing state reset")
	}
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	s.Close()
	if _, err = Open(c, true); err == nil {
		t.Fatal("existing outbox reset")
	}
}

func TestUnknownMetricPreservesIncidentAndInvalidInputCannotLeak(t *testing.T) {
	c := testConfig(t, "http://127.0.0.1:1")
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	now := time.Now().UTC()
	s.Observe(observation(now, condition("safety_halt", true)))
	service := NewService(s, nil, func(context.Context, time.Time) Snapshot {
		return Snapshot{Schema: Schema, ObservedAt: now, Conditions: []Condition{{Rule: "private-token-95", State: "FIRING"}}, Metrics: map[string]float64{"secret-password": 1}}
	})
	if err = service.Cycle(context.Background(), now); err == nil {
		t.Fatal("invalid observation accepted")
	}
	metrics := httptest.NewRecorder()
	service.Handler().ServeHTTP(metrics, httptest.NewRequest("GET", "/metrics", nil))
	if strings.Contains(metrics.Body.String(), "private-token-95") || strings.Contains(metrics.Body.String(), "secret-password") {
		t.Fatal("rejected telemetry input leaked")
	}
	if !strings.Contains(metrics.Body.String(), `stake_alarm_active{rule="safety_halt",severity="CRITICAL"} 1`) {
		t.Fatal("unknown observation cleared active alarm")
	}
	live := httptest.NewRecorder()
	service.Handler().ServeHTTP(live, httptest.NewRequest("GET", "/live", nil))
	ready := httptest.NewRecorder()
	service.Handler().ServeHTTP(ready, httptest.NewRequest("GET", "/health", nil))
	if live.Code != 200 || ready.Code != 503 {
		t.Fatal("liveness confused with readiness")
	}
}

func TestSemanticCorruptionCannotForgeRecoveryWithValidChecksum(t *testing.T) {
	c := testConfig(t, "http://127.0.0.1:1")
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	s.Observe(observation(time.Now().UTC(), condition("safety_halt", true)))
	d := s.copy()
	s.Close()
	incident := d.Incidents["safety_halt"]
	incident.Active = false
	d.Incidents["safety_halt"] = incident
	d.Checksum = checksum(d)
	raw, _ := json.Marshal(d)
	os.WriteFile(filepath.Join(c.StateDir, "state.json"), raw, 0600)
	if _, err = Open(c, false); err == nil {
		t.Fatal("valid checksum concealed contradictory recovered state")
	}
}
func TestLostAckRetriesSameReceiverEffectAndIndependentDestinations(t *testing.T) {
	effects := map[string]int{}
	requests := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("Idempotency-Key")
		requests++
		if effects[id] == 0 {
			effects[id] = 1
		}
		if requests == 1 {
			w.Write([]byte(`{"id":"lost-ack","status":"accepted"}`))
			return
		}
		accepted(w, r)
	}))
	defer server.Close()
	c := testConfig(t, server.URL)
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	sender, _ := NewSender(c)
	now := time.Now().UTC()
	s.Observe(observation(now, condition("safety_halt", true)))
	s.Deliver(context.Background(), sender, now)
	s.Deliver(context.Background(), sender, now.Add(time.Second))
	if requests != 2 || len(effects) != 1 || s.Records()[0].Status != "delivered" {
		t.Fatal("lost acknowledgment duplicated receiver effects", requests, effects)
	}
	c2 := testConfig(t, server.URL)
	c2.Destinations = append(c2.Destinations, Destination{ID: "backup-operator", URL: server.URL})
	multi, err := Open(c2, true)
	if err != nil {
		t.Fatal(err)
	}
	multi.Observe(observation(now, condition("safety_halt", true)))
	multi.Close()
	multi, err = Open(c2, false)
	if err != nil {
		t.Fatal("multi-destination transition failed reconstruction", err)
	}
	defer multi.Close()
	if len(multi.Records()) != 2 {
		t.Fatal("secondary destination omitted")
	}
}

func TestAmbiguousReceiverAcknowledgmentCannotComplete(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"id":"wrong","id":"` + r.Header.Get("Idempotency-Key") + `","status":"accepted"}`))
	}))
	defer server.Close()
	c := testConfig(t, server.URL)
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	sender, _ := NewSender(c)
	now := time.Now().UTC()
	s.Observe(observation(now, condition("safety_halt", true)))
	if err = s.Deliver(context.Background(), sender, now); err != nil {
		t.Fatal(err)
	}
	if s.Records()[0].Status != "retry" || s.Records()[0].Failure != "BAD_ACK" {
		t.Fatal("ambiguous acknowledgment accepted")
	}
}

func TestCriticalDeliveryPrecedesMajorWithoutReorderingIncidentHistory(t *testing.T) {
	rules := []string{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var a Alarm
		json.NewDecoder(r.Body).Decode(&a)
		rules = append(rules, a.Rule)
		json.NewEncoder(w).Encode(map[string]string{"id": a.ID, "status": "accepted"})
	}))
	defer server.Close()
	c := testConfig(t, server.URL)
	s, err := Open(c, true)
	if err != nil {
		t.Fatal(err)
	}
	sender, _ := NewSender(c)
	now := time.Now().UTC()
	s.Observe(observation(now, condition("finality_degraded", true), condition("safety_halt", true)))
	if err = s.Deliver(context.Background(), sender, now); err != nil {
		t.Fatal(err)
	}
	s.Close()
	if len(rules) != 2 || rules[0] != "safety_halt" {
		t.Fatal("critical alarm delayed behind major", rules)
	}
	s, err = Open(c, false)
	if err != nil {
		t.Fatal("dispatch corrupted durable incident order", err)
	}
	s.Close()
}
