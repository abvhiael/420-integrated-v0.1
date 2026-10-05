package worker

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"
)

const (
	WorkUnitDownloadSchemaV1 = "420-compute-worker-work-unit-download-v1"
	DefaultWorkUnitMaxBytes   = uint64(4 << 30)
	DefaultDownloadTimeout    = 5 * time.Minute
)

var (
	ErrInvalidWorkUnit = errors.New("invalid compute work unit")
	ErrDigestMismatch  = errors.New("compute work unit digest mismatch")
	ErrSizeMismatch    = errors.New("compute work unit size mismatch")
	sha256HexPattern   = regexp.MustCompile(`^[0-9a-f]{64}$`)
)

type WorkUnitSource struct {
	URL          string `json:"url"`
	SHA256       string `json:"sha256"`
	SizeBytes    uint64 `json:"sizeBytes"`
	MediaType    string `json:"mediaType,omitempty"`
	Purpose      string `json:"purpose,omitempty"`
}

type WorkUnitArtifact struct {
	SchemaVersion string `json:"schemaVersion"`
	SHA256        string `json:"sha256"`
	SizeBytes     uint64 `json:"sizeBytes"`
	Path          string `json:"path"`
	FromCache     bool   `json:"fromCache"`
}

type RequestAuthorizer interface {
	Authorize(context.Context, *http.Request) error
}

type RequestAuthorizerFunc func(context.Context, *http.Request) error

func (f RequestAuthorizerFunc) Authorize(ctx context.Context, request *http.Request) error {
	return f(ctx, request)
}

type WorkUnitDownloader struct {
	root       string
	client     *http.Client
	authorizer RequestAuthorizer
	maxBytes   uint64
	mu         sync.Mutex
}

func NewWorkUnitDownloader(
	stateDir string,
	client *http.Client,
	authorizer RequestAuthorizer,
	maxBytes uint64,
) (*WorkUnitDownloader, error) {
	if strings.TrimSpace(stateDir) == "" {
		return nil, fmt.Errorf("%w: state directory required", ErrInvalidWorkUnit)
	}
	if client == nil {
		client = &http.Client{Timeout: DefaultDownloadTimeout}
	}
	if client.Timeout <= 0 {
		return nil, fmt.Errorf("%w: HTTP client timeout required", ErrInvalidWorkUnit)
	}
	clientCopy := *client
	clientCopy.CheckRedirect = func(_ *http.Request, _ []*http.Request) error {
		return http.ErrUseLastResponse
	}
	client = &clientCopy
	if maxBytes == 0 {
		maxBytes = DefaultWorkUnitMaxBytes
	}
	if maxBytes == 0 {
		return nil, fmt.Errorf("%w: maximum size required", ErrInvalidWorkUnit)
	}

	root, err := filepath.Abs(filepath.Clean(filepath.Join(stateDir, "work-units", "sha256")))
	if err != nil {
		return nil, fmt.Errorf("%w: resolve work-unit directory: %v", ErrInvalidWorkUnit, err)
	}
	if err := os.MkdirAll(root, 0o700); err != nil {
		return nil, err
	}
	if err := os.Chmod(root, 0o700); err != nil {
		return nil, err
	}
	return &WorkUnitDownloader{
		root:       root,
		client:     client,
		authorizer: authorizer,
		maxBytes:   maxBytes,
	}, nil
}

func ValidateWorkUnitSource(source WorkUnitSource, maxBytes uint64) (*url.URL, error) {
	if maxBytes == 0 {
		maxBytes = DefaultWorkUnitMaxBytes
	}
	digest := strings.ToLower(strings.TrimSpace(source.SHA256))
	if !sha256HexPattern.MatchString(digest) || source.SHA256 != digest {
		return nil, fmt.Errorf("%w: lowercase SHA-256 digest required", ErrInvalidWorkUnit)
	}
	if source.SizeBytes == 0 || source.SizeBytes > maxBytes {
		return nil, fmt.Errorf("%w: size out of bounds", ErrInvalidWorkUnit)
	}
	parsed, err := url.Parse(source.URL)
	if err != nil || parsed == nil {
		return nil, fmt.Errorf("%w: invalid source URL", ErrInvalidWorkUnit)
	}
	if parsed.Scheme != "https" || parsed.Host == "" {
		return nil, fmt.Errorf("%w: HTTPS source required", ErrInvalidWorkUnit)
	}
	if parsed.User != nil {
		return nil, fmt.Errorf("%w: URL userinfo forbidden", ErrInvalidWorkUnit)
	}
	if parsed.Fragment != "" {
		return nil, fmt.Errorf("%w: URL fragment forbidden", ErrInvalidWorkUnit)
	}
	if source.MediaType != "" && (strings.ContainsAny(source.MediaType, "\r\n") || len(source.MediaType) > 128) {
		return nil, fmt.Errorf("%w: invalid media type", ErrInvalidWorkUnit)
	}
	if source.Purpose != "" && (strings.ContainsAny(source.Purpose, "\r\n") || len(source.Purpose) > 128) {
		return nil, fmt.Errorf("%w: invalid purpose", ErrInvalidWorkUnit)
	}
	return parsed, nil
}

func (d *WorkUnitDownloader) Fetch(ctx context.Context, source WorkUnitSource) (WorkUnitArtifact, error) {
	if d == nil || d.client == nil {
		return WorkUnitArtifact{}, ErrInvalidWorkUnit
	}
	parsed, err := ValidateWorkUnitSource(source, d.maxBytes)
	if err != nil {
		return WorkUnitArtifact{}, err
	}
	if err := ctx.Err(); err != nil {
		return WorkUnitArtifact{}, err
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	finalPath := filepath.Join(d.root, source.SHA256+".bin")
	if artifact, ok := d.verifyCached(finalPath, source); ok {
		return artifact, nil
	}
	_ = os.Remove(finalPath)

	request, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return WorkUnitArtifact{}, fmt.Errorf("%w: create request", ErrInvalidWorkUnit)
	}
	request.Header.Set("Accept", "application/octet-stream")
	request.Header.Set("X-420-Artifact-SHA256", source.SHA256)
	if source.Purpose != "" {
		request.Header.Set("X-420-Artifact-Purpose", source.Purpose)
	}
	if d.authorizer != nil {
		if err := d.authorizer.Authorize(ctx, request); err != nil {
			return WorkUnitArtifact{}, fmt.Errorf("%w: source authorization failed", ErrInvalidWorkUnit)
		}
	}

	response, err := d.client.Do(request)
	if err != nil {
		return WorkUnitArtifact{}, fmt.Errorf("work-unit download failed: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode > 299 {
		return WorkUnitArtifact{}, fmt.Errorf("work-unit download failed: unexpected HTTP status %d", response.StatusCode)
	}
	if response.Request == nil || response.Request.URL == nil || response.Request.URL.String() != parsed.String() {
		return WorkUnitArtifact{}, fmt.Errorf("%w: redirected source rejected", ErrInvalidWorkUnit)
	}
	if response.ContentLength >= 0 && uint64(response.ContentLength) != source.SizeBytes {
		return WorkUnitArtifact{}, fmt.Errorf("%w: content-length=%d expected=%d", ErrSizeMismatch, response.ContentLength, source.SizeBytes)
	}
	if source.MediaType != "" {
		actual := strings.TrimSpace(strings.Split(response.Header.Get("Content-Type"), ";")[0])
		if !strings.EqualFold(actual, source.MediaType) {
			return WorkUnitArtifact{}, fmt.Errorf("%w: media type %q expected %q", ErrInvalidWorkUnit, actual, source.MediaType)
		}
	}

	tmp, err := os.CreateTemp(d.root, ".work-unit-*")
	if err != nil {
		return WorkUnitArtifact{}, err
	}
	tmpName := tmp.Name()
	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpName)
	}
	if err := tmp.Chmod(0o600); err != nil {
		cleanup()
		return WorkUnitArtifact{}, err
	}

	hasher := sha256.New()
	limited := io.LimitReader(response.Body, int64(source.SizeBytes)+1)
	written, err := io.Copy(io.MultiWriter(tmp, hasher), limited)
	if err != nil {
		cleanup()
		return WorkUnitArtifact{}, err
	}
	if err := ctx.Err(); err != nil {
		cleanup()
		return WorkUnitArtifact{}, err
	}
	if uint64(written) != source.SizeBytes {
		cleanup()
		return WorkUnitArtifact{}, fmt.Errorf("%w: received=%d expected=%d", ErrSizeMismatch, written, source.SizeBytes)
	}
	actualDigest := hex.EncodeToString(hasher.Sum(nil))
	if actualDigest != source.SHA256 {
		cleanup()
		return WorkUnitArtifact{}, fmt.Errorf("%w: received=%s expected=%s", ErrDigestMismatch, actualDigest, source.SHA256)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return WorkUnitArtifact{}, err
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpName)
		return WorkUnitArtifact{}, err
	}
	if err := os.Rename(tmpName, finalPath); err != nil {
		_ = os.Remove(tmpName)
		return WorkUnitArtifact{}, err
	}
	if dir, err := os.Open(d.root); err == nil {
		syncErr := dir.Sync()
		_ = dir.Close()
		if syncErr != nil {
			_ = os.Remove(finalPath)
			return WorkUnitArtifact{}, syncErr
		}
	} else {
		_ = os.Remove(finalPath)
		return WorkUnitArtifact{}, err
	}

	return WorkUnitArtifact{
		SchemaVersion: WorkUnitDownloadSchemaV1,
		SHA256:        source.SHA256,
		SizeBytes:     source.SizeBytes,
		Path:          finalPath,
		FromCache:     false,
	}, nil
}

func (d *WorkUnitDownloader) verifyCached(path string, source WorkUnitSource) (WorkUnitArtifact, bool) {
	info, err := os.Lstat(path)
	if err != nil || !info.Mode().IsRegular() || info.Mode()&os.ModeSymlink != 0 || uint64(info.Size()) != source.SizeBytes {
		return WorkUnitArtifact{}, false
	}
	file, err := os.Open(path)
	if err != nil {
		return WorkUnitArtifact{}, false
	}
	defer file.Close()

	hasher := sha256.New()
	written, err := io.Copy(hasher, io.LimitReader(file, int64(source.SizeBytes)+1))
	if err != nil || uint64(written) != source.SizeBytes || hex.EncodeToString(hasher.Sum(nil)) != source.SHA256 {
		return WorkUnitArtifact{}, false
	}
	return WorkUnitArtifact{
		SchemaVersion: WorkUnitDownloadSchemaV1,
		SHA256:        source.SHA256,
		SizeBytes:     source.SizeBytes,
		Path:          path,
		FromCache:     true,
	}, true
}
