package reeferreview

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type NewsRepository interface {
	UpsertMany(context.Context, []ExternalNewsItem) (NewsIngestStats, error)
	Get(context.Context, string) (ExternalNewsItem, error)
	List(context.Context, NewsListOptions) (NewsPage, error)
	Topics(context.Context) ([]string, error)
}

type FileNewsStore struct {
	mu    sync.RWMutex
	path  string
	items map[string]ExternalNewsItem
}

type newsDiskState struct {
	Schema string                      `json:"schema"`
	Items  map[string]ExternalNewsItem `json:"items"`
}

func OpenFileNewsStore(path string) (*FileNewsStore, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return nil, ErrInvalidInput
	}
	store := &FileNewsStore{path: path, items: map[string]ExternalNewsItem{}}
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return store, nil
	}
	if err != nil {
		return nil, err
	}
	var state newsDiskState
	if err := json.Unmarshal(b, &state); err != nil {
		return nil, err
	}
	if state.Schema != "420-reefer-review-news-store-v1" {
		return nil, ErrInvalidInput
	}
	if state.Items != nil {
		store.items = state.Items
	}
	return store, nil
}

func (s *FileNewsStore) persistLocked() error {
	dir := filepath.Dir(s.path)
	if dir != "." {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	state := newsDiskState{Schema: "420-reefer-review-news-store-v1", Items: s.items}
	b, err := json.MarshalIndent(state, "", "  ")
	if err != nil {
		return err
	}
	b = append(b, '\n')
	tmp := s.path + ".tmp"
	if err := os.WriteFile(tmp, b, 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, s.path)
}

func (s *FileNewsStore) UpsertMany(ctx context.Context, incoming []ExternalNewsItem) (NewsIngestStats, error) {
	select {
	case <-ctx.Done():
		return NewsIngestStats{}, ctx.Err()
	default:
	}
	s.mu.Lock()
	defer s.mu.Unlock()

	stats := NewsIngestStats{}
	guidIndex := map[string]string{}
	for id, item := range s.items {
		if item.SourceID != "" && item.FeedGUID != "" {
			guidIndex[item.SourceID+"\x00"+item.FeedGUID] = id
		}
	}
	for _, item := range incoming {
		if stats.SourceID == "" {
			stats.SourceID = item.SourceID
		}
		stats.Fetched++
		if item.Status == NewsRejected {
			stats.Rejected++
		} else if item.Status == NewsVisible {
			stats.Visible++
		}
		if item.FeedGUID != "" {
			if oldID, ok := guidIndex[item.SourceID+"\x00"+item.FeedGUID]; ok && oldID != item.ID {
				item.ID = oldID
				stats.Duplicate++
			}
		}
		if old, ok := s.items[item.ID]; ok {
			item.DiscoveredAt = old.DiscoveredAt
			if old.Status == NewsHidden {
				item.Status = NewsHidden
			}
			if item.LastSeenAt.Before(old.LastSeenAt) {
				item.LastSeenAt = old.LastSeenAt
			}
			s.items[item.ID] = item
			stats.Updated++
			continue
		}
		s.items[item.ID] = item
		stats.Inserted++
		if item.FeedGUID != "" {
			guidIndex[item.SourceID+"\x00"+item.FeedGUID] = item.ID
		}
	}
	if err := s.persistLocked(); err != nil {
		return NewsIngestStats{}, err
	}
	return stats, nil
}

func (s *FileNewsStore) Get(ctx context.Context, id string) (ExternalNewsItem, error) {
	select {
	case <-ctx.Done():
		return ExternalNewsItem{}, ctx.Err()
	default:
	}
	s.mu.RLock()
	defer s.mu.RUnlock()
	item, ok := s.items[id]
	if !ok || item.Status != NewsVisible {
		return ExternalNewsItem{}, ErrNotFound
	}
	return item, nil
}

type newsCursor struct {
	TimeNS     int64  `json:"t"`
	ID         string `json:"id"`
	FilterHash string `json:"f"`
}

func newsFilterHash(opts NewsListOptions) string {
	sum := sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(opts.Source)) + "\x00" +
		strings.ToLower(strings.TrimSpace(opts.Topic)) + "\x00" +
		strings.ToLower(strings.TrimSpace(opts.Query))))
	return hex.EncodeToString(sum[:8])
}

func encodeNewsCursor(c newsCursor) string {
	b, _ := json.Marshal(c)
	return base64.RawURLEncoding.EncodeToString(b)
}

func decodeNewsCursor(raw string) (newsCursor, error) {
	if strings.TrimSpace(raw) == "" {
		return newsCursor{}, nil
	}
	b, err := base64.RawURLEncoding.DecodeString(raw)
	if err != nil {
		return newsCursor{}, ErrInvalidInput
	}
	var c newsCursor
	if err := json.Unmarshal(b, &c); err != nil || c.TimeNS <= 0 || c.ID == "" || c.FilterHash == "" {
		return newsCursor{}, ErrInvalidInput
	}
	return c, nil
}

func newsMatches(item ExternalNewsItem, opts NewsListOptions) bool {
	if item.Status != NewsVisible {
		return false
	}
	if opts.Source != "" && !strings.EqualFold(item.SourceID, strings.TrimSpace(opts.Source)) {
		return false
	}
	if opts.Topic != "" {
		found := false
		for _, topic := range item.Topics {
			if strings.EqualFold(topic, strings.TrimSpace(opts.Topic)) {
				found = true
				break
			}
		}
		if !found {
			return false
		}
	}
	q := strings.ToLower(strings.TrimSpace(opts.Query))
	if q != "" {
		hay := strings.ToLower(item.Title + "\n" + item.Summary + "\n" + item.SourceName + "\n" + strings.Join(item.Topics, " "))
		if !strings.Contains(hay, q) {
			return false
		}
	}
	return true
}

func (s *FileNewsStore) List(ctx context.Context, opts NewsListOptions) (NewsPage, error) {
	if opts.Limit == 0 {
		opts.Limit = 20
	}
	if opts.Limit < 1 || opts.Limit > 100 {
		return NewsPage{}, ErrInvalidInput
	}
	cursor, err := decodeNewsCursor(opts.Cursor)
	if err != nil {
		return NewsPage{}, err
	}
	filterHash := newsFilterHash(opts)
	if cursor.FilterHash != "" && cursor.FilterHash != filterHash {
		return NewsPage{}, ErrInvalidInput
	}

	s.mu.RLock()
	rows := make([]ExternalNewsItem, 0, len(s.items))
	for _, item := range s.items {
		if newsMatches(item, opts) {
			rows = append(rows, item)
		}
	}
	s.mu.RUnlock()

	sort.Slice(rows, func(i, j int) bool {
		ti, tj := effectiveNewsTime(rows[i]), effectiveNewsTime(rows[j])
		if ti.Equal(tj) {
			return rows[i].ID < rows[j].ID
		}
		return ti.After(tj)
	})

	start := 0
	if cursor.ID != "" {
		found := false
		for i, item := range rows {
			t := effectiveNewsTime(item).UnixNano()
			if t < cursor.TimeNS || (t == cursor.TimeNS && item.ID > cursor.ID) {
				start = i
				found = true
				break
			}
		}
		if !found {
			start = len(rows)
		}
	}

	end := start + opts.Limit
	if end > len(rows) {
		end = len(rows)
	}
	page := append([]ExternalNewsItem(nil), rows[start:end]...)
	next := ""
	if end < len(rows) && len(page) > 0 {
		last := page[len(page)-1]
		next = encodeNewsCursor(newsCursor{
			TimeNS: effectiveNewsTime(last).UnixNano(), ID: last.ID, FilterHash: filterHash,
		})
	}
	select {
	case <-ctx.Done():
		return NewsPage{}, ctx.Err()
	default:
		return NewsPage{Items: page, NextCursor: next}, nil
	}
}

func (s *FileNewsStore) Topics(ctx context.Context) ([]string, error) {
	s.mu.RLock()
	set := map[string]string{}
	for _, item := range s.items {
		if item.Status != NewsVisible {
			continue
		}
		for _, topic := range item.Topics {
			k := strings.ToLower(topic)
			if _, ok := set[k]; !ok {
				set[k] = topic
			}
		}
	}
	s.mu.RUnlock()
	out := make([]string, 0, len(set))
	for _, topic := range set {
		out = append(out, topic)
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i]) < strings.ToLower(out[j]) })
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	default:
		return out, nil
	}
}

func newStoreItemForTest(id string, at time.Time) ExternalNewsItem {
	return ExternalNewsItem{ID: id, Status: NewsVisible, DiscoveredAt: at, LastSeenAt: at}
}
