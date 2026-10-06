package config

import "fmt"

const (
	ServiceID   = "420/service/town/v1"
	ServiceName = "420Town Community Boards"
	Role        = "GENESIS_FACING_UPDATE"
	Target      = "communities_posts_threads_comments_votes_moderation"
)

var DirectDependencies = []string{
	"420 Identity",
	"420 Search",
	"420 Notifications",
	"420 Storage",
}

type Config struct {
	ServiceID    string
	Environment  string
	ChainID      string
	Dependencies map[string]string
}

func Canonical(environment, chainID string) Config {
	return Config{
		ServiceID:   ServiceID,
		Environment: environment,
		ChainID:     chainID,
		Dependencies: map[string]string{
			"identity":      "420 Identity",
			"search":        "420 Search",
			"notifications": "420 Notifications",
			"storage":       "420 Storage",
		},
	}
}

func (c Config) Validate() error {
	if c.ServiceID != ServiceID {
		return fmt.Errorf("unexpected service id %q", c.ServiceID)
	}
	if c.Environment == "" {
		return fmt.Errorf("environment is required")
	}
	for key, want := range map[string]string{
		"identity": "420 Identity",
		"search": "420 Search",
		"notifications": "420 Notifications",
		"storage": "420 Storage",
	} {
		if c.Dependencies[key] != want {
			return fmt.Errorf("dependency %s must resolve to %q", key, want)
		}
	}
	return nil
}
