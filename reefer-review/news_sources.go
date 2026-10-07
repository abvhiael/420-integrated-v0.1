package reeferreview

import (
	"encoding/json"
	"fmt"
	"net/url"
	"os"
	"strings"
)

func LoadNewsSourceRegistry(path string) (NewsSourceRegistry, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return NewsSourceRegistry{}, err
	}
	var registry NewsSourceRegistry
	if err := json.Unmarshal(b, &registry); err != nil {
		return NewsSourceRegistry{}, err
	}
	if err := ValidateNewsSourceRegistry(registry); err != nil {
		return NewsSourceRegistry{}, err
	}
	return registry, nil
}

func ValidateNewsSourceRegistry(registry NewsSourceRegistry) error {
	if registry.Schema != "420-reefer-review-news-sources-v1" {
		return fmt.Errorf("%w: wrong news source registry schema", ErrInvalidInput)
	}
	ids := map[string]struct{}{}
	feeds := map[string]struct{}{}
	for _, source := range registry.Sources {
		source.ID = strings.TrimSpace(source.ID)
		source.Name = strings.TrimSpace(source.Name)
		if source.ID == "" || source.Name == "" || strings.TrimSpace(source.Attribution) == "" {
			return fmt.Errorf("%w: incomplete news source", ErrInvalidInput)
		}
		if _, ok := ids[source.ID]; ok {
			return fmt.Errorf("%w: duplicate news source id %s", ErrConflict, source.ID)
		}
		ids[source.ID] = struct{}{}
		feed, err := canonicalNewsURL(source.FeedURL)
		if err != nil || !strings.HasPrefix(feed, "https://") {
			return fmt.Errorf("%w: news source feed must use https", ErrInvalidInput)
		}
		parsedFeed, err := url.Parse(feed)
		if err != nil || validateFeedEndpoint(parsedFeed) != nil {
			return fmt.Errorf("%w: news source feed must use https", ErrInvalidInput)
		}
		home, err := canonicalNewsURL(source.HomeURL)
		if err != nil || !strings.HasPrefix(home, "https://") {
			return fmt.Errorf("%w: news source home must use https", ErrInvalidInput)
		}
		if _, ok := feeds[feed]; ok {
			return fmt.Errorf("%w: duplicate news feed url", ErrConflict)
		}
		feeds[feed] = struct{}{}
		if source.PollIntervalMinutes < 5 {
			return fmt.Errorf("%w: poll interval too short", ErrInvalidInput)
		}
	}
	return nil
}

func (registry NewsSourceRegistry) EnabledSources() []NewsSource {
	out := make([]NewsSource, 0, len(registry.Sources))
	for _, source := range registry.Sources {
		if source.Enabled {
			out = append(out, source)
		}
	}
	return out
}

func (registry NewsSourceRegistry) PublicSources() []map[string]any {
	out := make([]map[string]any, 0, len(registry.Sources))
	for _, source := range registry.Sources {
		if !source.Enabled {
			continue
		}
		out = append(out, map[string]any{
			"id": source.ID, "name": source.Name, "home_url": source.HomeURL,
			"category": source.Category, "language": source.Language,
			"attribution": source.Attribution,
		})
	}
	return out
}
