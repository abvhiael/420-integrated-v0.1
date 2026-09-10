package storage

import (
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type transportServer struct{ service *Service }

func NewTransportHandler(service *Service) http.Handler {
	mux := http.NewServeMux()
	t := &transportServer{service: service}
	mux.HandleFunc("/healthz", t.health)
	mux.HandleFunc("/v1/capacity", t.capacity)
	mux.HandleFunc("/v1/shards/", t.shard)
	return securityHeaders(mux)
}

func securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("Referrer-Policy", "no-referrer")
		next.ServeHTTP(w, r)
	})
}

func (t *transportServer) authorized(r *http.Request) bool {
	if t.service == nil { return false }
	expected := strings.TrimSpace(t.service.cfg.AuthToken)
	if expected == "" { return true }
	raw := strings.TrimSpace(r.Header.Get("Authorization"))
	if !strings.HasPrefix(raw, "Bearer ") { return false }
	provided := strings.TrimSpace(strings.TrimPrefix(raw, "Bearer "))
	if len(provided) != len(expected) { return false }
	return subtle.ConstantTimeCompare([]byte(provided), []byte(expected)) == 1
}

func (t *transportServer) requireAuth(w http.ResponseWriter, r *http.Request) bool {
	if t.authorized(r) { return true }
	w.Header().Set("WWW-Authenticate", `Bearer realm="420Store"`)
	http.Error(w, "unauthorized", http.StatusUnauthorized)
	return false
}

func (t *transportServer) health(w http.ResponseWriter, _ *http.Request) {
	if t.service == nil {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}
	status := t.service.Status()
	code := http.StatusOK
	if !status.Ready {
		code = http.StatusServiceUnavailable
	}
	writeJSON(w, code, status)
}

func (t *transportServer) capacity(w http.ResponseWriter, r *http.Request) {
	if !t.requireAuth(w, r) { return }
	if r.Method != http.MethodGet {
		w.Header().Set("Allow", http.MethodGet)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if t.service == nil || t.service.runtime == nil {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}
	writeJSON(w, http.StatusOK, t.service.runtime.Capacity())
}

func (t *transportServer) shard(w http.ResponseWriter, r *http.Request) {
	if !t.requireAuth(w, r) { return }
	if t.service == nil || t.service.runtime == nil {
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}
	id := strings.TrimPrefix(r.URL.Path, "/v1/shards/")
	if id == "" || strings.Contains(id, "/") || !safeID.MatchString(id) {
		http.Error(w, "invalid commitment id", http.StatusBadRequest)
		return
	}
	if !t.service.Status().Ready {
		http.Error(w, "chain projection unavailable", http.StatusServiceUnavailable)
		return
	}
	assignment, err := t.service.projection.Assignment(r.Context(), id)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	now := time.Now().UTC()
	if !assignment.Active || assignment.NodeID != t.service.cfg.NodeID || now.Before(assignment.StartTime) || now.After(assignment.EndTime) {
		writeStorageError(w, ErrInactiveAssignment)
		return
	}

	switch r.Method {
	case http.MethodPut:
		t.putShard(w, r, id, assignment)
	case http.MethodGet, http.MethodHead:
		t.getShard(w, r, id)
	default:
		w.Header().Set("Allow", http.MethodPut+", "+http.MethodGet+", "+http.MethodHead)
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (t *transportServer) putShard(w http.ResponseWriter, r *http.Request, id string, assignment Assignment) {
	if assignment.SizeBytes == 0 || assignment.SizeBytes >= math.MaxInt64 {
		writeStorageError(w, ErrInvalidShard)
		return
	}
	if r.ContentLength > 0 && uint64(r.ContentLength) > assignment.SizeBytes {
		http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
		return
	}
	if r.ContentLength >= 0 && uint64(r.ContentLength) != assignment.SizeBytes {
		writeStorageError(w, ErrInvalidShard)
		return
	}

	if rc, existing, _, err := t.service.runtime.RetrieveStream(r.Context(), id, 0, 1); err == nil {
		_ = rc.Close()
		if existing.AgreementID != assignment.AgreementID || existing.CommitmentID != assignment.CommitmentID || existing.ShardRoot != assignment.ShardRoot || existing.SizeBytes != assignment.SizeBytes {
			writeStorageError(w, ErrCommitmentMismatch)
			return
		}
		writeJSON(w, http.StatusOK, existing)
		return
	} else if !errors.Is(err, ErrShardNotFound) {
		writeStorageError(w, err)
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, int64(assignment.SizeBytes)+1)
	rec, err := t.service.runtime.StoreShard(r.Context(), id, r.Body)
	if err != nil {
		var maxErr *http.MaxBytesError
		if errors.As(err, &maxErr) {
			http.Error(w, "request body too large", http.StatusRequestEntityTooLarge)
			return
		}
		writeStorageError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, rec)
}

func (t *transportServer) getShard(w http.ResponseWriter, r *http.Request, id string) {
	offset, length, partial, err := requestedRange(r)
	if err != nil {
		http.Error(w, "invalid range", http.StatusRequestedRangeNotSatisfiable)
		return
	}
	rc, rec, streamLen, err := t.service.runtime.RetrieveStream(r.Context(), id, offset, length)
	if err != nil {
		writeStorageError(w, err)
		return
	}
	defer rc.Close()
	if partial && offset >= rec.SizeBytes {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes */%d", rec.SizeBytes))
		http.Error(w, "invalid range", http.StatusRequestedRangeNotSatisfiable)
		return
	}
	end := offset
	if streamLen > 0 {
		end = offset + streamLen - 1
	}
	w.Header().Set("Accept-Ranges", "bytes")
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatUint(streamLen, 10))
	w.Header().Set("ETag", fmt.Sprintf("\"%s\"", rec.ShardRoot))
	w.Header().Set("X-420-Agreement-ID", rec.AgreementID)
	w.Header().Set("X-420-Commitment-ID", rec.CommitmentID)
	if partial {
		w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", offset, end, rec.SizeBytes))
		w.WriteHeader(http.StatusPartialContent)
	} else {
		w.WriteHeader(http.StatusOK)
	}
	if r.Method != http.MethodHead {
		_, _ = io.Copy(w, rc)
	}
}

func requestedRange(r *http.Request) (offset, length uint64, partial bool, err error) {
	if raw := strings.TrimSpace(r.Header.Get("Range")); raw != "" {
		if !strings.HasPrefix(raw, "bytes=") || strings.Contains(raw, ",") {
			return 0, 0, false, ErrInvalidShard
		}
		parts := strings.Split(strings.TrimPrefix(raw, "bytes="), "-")
		if len(parts) != 2 || parts[0] == "" {
			return 0, 0, false, ErrInvalidShard
		}
		start, e := strconv.ParseUint(parts[0], 10, 64)
		if e != nil {
			return 0, 0, false, ErrInvalidShard
		}
		if parts[1] == "" {
			return start, 0, true, nil
		}
		end, e := strconv.ParseUint(parts[1], 10, 64)
		if e != nil || end < start {
			return 0, 0, false, ErrInvalidShard
		}
		return start, end - start + 1, true, nil
	}
	q := r.URL.Query()
	if q.Get("offset") == "" && q.Get("length") == "" {
		return 0, 0, false, nil
	}
	if q.Get("offset") != "" {
		offset, err = strconv.ParseUint(q.Get("offset"), 10, 64)
		if err != nil {
			return 0, 0, false, err
		}
	}
	if q.Get("length") != "" {
		length, err = strconv.ParseUint(q.Get("length"), 10, 64)
		if err != nil {
			return 0, 0, false, err
		}
	}
	return offset, length, true, nil
}

func writeStorageError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, ErrShardNotFound):
		http.Error(w, "shard not found", http.StatusNotFound)
	case errors.Is(err, ErrInactiveAssignment):
		http.Error(w, "inactive assignment", http.StatusForbidden)
	case errors.Is(err, ErrCapacityExceeded):
		http.Error(w, "capacity exceeded", http.StatusInsufficientStorage)
	case errors.Is(err, ErrCommitmentMismatch), errors.Is(err, ErrInvalidShard):
		http.Error(w, "invalid shard", http.StatusUnprocessableEntity)
	default:
		http.Error(w, "storage service error", http.StatusInternalServerError)
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
