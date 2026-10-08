package reeferreview

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"sync"
	"time"
)

var newsAdminMutex sync.Mutex
var newsSourceIDPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,63}$`)
var newsSectionIDs = map[string]bool{
	"canada": true, "legalization-policy": true, "medical-research": true,
	"cultivation": true, "business-markets": true, "culture": true, "international": true,
}

// News-source administration requires a verified moderator session at the HTTP
// middleware. The filesystem writer is single-owner; multi-instance production
// deployments must use an external transactional registry before enabling writes.
func (h HTTP) newsAdminSources(w http.ResponseWriter, r *http.Request) {
	if h.News == nil || h.News.SourcesPath == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SOURCE_REGISTRY_READONLY"})
		return
	}
	if r.Method != http.MethodGet && r.Method != http.MethodPut && r.Method != http.MethodPost {
		w.Header().Set("Allow", "GET, PUT, POST")
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	if r.Method == http.MethodGet {
		sources, err := h.News.currentSources()
		if err != nil {
			writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SOURCE_REGISTRY_UNAVAILABLE"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"sources": sources.Sources})
		return
	}
	claims, authenticated := authenticatedSession(r.Context())
	if !authenticated || !HasAnyCapability(claims, CapabilityModerator) {
		writeJSON(w, http.StatusForbidden, map[string]string{"error": "CAPABILITY_DENIED"})
		return
	}
	// Fail closed on overlarge and ambiguous input.
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	defer r.Body.Close()
	var req struct {
		Source NewsSource `json:"source"`
	}
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "INVALID_SOURCE"})
		return
	}
	if err := dec.Decode(new(any)); !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "INVALID_SOURCE"})
		return
	}
	source := req.Source
	if !newsSourceIDPattern.MatchString(source.ID) || !newsSectionIDs[source.Category] ||
		source.Language != "en" || source.PollIntervalMinutes < 15 || source.PollIntervalMinutes > 1440 ||
		source.AllowImage || len(source.Name) > 120 || len(source.Attribution) > 500 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "INVALID_SOURCE"})
		return
	}
	if source.AllowExcerpt {
		// Republishing content requires a separate documented rights review.
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "EXCERPT_PERMISSION_REQUIRED"})
		return
	}
	newsAdminMutex.Lock()
	defer newsAdminMutex.Unlock()
	registry, err := LoadNewsSourceRegistry(h.News.SourcesPath)
	if err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SOURCE_REGISTRY_UNAVAILABLE"})
		return
	}
	index := -1
	for i, s := range registry.Sources {
		if s.ID == source.ID {
			index = i
			break
		}
	}
	if (r.Method == http.MethodPost && index >= 0) || (r.Method == http.MethodPut && index < 0) {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "SOURCE_CONFLICT"})
		return
	}
	// New sources start disabled. Existing enablement must be an explicit action.
	if r.Method == http.MethodPost && source.Enabled {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "NEW_SOURCE_MUST_START_DISABLED"})
		return
	}
	if index >= 0 {
		registry.Sources[index] = source
	} else {
		registry.Sources = append(registry.Sources, source)
	}
	if err := ValidateNewsSourceRegistry(registry); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "INVALID_SOURCE_REGISTRY"})
		return
	}
	if err := persistNewsRegistry(h.News.SourcesPath, registry); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"error": "SOURCE_REGISTRY_WRITE_FAILED"})
		return
	}
	// Actor identity is not returned publicly; operations must retain structured
	// audit logs in the deployment log pipeline before production qualification.
	_ = fmt.Sprintf("news_source_admin actor=%s id=%s method=%s at=%s", claims.Subject, source.ID, r.Method, time.Now().UTC().Format(time.RFC3339))
	writeJSON(w, http.StatusOK, map[string]any{"source": source})
}

func persistNewsRegistry(path string, registry NewsSourceRegistry) error {
	if path == "" {
		return ErrInvalidInput
	}
	parent := filepath.Dir(path)
	data, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return err
	}
	file, err := os.CreateTemp(parent, ".reefer-sources-*")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	if err = file.Chmod(0600); err != nil {
		file.Close()
		return err
	}
	if _, err = file.Write(append(data, '\n')); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	if err = os.Rename(name, path); err != nil {
		return err
	}
	dir, err := os.Open(parent)
	if err != nil {
		return err
	}
	defer dir.Close()
	return dir.Sync()
}
