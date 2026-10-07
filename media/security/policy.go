package security

import (
	"context"
	"errors"
	"net"
	"net/url"
	"strings"
	"sync"
	"time"
)

var (
	ErrInvalidEndpoint    = errors.New("420media security: invalid outbound endpoint")
	ErrUnsafeEndpoint     = errors.New("420media security: unsafe outbound endpoint")
	ErrRateLimited        = errors.New("420media security: rate limited")
	ErrInvalidMedia       = errors.New("420media security: invalid media metadata")
	ErrScannerUnavailable = errors.New("420media security: content scanner unavailable")
	ErrContentQuarantined = errors.New("420media security: content quarantined")
	ErrContentRejected    = errors.New("420media security: content rejected")
)

type IPResolver interface {
	LookupIPAddr(context.Context, string) ([]net.IPAddr, error)
}

func ValidateOutboundEndpoint(raw string, allowedSchemes ...string) error {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" || u.User != nil || u.Fragment != "" {
		return ErrInvalidEndpoint
	}
	allowed := false
	for _, scheme := range allowedSchemes {
		if strings.EqualFold(u.Scheme, scheme) {
			allowed = true
			break
		}
	}
	if !allowed {
		return ErrInvalidEndpoint
	}
	host := strings.ToLower(strings.TrimSuffix(u.Hostname(), "."))
	if host == "" || host == "localhost" || strings.HasSuffix(host, ".localhost") || strings.HasSuffix(host, ".local") {
		return ErrUnsafeEndpoint
	}
	if ip := net.ParseIP(host); ip != nil && unsafeIP(ip) {
		return ErrUnsafeEndpoint
	}
	return nil
}

func ValidateResolvedEndpoint(ctx context.Context, raw string, resolver IPResolver, allowedSchemes ...string) error {
	if err := ValidateOutboundEndpoint(raw, allowedSchemes...); err != nil {
		return err
	}
	if resolver == nil {
		return ErrUnsafeEndpoint
	}
	u, _ := url.Parse(strings.TrimSpace(raw))
	addrs, err := resolver.LookupIPAddr(ctx, u.Hostname())
	if err != nil || len(addrs) == 0 {
		return ErrUnsafeEndpoint
	}
	for _, addr := range addrs {
		if unsafeIP(addr.IP) {
			return ErrUnsafeEndpoint
		}
	}
	return nil
}

func unsafeIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	return ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast()
}

type rateWindow struct {
	start time.Time
	used  int
}

type RateLimiter struct {
	mu      sync.Mutex
	limit   int
	window  time.Duration
	now     func() time.Time
	windows map[string]rateWindow
}

func NewRateLimiter(limit int, window time.Duration) (*RateLimiter, error) {
	if limit <= 0 || window <= 0 {
		return nil, errors.New("420media security: invalid rate-limit policy")
	}
	return &RateLimiter{limit: limit, window: window, now: time.Now, windows: make(map[string]rateWindow)}, nil
}

func (l *RateLimiter) Allow(key string) (bool, int, time.Time) {
	if l == nil || strings.TrimSpace(key) == "" {
		return false, 0, time.Time{}
	}
	l.mu.Lock()
	defer l.mu.Unlock()
	now := l.now().UTC()
	entry := l.windows[key]
	if entry.start.IsZero() || !now.Before(entry.start.Add(l.window)) {
		entry = rateWindow{start: now}
	}
	reset := entry.start.Add(l.window)
	if entry.used >= l.limit {
		l.windows[key] = entry
		return false, 0, reset
	}
	entry.used++
	l.windows[key] = entry
	return true, l.limit - entry.used, reset
}

type ContentPolicy struct {
	MaxUploadBytes uint64
}

func DefaultContentPolicy() ContentPolicy {
	return ContentPolicy{MaxUploadBytes: 8 << 30}
}

func (p ContentPolicy) Validate(mime string, size uint64) error {
	if p.MaxUploadBytes == 0 {
		p = DefaultContentPolicy()
	}
	mime = strings.ToLower(strings.TrimSpace(strings.Split(mime, ";")[0]))
	if !strings.HasPrefix(mime, "video/") || size == 0 || size > p.MaxUploadBytes {
		return ErrInvalidMedia
	}
	return nil
}

type Inspection struct {
	AssetID   string
	MimeType  string
	SizeBytes uint64
	SHA256    string
	SourceRef string
}

type ScanVerdict string

const (
	ScanClean      ScanVerdict = "CLEAN"
	ScanQuarantine ScanVerdict = "QUARANTINE"
	ScanReject     ScanVerdict = "REJECT"
)

type ScanResult struct {
	Verdict   ScanVerdict
	Reason    string
	ScannerID string
}

type Scanner interface {
	Scan(context.Context, Inspection) (ScanResult, error)
}

type QuarantineGate struct {
	Policy  ContentPolicy
	Scanner Scanner
}

func (g QuarantineGate) Inspect(ctx context.Context, item Inspection) (ScanResult, error) {
	if strings.TrimSpace(item.AssetID) == "" || strings.TrimSpace(item.SourceRef) == "" ||
		len(strings.TrimSpace(item.SHA256)) != 64 || g.Policy.Validate(item.MimeType, item.SizeBytes) != nil {
		return ScanResult{}, ErrInvalidMedia
	}
	if g.Scanner == nil {
		return ScanResult{}, ErrScannerUnavailable
	}
	result, err := g.Scanner.Scan(ctx, item)
	if err != nil {
		return ScanResult{}, err
	}
	switch result.Verdict {
	case ScanClean:
		if strings.TrimSpace(result.ScannerID) == "" {
			return ScanResult{}, ErrScannerUnavailable
		}
		return result, nil
	case ScanQuarantine:
		return result, ErrContentQuarantined
	case ScanReject:
		return result, ErrContentRejected
	default:
		return ScanResult{}, ErrScannerUnavailable
	}
}
