package reeferreview

import (
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"sort"
	"strings"
	"time"
)

type NewsStatus string

const (
	NewsDiscovered NewsStatus = "DISCOVERED"
	NewsAccepted   NewsStatus = "ACCEPTED"
	NewsVisible    NewsStatus = "VISIBLE"
	NewsRejected   NewsStatus = "REJECTED"
	NewsHidden     NewsStatus = "HIDDEN"
	NewsExpired    NewsStatus = "EXPIRED"
)

type ExternalNewsItem struct {
	ID                 string     `json:"id"`
	SourceID           string     `json:"source_id"`
	SourceName         string     `json:"source_name"`
	SourceHomeURL      string     `json:"source_home_url"`
	CanonicalURL       string     `json:"canonical_url"`
	Title              string     `json:"title"`
	Author             string     `json:"author,omitempty"`
	Summary            string     `json:"summary,omitempty"`
	ImageURL           string     `json:"image_url,omitempty"`
	Categories         []string   `json:"categories,omitempty"`
	Topics             []string   `json:"topics,omitempty"`
	Language           string     `json:"language,omitempty"`
	FeedGUID           string     `json:"feed_guid,omitempty"`
	CanonicalURLHash   string     `json:"canonical_url_hash"`
	ContentFingerprint string     `json:"content_fingerprint"`
	Attribution        string     `json:"attribution"`
	Status             NewsStatus `json:"status"`
	PublishedAt        *time.Time `json:"published_at,omitempty"`
	DiscoveredAt       time.Time  `json:"discovered_at"`
	LastSeenAt         time.Time  `json:"last_seen_at"`
}

type NewsSource struct {
	ID                  string `json:"id"`
	Name                string `json:"name"`
	FeedURL             string `json:"feed_url"`
	HomeURL             string `json:"home_url"`
	Enabled             bool   `json:"enabled"`
	Category            string `json:"category"`
	Language            string `json:"language"`
	PollIntervalMinutes int    `json:"poll_interval_minutes"`
	AllowExcerpt        bool   `json:"allow_excerpt"`
	AllowImage          bool   `json:"allow_image"`
	Attribution         string `json:"attribution"`
}

type NewsSourceRegistry struct {
	Schema  string       `json:"schema"`
	Sources []NewsSource `json:"sources"`
}

type RawNewsEntry struct {
	Title       string
	URL         string
	GUID        string
	Author      string
	Summary     string
	ImageURL    string
	Categories  []string
	PublishedAt *time.Time
}

type NewsListOptions struct {
	Limit  int
	Cursor string
	Source string
	Topic  string
	Query  string
}

type NewsPage struct {
	Items      []ExternalNewsItem `json:"items"`
	NextCursor string             `json:"next_cursor"`
}

type NewsIngestStats struct {
	SourceID  string `json:"source_id"`
	Fetched   int    `json:"fetched"`
	Visible   int    `json:"visible"`
	Rejected  int    `json:"rejected"`
	Inserted  int    `json:"inserted"`
	Updated   int    `json:"updated"`
	Duplicate int    `json:"duplicate"`
}

var trackingParams = map[string]struct{}{
	"fbclid": {}, "gclid": {}, "mc_cid": {}, "mc_eid": {},
}

func canonicalNewsURL(raw string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || u.Scheme == "" || u.Host == "" {
		return "", ErrInvalidInput
	}
	u.Scheme = strings.ToLower(u.Scheme)
	if u.Scheme != "http" && u.Scheme != "https" {
		return "", ErrInvalidInput
	}
	u.Host = strings.ToLower(u.Host)
	u.Fragment = ""
	q := u.Query()
	for key := range q {
		lower := strings.ToLower(key)
		if strings.HasPrefix(lower, "utm_") {
			q.Del(key)
			continue
		}
		if _, ok := trackingParams[lower]; ok {
			q.Del(key)
		}
	}
	u.RawQuery = q.Encode()
	if u.Path == "" {
		u.Path = "/"
	}
	return u.String(), nil
}

func newsURLHash(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return hex.EncodeToString(sum[:])
}

func stableNewsID(canonical string) string {
	sum := sha256.Sum256([]byte(canonical))
	return "news_" + hex.EncodeToString(sum[:12])
}

func newsContentFingerprint(title, summary string, published *time.Time) string {
	stamp := ""
	if published != nil {
		stamp = published.UTC().Format(time.RFC3339Nano)
	}
	sum := sha256.Sum256([]byte(strings.TrimSpace(title) + "\x00" + strings.TrimSpace(summary) + "\x00" + stamp))
	return hex.EncodeToString(sum[:])
}

func normalizeStringSlice(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, v := range values {
		v = strings.TrimSpace(v)
		if v == "" {
			continue
		}
		k := strings.ToLower(v)
		if _, ok := seen[k]; ok {
			continue
		}
		seen[k] = struct{}{}
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	return out
}

func effectiveNewsTime(item ExternalNewsItem) time.Time {
	if item.PublishedAt != nil && !item.PublishedAt.IsZero() {
		return item.PublishedAt.UTC()
	}
	return item.DiscoveredAt.UTC()
}
