package monitoring

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"github.com/420integrated/420-integrated/consensus/recovery"
	"github.com/420integrated/420-integrated/consensus/telemetry"
	"github.com/420integrated/420-integrated/notifications/delivery"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"syscall"
	"time"
)

type Incident struct {
	Episode uint64 `json:"episode"`
	Active  bool   `json:"active"`
}
type Record struct {
	Alarm         Alarm     `json:"alarm"`
	Destination   string    `json:"destination"`
	Status        string    `json:"status"`
	Attempts      int       `json:"attempts"`
	TotalAttempts uint64    `json:"totalAttempts"`
	Redrives      uint64    `json:"redrives"`
	NextAttempt   time.Time `json:"nextAttempt"`
	Failure       string    `json:"failure,omitempty"`
}
type disk struct {
	Schema       string              `json:"schema"`
	ConfigHash   string              `json:"configHash"`
	LastObserved time.Time           `json:"lastObserved"`
	Incidents    map[string]Incident `json:"incidents"`
	Records      []Record            `json:"records"`
	Checksum     string              `json:"checksum"`
}
type Store struct {
	mu     sync.Mutex
	dir    string
	lock   *os.File
	data   disk
	failed bool
	config Config
}

func hashJSON(v any) string {
	raw, _ := json.Marshal(v)
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:])
}
func checksum(d disk) string { d.Checksum = ""; return hashJSON(d) }
func configHash(c Config) string {
	type target struct{ ID, EndpointHash string }
	targets := []target{}
	for _, v := range c.Destinations {
		targets = append(targets, target{v.ID, hashJSON(v.URL)})
	}
	sort.Slice(targets, func(i, j int) bool { return targets[i].ID < targets[j].ID })
	return hashJSON(struct {
		TrustPin            string
		Node                string
		Targets             []target
		Attempts, Base, Max int
	}{c.TrustSHA256, c.Node, targets, c.MaxAttempts, c.BaseBackoffSeconds, c.MaxBackoffSeconds})
}
func Open(c Config, initialize bool) (*Store, error) {
	if err := c.Validate(); err != nil {
		return nil, err
	}
	if err := os.MkdirAll(c.StateDir, 0700); err != nil {
		return nil, errors.New("monitor persistence unavailable")
	}
	lock, err := os.OpenFile(filepath.Join(c.StateDir, "monitor.lock"), os.O_CREATE|os.O_RDWR, 0600)
	if err != nil {
		return nil, errors.New("monitor lock unavailable")
	}
	if err = syscall.Flock(int(lock.Fd()), syscall.LOCK_EX|syscall.LOCK_NB); err != nil {
		lock.Close()
		return nil, errors.New("monitor already owned")
	}
	s := &Store{dir: c.StateDir, lock: lock, config: c}
	fail := func() (*Store, error) { s.Close(); return nil, errors.New("monitor state unavailable or corrupt") }
	path := filepath.Join(c.StateDir, "state.json")
	raw, err := os.ReadFile(path)
	if initialize {
		if !errors.Is(err, os.ErrNotExist) {
			return fail()
		}
		s.data = disk{Schema: Schema, ConfigHash: configHash(c), Incidents: map[string]Incident{}, Records: []Record{}}
		if err = s.persist(s.data); err != nil {
			return fail()
		}
		return s, nil
	}
	if err != nil || recovery.Decode(raw, &s.data) != nil || s.validate() != nil {
		return fail()
	}
	return s, nil
}
func (s *Store) Close() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.failed = true
	if s.lock != nil {
		syscall.Flock(int(s.lock.Fd()), syscall.LOCK_UN)
		s.lock.Close()
		s.lock = nil
	}
}
func (s *Store) validate() error {
	d := s.data
	if d.Schema != Schema || d.ConfigHash != configHash(s.config) || d.Checksum != checksum(d) || d.Incidents == nil || d.Records == nil {
		return errors.New("invalid monitor state")
	}
	seen := map[string]bool{}
	targets := map[string]bool{}
	for _, v := range s.config.Destinations {
		targets[v.ID] = true
	}
	for rule, i := range d.Incidents {
		if severities[rule] == "" || i.Episode == 0 {
			return errors.New("invalid incident")
		}
	}
	for _, r := range d.Records {
		a := r.Alarm
		k, _ := delivery.DeterministicKey(s.config.Node, a.ID, "operator-webhook", r.Destination)
		if seen[k] || !targets[r.Destination] || a.Schema != Schema || a.Node != s.config.Node || a.Severity != severities[a.Rule] || a.ObservedAt.IsZero() || a.ID != alarmID(a) || a.Episode == 0 || a.Episode > d.Incidents[a.Rule].Episode || r.Attempts < 0 || r.Attempts > s.config.MaxAttempts {
			return errors.New("invalid alarm record")
		}
		seen[k] = true
		if a.Transition != "FIRING" && a.Transition != "RECOVERED" {
			return errors.New("invalid alarm transition")
		}
		if (r.Status == "delivered" || r.Status == "dead_letter") && (!r.NextAttempt.IsZero() || r.Attempts == 0) {
			return errors.New("invalid terminal delivery")
		}
		if (r.Status == "pending" || r.Status == "retry") && r.NextAttempt.IsZero() {
			return errors.New("missing delivery due time")
		}
		if r.Status == "pending" && (r.Attempts != 0 || r.TotalAttempts != 0) {
			return errors.New("invalid pending delivery")
		}
		if r.Status == "retry" && r.Attempts == 0 && r.Redrives == 0 {
			return errors.New("invalid retry attempt")
		}
		if (r.Status == "pending" || r.Status == "delivered") && r.Failure != "" {
			return errors.New("invalid delivery failure state")
		}
		switch r.Status {
		case "pending", "retry", "delivered", "dead_letter":
		default:
			return errors.New("invalid delivery status")
		}
		switch r.Failure {
		case "", "DELIVERY_FAILED", "AUTH_REJECTED", "BAD_ACK", "PERMANENT_REJECTION":
		default:
			return errors.New("invalid delivery failure")
		}
	}

	// Incident metadata must be exactly reconstructible from complete ordered
	// per-destination transition groups. Checksums alone do not establish this.
	derived := map[string]Incident{}
	width := len(s.config.Destinations)
	if len(d.Records)%width != 0 {
		return errors.New("incomplete delivery transition")
	}
	for i := 0; i < len(d.Records); i += width {
		a := d.Records[i].Alarm
		destinations := map[string]bool{}
		for j := i; j < i+width; j++ {
			r := d.Records[j]
			if !sameAlarm(r.Alarm, a) || destinations[r.Destination] {
				return errors.New("contradictory delivery transition")
			}
			destinations[r.Destination] = true
			if r.TotalAttempts < uint64(r.Attempts) || r.Alarm.ObservedAt.After(d.LastObserved) {
				return errors.New("invalid delivery attempt history")
			}
		}
		incident := derived[a.Rule]
		if a.Transition == "FIRING" {
			if incident.Active || a.Episode != incident.Episode+1 {
				return errors.New("invalid firing episode")
			}
			incident.Episode++
			incident.Active = true
		} else {
			if !incident.Active || a.Episode != incident.Episode {
				return errors.New("unpaired recovery")
			}
			incident.Active = false
		}
		derived[a.Rule] = incident
	}
	if len(derived) != len(d.Incidents) {
		return errors.New("incident history missing")
	}
	for rule, v := range derived {
		if d.Incidents[rule] != v {
			return errors.New("incident state contradicts outbox")
		}
	}
	return nil
}
func alarmID(a Alarm) string {
	return hashJSON(struct {
		Schema, Node, Rule, Transition string
		Episode                        uint64
	}{Schema, a.Node, a.Rule, a.Transition, a.Episode})
}
func (s *Store) persist(next disk) error {
	if s.failed {
		return errors.New("monitor persistence latched")
	}
	next.Checksum = checksum(next)
	raw, marshalErr := json.Marshal(next)
	if marshalErr != nil {
		s.failed = true
		return errors.New("MONITOR_STATE_INVALID")
	}
	if err := telemetry.Atomic(filepath.Join(s.dir, "state.json"), append(raw, '\n')); err != nil {
		s.failed = true
		return errors.New("MONITOR_PERSISTENCE_FAILURE")
	}
	s.data = next
	return nil
}
func (s *Store) copy() disk {
	raw, _ := json.Marshal(s.data)
	var d disk
	_ = json.Unmarshal(raw, &d)
	return d
}
func (s *Store) Observe(snapshot Snapshot) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := snapshot.Validate(); err != nil {
		return err
	}
	if snapshot.ObservedAt.Before(s.data.LastObserved) {
		return errors.New("observation clock rollback")
	}
	next := s.copy()
	for _, c := range snapshot.Conditions {
		if c.State == "UNKNOWN" {
			continue
		}
		incident := next.Incidents[c.Rule]
		active := c.State == "FIRING"
		if incident.Active == active {
			continue
		}
		transition := "RECOVERED"
		if active {
			incident.Episode++
			transition = "FIRING"
		}
		incident.Active = active
		next.Incidents[c.Rule] = incident
		a := Alarm{Schema: Schema, Node: s.config.Node, Rule: c.Rule, Severity: severities[c.Rule], Transition: transition, Episode: incident.Episode, ObservedAt: snapshot.ObservedAt}
		a.ID = alarmID(a)
		for _, target := range s.config.Destinations {
			next.Records = append(next.Records, Record{Alarm: a, Destination: target.ID, Status: "pending", NextAttempt: snapshot.ObservedAt})
		}
	}
	next.LastObserved = snapshot.ObservedAt
	return s.persist(next)
}
func (s *Store) Records() []Record { s.mu.Lock(); defer s.mu.Unlock(); return s.copy().Records }
func (s *Store) DeliveryFailure() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, r := range s.data.Records {
		if r.Status == "retry" || r.Status == "dead_letter" {
			return true
		}
	}
	return false
}
func (s *Store) Redrive() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	d := s.copy()
	for i := range d.Records {
		r := &d.Records[i]
		if r.Status == "dead_letter" {
			r.Status = "retry"
			r.Attempts = 0
			r.Redrives++
			r.NextAttempt = time.Now().UTC()
		}
	}
	return s.persist(d)
}

func (s *Store) Active(rule string) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.data.Incidents[rule].Active
}

func sameAlarm(a, b Alarm) bool {
	at, bt := a.ObservedAt, b.ObservedAt
	a.ObservedAt = time.Time{}
	b.ObservedAt = time.Time{}
	return a == b && at.Equal(bt)
}
