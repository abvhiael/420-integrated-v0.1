package config

import "testing"

func TestCanonicalConfig(t *testing.T) {
	cfg := Canonical("test", "420")
	if err := cfg.Validate(); err != nil {
		t.Fatal(err)
	}
	if cfg.ServiceID != ServiceID || ServiceName != "420Town Community Boards" {
		t.Fatal("canonical Town service identity drifted")
	}
	if Role != "GENESIS_FACING_UPDATE" || Target != "communities_posts_threads_comments_votes_moderation" {
		t.Fatal("canonical Town service classification drifted")
	}
}

func TestConfigFailsClosedOnDependencySubstitution(t *testing.T) {
	cfg := Canonical("test", "420")
	cfg.Dependencies["identity"] = "local-database"
	if err := cfg.Validate(); err == nil {
		t.Fatal("expected non-canonical authority dependency to fail validation")
	}
}
