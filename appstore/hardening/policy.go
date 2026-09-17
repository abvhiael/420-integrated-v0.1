package hardening

import (
	"errors"
	"net/url"
	"strings"
	"sync"
	"time"
)

var (
	ErrPrivateData        = errors.New("private appstore data is not permitted")
	ErrOversizedMetadata = errors.New("appstore metadata exceeds genesis limits")
	ErrUnsafeURL          = errors.New("unsafe appstore URL")
	ErrDependencyState    = errors.New("invalid appstore dependency state")
)

const (
	MaxDescriptionBytes = 8 * 1024
	MaxPresentationKeys = 64
	MaxPresentationValueBytes = 4 * 1024
	MaxScreenshots = 12
	MaxURLBytes = 2048
)

var forbiddenPrivateFields = []string{
	"privateidentity", "private_identity", "private identity",
	"messageraw", "message_raw", "encryptedmessage", "encrypted_message",
	"commonsprivate", "commons_private", "resourcepayload", "resource_payload",
	"rawattention", "raw_attention", "attentiontelemetry", "attention_telemetry",
	"installhistory", "install_history", "launchhistory", "launch_history",
	"privatekey", "private_key", "seedphrase", "seed_phrase", "mnemonic",
}

type Metadata struct {
	Description  string
	Screenshots  []string
	Presentation map[string]string
}

func ValidateMetadata(m Metadata) error {
	if len([]byte(m.Description)) > MaxDescriptionBytes || len(m.Screenshots) > MaxScreenshots || len(m.Presentation) > MaxPresentationKeys {
		return ErrOversizedMetadata
	}
	for key, value := range m.Presentation {
		if forbiddenField(key) {
			return ErrPrivateData
		}
		if len([]byte(value)) > MaxPresentationValueBytes {
			return ErrOversizedMetadata
		}
	}
	for _, raw := range m.Screenshots {
		if err := ValidatePublicURL(raw); err != nil {
			return err
		}
	}
	return nil
}

func forbiddenField(key string) bool {
	k := strings.ToLower(strings.TrimSpace(key))
	compact := strings.NewReplacer("-", "", "_", "", " ", "").Replace(k)
	for _, blocked := range forbiddenPrivateFields {
		b := strings.NewReplacer("-", "", "_", "", " ", "").Replace(blocked)
		if compact == b || strings.Contains(compact, b) {
			return true
		}
	}
	return false
}

func ValidatePublicURL(raw string) error {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > MaxURLBytes {
		return ErrUnsafeURL
	}
	u, err := url.Parse(raw)
	if err != nil || u.User != nil || u.Hostname() == "" {
		return ErrUnsafeURL
	}
	if u.Scheme != "https" {
		return ErrUnsafeURL
	}
	host := strings.ToLower(u.Hostname())
	if host == "localhost" || host == "127.0.0.1" || host == "::1" || strings.HasSuffix(host, ".local") {
		return ErrUnsafeURL
	}
	return nil
}

type Dependencies struct {
	Registry bool `json:"registry"`
	RPC      bool `json:"rpc"`
	Search   bool `json:"search"`
	Verify   bool `json:"verify"`
	Store    bool `json:"store"`
}

type Mode string

const (
	ModeReady    Mode = "READY"
	ModeDegraded Mode = "DEGRADED"
	ModeBlocked  Mode = "BLOCKED"
)

type DependencyAssessment struct {
	Mode       Mode     `json:"mode"`
	Unavailable []string `json:"unavailable,omitempty"`
	CanBrowse  bool     `json:"canBrowse"`
	CanServeCanonical bool `json:"canServeCanonical"`
	CanVerify  bool     `json:"canVerify"`
	Disclaimer string   `json:"disclaimer"`
}

func AssessDependencies(d Dependencies) DependencyAssessment {
	missing := make([]string, 0, 5)
	if !d.Registry { missing = append(missing, "registry") }
	if !d.RPC { missing = append(missing, "rpc") }
	if !d.Search { missing = append(missing, "search") }
	if !d.Verify { missing = append(missing, "verify") }
	if !d.Store { missing = append(missing, "store") }

	if !d.Registry || !d.RPC {
		return DependencyAssessment{
			Mode: ModeBlocked, Unavailable: missing, CanBrowse: d.Store,
			CanServeCanonical: false, CanVerify: false,
			Disclaimer: "Canonical Registry/RPC dependencies are unavailable. AppStore must not present stale catalogue fields as current canonical state.",
		}
	}
	if len(missing) > 0 {
		return DependencyAssessment{
			Mode: ModeDegraded, Unavailable: missing, CanBrowse: d.Store,
			CanServeCanonical: true, CanVerify: d.Verify,
			Disclaimer: "AppStore is operating in degraded mode; unavailable non-authoritative services are omitted rather than fabricated.",
		}
	}
	return DependencyAssessment{Mode: ModeReady, CanBrowse: true, CanServeCanonical: true, CanVerify: true}
}

// Limiter is an in-memory per-key fixed-window limiter intended for the public
// discovery API. It never uses wallet/account identifiers and therefore does
// not create public installation or launch history.
type Limiter struct {
	mu sync.Mutex
	limit int
	window time.Duration
	entries map[string]entry
}

type entry struct {
	start time.Time
	count int
}

func NewLimiter(limit int, window time.Duration) *Limiter {
	if limit < 1 { limit = 1 }
	if window <= 0 { window = time.Minute }
	return &Limiter{limit: limit, window: window, entries: map[string]entry{}}
}

func (l *Limiter) Allow(key string, now time.Time) bool {
	key = strings.TrimSpace(key)
	if key == "" { return false }
	l.mu.Lock()
	defer l.mu.Unlock()
	e := l.entries[key]
	if e.start.IsZero() || now.Sub(e.start) >= l.window {
		l.entries[key] = entry{start: now, count: 1}
		return true
	}
	if e.count >= l.limit { return false }
	e.count++
	l.entries[key] = e
	return true
}
