package reeferreview

import (
	"bytes"
	"context"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"net/http"
	"regexp"
	"sort"
	"strings"
	"time"
)

const defaultMaxFeedBytes int64 = 2 << 20

type FeedFetcher struct {
	HTTP     *http.Client
	MaxBytes int64
}

type rssDocument struct {
	XMLName xml.Name   `xml:"rss"`
	Channel rssChannel `xml:"channel"`
}
type rssChannel struct {
	Title string    `xml:"title"`
	Link  string    `xml:"link"`
	Items []rssItem `xml:"item"`
}
type rssItem struct {
	Title       string         `xml:"title"`
	Link        string         `xml:"link"`
	GUID        string         `xml:"guid"`
	Author      string         `xml:"author"`
	Creator     string         `xml:"creator"`
	Description string         `xml:"description"`
	PubDate     string         `xml:"pubDate"`
	Categories  []string       `xml:"category"`
	Enclosure   rssEnclosure   `xml:"enclosure"`
	Media       rssMedia       `xml:"content"`
}
type rssEnclosure struct {
	URL  string `xml:"url,attr"`
	Type string `xml:"type,attr"`
}
type rssMedia struct {
	URL string `xml:"url,attr"`
}

type atomDocument struct {
	XMLName xml.Name    `xml:"feed"`
	Title   string      `xml:"title"`
	Entries []atomEntry `xml:"entry"`
}
type atomEntry struct {
	Title      string         `xml:"title"`
	ID         string         `xml:"id"`
	Summary    string         `xml:"summary"`
	Content    string         `xml:"content"`
	Published  string         `xml:"published"`
	Updated    string         `xml:"updated"`
	Author     atomAuthor     `xml:"author"`
	Links      []atomLink     `xml:"link"`
	Categories []atomCategory `xml:"category"`
}
type atomAuthor struct {
	Name string `xml:"name"`
}
type atomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
	Type string `xml:"type,attr"`
}
type atomCategory struct {
	Term string `xml:"term,attr"`
}

func (f FeedFetcher) Fetch(ctx context.Context, source NewsSource) ([]RawNewsEntry, error) {
	feedURL, err := canonicalNewsURL(source.FeedURL)
	if err != nil || !strings.HasPrefix(feedURL, "https://") {
		return nil, fmt.Errorf("%w: feed url", ErrInvalidInput)
	}
	hc := f.HTTP
	if hc == nil {
		hc = &http.Client{Timeout: 15 * time.Second}
	}
	max := f.MaxBytes
	if max <= 0 {
		max = defaultMaxFeedBytes
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, feedURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9")
	req.Header.Set("User-Agent", "420Integrated-ReeferReview/1.0")
	resp, err := hc.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("feed http %d", resp.StatusCode)
	}
	lr := &io.LimitedReader{R: resp.Body, N: max + 1}
	b, err := io.ReadAll(lr)
	if err != nil {
		return nil, err
	}
	if int64(len(b)) > max {
		return nil, fmt.Errorf("%w: feed too large", ErrInvalidInput)
	}
	return ParseNewsFeed(b)
}

func ParseNewsFeed(b []byte) ([]RawNewsEntry, error) {
	upper := bytes.ToUpper(b)
	if bytes.Contains(upper, []byte("<!DOCTYPE")) || bytes.Contains(upper, []byte("<!ENTITY")) {
		return nil, fmt.Errorf("%w: disallowed xml declaration", ErrInvalidInput)
	}
	var root struct{ XMLName xml.Name }
	if err := xml.Unmarshal(b, &root); err != nil {
		return nil, err
	}
	switch strings.ToLower(root.XMLName.Local) {
	case "rss":
		var doc rssDocument
		if err := xml.Unmarshal(b, &doc); err != nil {
			return nil, err
		}
		out := make([]RawNewsEntry, 0, len(doc.Channel.Items))
		for _, item := range doc.Channel.Items {
			author := strings.TrimSpace(item.Author)
			if author == "" {
				author = strings.TrimSpace(item.Creator)
			}
			image := ""
			if strings.HasPrefix(strings.ToLower(item.Enclosure.Type), "image/") {
				image = item.Enclosure.URL
			}
			if image == "" {
				image = item.Media.URL
			}
			out = append(out, RawNewsEntry{
				Title: strings.TrimSpace(item.Title), URL: strings.TrimSpace(item.Link),
				GUID: strings.TrimSpace(item.GUID), Author: author,
				Summary: cleanFeedText(item.Description), ImageURL: strings.TrimSpace(image),
				Categories: normalizeStringSlice(item.Categories), PublishedAt: parseFeedTime(item.PubDate),
			})
		}
		return out, nil
	case "feed":
		var doc atomDocument
		if err := xml.Unmarshal(b, &doc); err != nil {
			return nil, err
		}
		out := make([]RawNewsEntry, 0, len(doc.Entries))
		for _, item := range doc.Entries {
			link, image := "", ""
			for _, l := range item.Links {
				rel := strings.ToLower(strings.TrimSpace(l.Rel))
				if (rel == "" || rel == "alternate") && link == "" {
					link = l.Href
				}
				if rel == "enclosure" && strings.HasPrefix(strings.ToLower(l.Type), "image/") && image == "" {
					image = l.Href
				}
			}
			summary := item.Summary
			if strings.TrimSpace(summary) == "" {
				summary = item.Content
			}
			cats := make([]string, 0, len(item.Categories))
			for _, c := range item.Categories {
				cats = append(cats, c.Term)
			}
			published := parseFeedTime(item.Published)
			if published == nil {
				published = parseFeedTime(item.Updated)
			}
			out = append(out, RawNewsEntry{
				Title: strings.TrimSpace(item.Title), URL: strings.TrimSpace(link),
				GUID: strings.TrimSpace(item.ID), Author: strings.TrimSpace(item.Author.Name),
				Summary: cleanFeedText(summary), ImageURL: strings.TrimSpace(image),
				Categories: normalizeStringSlice(cats), PublishedAt: published,
			})
		}
		return out, nil
	default:
		return nil, fmt.Errorf("%w: unsupported feed format %s", ErrInvalidInput, root.XMLName.Local)
	}
}

var tagPattern = regexp.MustCompile(`(?s)<[^>]*>`)
var whitespacePattern = regexp.MustCompile(`\s+`)

func cleanFeedText(value string) string {
	value = tagPattern.ReplaceAllString(value, " ")
	value = html.UnescapeString(value)
	value = whitespacePattern.ReplaceAllString(value, " ")
	value = strings.TrimSpace(value)
	const max = 1200
	if len(value) > max {
		value = strings.TrimSpace(value[:max])
	}
	return value
}

func parseFeedTime(value string) *time.Time {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	layouts := []string{time.RFC3339Nano, time.RFC3339, time.RFC1123Z, time.RFC1123, time.RFC822Z, time.RFC822}
	for _, layout := range layouts {
		if t, err := time.Parse(layout, value); err == nil {
			t = t.UTC()
			return &t
		}
	}
	return nil
}

var cannabisKeywords = []string{
	"cannabis", "marijuana", "marihuana", "hemp", "cannabinoid", "cannabinoids",
	"thc", "cbd", "dispensary", "dispensaries", "legalization", "legalisation",
	"weed", "hashish", "terpene", "terpenes", "cultivation", "edibles",
}

func cannabisRelevant(entry RawNewsEntry) bool {
	hay := strings.ToLower(entry.Title + "\n" + entry.Summary + "\n" + strings.Join(entry.Categories, " "))
	for _, keyword := range cannabisKeywords {
		if containsWordish(hay, keyword) {
			return true
		}
	}
	return false
}

func containsWordish(hay, needle string) bool {
	for start := 0; ; {
		i := strings.Index(hay[start:], needle)
		if i < 0 {
			return false
		}
		i += start
		beforeOK := i == 0 || !isAlphaNum(hay[i-1])
		end := i + len(needle)
		afterOK := end == len(hay) || !isAlphaNum(hay[end])
		if beforeOK && afterOK {
			return true
		}
		start = i + 1
	}
}

func isAlphaNum(b byte) bool {
	return (b >= 'a' && b <= 'z') || (b >= 'A' && b <= 'Z') || (b >= '0' && b <= '9') || b == '_'
}

func classifyNewsTopics(entry RawNewsEntry) []string {
	hay := strings.ToLower(entry.Title + "\n" + entry.Summary + "\n" + strings.Join(entry.Categories, " "))
	rules := map[string][]string{
		"policy":      {"legalization", "legalisation", "regulation", "law", "bill", "congress", "senate", "government", "policy"},
		"medical":     {"medical", "patient", "health", "clinical", "therapy", "therapeutic"},
		"science":     {"research", "study", "science", "cannabinoid", "thc", "cbd"},
		"industry":    {"business", "market", "company", "companies", "sales", "dispensary", "retail"},
		"cultivation": {"cultivation", "cultivator", "grower", "greenhouse", "harvest"},
		"hemp":        {"hemp"},
		"culture":     {"culture", "lifestyle", "music", "film", "festival"},
	}
	out := []string{}
	for topic, words := range rules {
		for _, word := range words {
			if containsWordish(hay, word) {
				out = append(out, topic)
				break
			}
		}
	}
	if len(out) == 0 {
		out = append(out, "cannabis")
	}
	sort.Strings(out)
	return out
}

type NewsIngestor struct {
	Store   NewsRepository
	Fetcher FeedFetcher
	Now     func() time.Time
}

func (n NewsIngestor) SyncSource(ctx context.Context, source NewsSource) (NewsIngestStats, error) {
	if n.Store == nil {
		return NewsIngestStats{}, errorsNew("news store unavailable")
	}
	entries, err := n.Fetcher.Fetch(ctx, source)
	if err != nil {
		return NewsIngestStats{}, err
	}
	now := time.Now().UTC()
	if n.Now != nil {
		now = n.Now().UTC()
	}
	items := make([]ExternalNewsItem, 0, len(entries))
	for _, entry := range entries {
		item, err := normalizeNewsEntry(source, entry, now)
		if err != nil {
			continue
		}
		items = append(items, item)
	}
	stats, err := n.Store.UpsertMany(ctx, items)
	stats.SourceID = source.ID
	return stats, err
}

func normalizeNewsEntry(source NewsSource, entry RawNewsEntry, now time.Time) (ExternalNewsItem, error) {
	canonical, err := canonicalNewsURL(entry.URL)
	if err != nil || strings.TrimSpace(entry.Title) == "" {
		return ExternalNewsItem{}, ErrInvalidInput
	}
	summary := ""
	if source.AllowExcerpt {
		summary = cleanFeedText(entry.Summary)
	}
	image := ""
	if source.AllowImage {
		if u, e := canonicalNewsURL(entry.ImageURL); e == nil && strings.HasPrefix(u, "https://") {
			image = u
		}
	}
	status := NewsVisible
	if !cannabisRelevant(entry) {
		status = NewsRejected
	}
	item := ExternalNewsItem{
		ID: stableNewsID(canonical), SourceID: source.ID, SourceName: source.Name,
		SourceHomeURL: source.HomeURL, CanonicalURL: canonical, Title: strings.TrimSpace(entry.Title),
		Author: strings.TrimSpace(entry.Author), Summary: summary, ImageURL: image,
		Categories: normalizeStringSlice(entry.Categories), Topics: classifyNewsTopics(entry),
		Language: source.Language, FeedGUID: strings.TrimSpace(entry.GUID),
		CanonicalURLHash: newsURLHash(canonical),
		ContentFingerprint: newsContentFingerprint(entry.Title, summary, entry.PublishedAt),
		Attribution: source.Attribution, Status: status, PublishedAt: entry.PublishedAt,
		DiscoveredAt: now, LastSeenAt: now,
	}
	return item, nil
}

func errorsNew(message string) error {
	return fmt.Errorf("%s", message)
}
