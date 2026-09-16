package compiler

import (
	"errors"
	"fmt"
	"path/filepath"
	"strings"
)

type Release struct {
	Version string `json:"version"`
	SHA256  string `json:"sha256"`
	Binary  string `json:"binary"`
}

type Catalog struct {
	cacheRoot string
	releases  map[string]Release
}

func NewCatalog(cacheRoot string, releases []Release) (*Catalog, error) {
	if strings.TrimSpace(cacheRoot) == "" {
		return nil, errors.New("compiler cache root is required")
	}
	if len(releases) == 0 {
		return nil, errors.New("compiler catalogue must not be empty")
	}
	m := make(map[string]Release, len(releases))
	for _, r := range releases {
		if strings.TrimSpace(r.Version) == "" || strings.TrimSpace(r.SHA256) == "" || strings.TrimSpace(r.Binary) == "" {
			return nil, errors.New("compiler release requires version, sha256 and binary")
		}
		if _, exists := m[r.Version]; exists {
			return nil, fmt.Errorf("duplicate compiler version %s", r.Version)
		}
		m[r.Version] = r
	}
	return &Catalog{cacheRoot: cacheRoot, releases: m}, nil
}

func (c *Catalog) Resolve(version string) (Release, string, error) {
	r, ok := c.releases[version]
	if !ok {
		return Release{}, "", fmt.Errorf("compiler version %s is not allowlisted", version)
	}
	return r, filepath.Join(c.cacheRoot, r.Binary), nil
}
