package compiler

import (
	"encoding/hex"
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
	root, err := filepath.Abs(filepath.Clean(cacheRoot))
	if err != nil {
		return nil, fmt.Errorf("compiler cache root: %w", err)
	}
	if len(releases) == 0 {
		return nil, errors.New("compiler catalogue must not be empty")
	}
	m := make(map[string]Release, len(releases))
	for _, release := range releases {
		release.Version = strings.TrimSpace(release.Version)
		release.SHA256 = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(release.SHA256)), "sha256:")
		release.Binary = strings.TrimSpace(release.Binary)
		if release.Version == "" || release.SHA256 == "" || release.Binary == "" {
			return nil, errors.New("compiler release requires version, sha256 and binary")
		}
		if len(release.SHA256) != 64 {
			return nil, fmt.Errorf("compiler release %s requires a 32-byte sha256 digest", release.Version)
		}
		if _, err := hex.DecodeString(release.SHA256); err != nil {
			return nil, fmt.Errorf("compiler release %s has invalid sha256 digest", release.Version)
		}
		if filepath.IsAbs(release.Binary) || filepath.VolumeName(release.Binary) != "" {
			return nil, fmt.Errorf("compiler release %s binary must be relative to the cache root", release.Version)
		}
		cleanBinary := filepath.Clean(release.Binary)
		if cleanBinary == "." || cleanBinary == ".." || strings.HasPrefix(cleanBinary, ".."+string(filepath.Separator)) {
			return nil, fmt.Errorf("compiler release %s binary escapes the cache root", release.Version)
		}
		resolved := filepath.Join(root, cleanBinary)
		rel, err := filepath.Rel(root, resolved)
		if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
			return nil, fmt.Errorf("compiler release %s binary escapes the cache root", release.Version)
		}
		release.Binary = cleanBinary
		if _, exists := m[release.Version]; exists {
			return nil, fmt.Errorf("duplicate compiler version %s", release.Version)
		}
		m[release.Version] = release
	}
	return &Catalog{cacheRoot: root, releases: m}, nil
}

func (c *Catalog) Resolve(version string) (Release, string, error) {
	r, ok := c.releases[version]
	if !ok {
		return Release{}, "", fmt.Errorf("compiler version %s is not allowlisted", version)
	}
	resolved := filepath.Join(c.cacheRoot, r.Binary)
	rel, err := filepath.Rel(c.cacheRoot, resolved)
	if err != nil || rel == ".." || strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return Release{}, "", errors.New("compiler binary resolved outside cache root")
	}
	return r, resolved, nil
}
