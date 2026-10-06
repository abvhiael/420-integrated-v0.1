package api

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	mediasecurity "github.com/420integrated/420-integrated/media/security"
)

type Server struct {
	Backend Backend
	Idem    IdempotencyStore
	Now     func() time.Time
}

func NewServer(backend Backend) (*Server, error) {
	if backend == nil {
		return nil, errors.New("420media api: backend is required")
	}
	return &Server{Backend: backend, Idem: NewMemoryIdempotency(), Now: time.Now}, nil
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/status", s.handleStatus)
	mux.HandleFunc("GET /v1/capabilities", s.handleCapabilities)
	mux.HandleFunc("GET /v1/compatibility", s.handleCompatibility)
	mux.HandleFunc("GET /v1/assets", s.handleListAssets)
	mux.HandleFunc("GET /v1/assets/{id}", s.handleGetAsset)
	mux.HandleFunc("POST /v1/uploads/prepare", s.handlePrepareUpload)
	mux.HandleFunc("POST /v1/livestreams", s.handleCreateLivestream)
	mux.HandleFunc("GET /v1/livestreams/{id}", s.handleGetLivestream)
	mux.HandleFunc("POST /v1/livestreams/{id}/start", s.handleStartLivestream)
	mux.HandleFunc("POST /v1/livestreams/{id}/stop", s.handleStopLivestream)
	mux.HandleFunc("GET /v1/search", s.handleSearch)
	mux.HandleFunc("POST /v1/notifications/subscriptions", s.handleCreateSubscription)
	mux.HandleFunc("DELETE /v1/notifications/subscriptions/{id}", s.handleDeleteSubscription)
	mux.HandleFunc("POST /v1/signing/intents", s.handleSigningIntent)
	return s.common(mux)
}

func (s *Server) common(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Cache-Control", "no-store")
		w.Header().Set("X-420-Service", ServiceID)
		w.Header().Set("X-420-API-Version", Version)
		next.ServeHTTP(w, r)
	})
}

func (s *Server) handleStatus(w http.ResponseWriter, r *http.Request) {
	compat, err := s.Backend.Compatibility(r.Context())
	if err != nil {
		s.backendError(w, err)
		return
	}
	s.write(w, http.StatusOK, map[string]any{
		"service_id":          ServiceID,
		"api_version":         Version,
		"compatibility_major": compat.CompatibilityMajor,
		"canonical":           false,
		"status":              "available",
		"updated_at":          s.now(),
	})
}

func (s *Server) handleCapabilities(w http.ResponseWriter, r *http.Request) {
	caps, err := s.Backend.Capabilities(r.Context())
	if err != nil {
		s.backendError(w, err)
		return
	}
	if caps.ServiceID != ServiceID || caps.APIVersion != Version || caps.Compatibility != CompatibilityMajor {
		s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, "backend capability contract mismatch")
		return
	}
	s.write(w, http.StatusOK, caps)
}

func (s *Server) handleCompatibility(w http.ResponseWriter, r *http.Request) {
	compat, err := s.Backend.Compatibility(r.Context())
	if err != nil {
		s.backendError(w, err)
		return
	}
	if compat.ServiceID != ServiceID || compat.APIVersion != Version || compat.CompatibilityMajor != CompatibilityMajor {
		s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, "backend compatibility contract mismatch")
		return
	}
	s.write(w, http.StatusOK, compat)
}

func (s *Server) handleListAssets(w http.ResponseWriter, r *http.Request) {
	cursor, limit, ok := s.pageQuery(w, r)
	if !ok {
		return
	}
	page, err := s.Backend.ListAssets(r.Context(), cursor, limit)
	if err != nil {
		s.backendError(w, err)
		return
	}
	s.write(w, http.StatusOK, normalizeAssetPage(page))
}

func (s *Server) handleGetAsset(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "asset id is required")
		return
	}
	item, err := s.Backend.GetAsset(r.Context(), id)
	if err != nil {
		s.backendError(w, err)
		return
	}
	s.write(w, http.StatusOK, normalizeAsset(item))
}

func (s *Server) handlePrepareUpload(w http.ResponseWriter, r *http.Request) {
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, key string, body []byte) (any, error) {
		var req PrepareUploadRequest
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		if err := mediasecurity.DefaultContentPolicy().Validate(req.MimeType, req.SizeBytes); err != nil {
			return nil, requestError{err: err}
		}
		return s.Backend.PrepareUpload(ctx, req, key)
	})
}

func (s *Server) handleCreateLivestream(w http.ResponseWriter, r *http.Request) {
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, key string, body []byte) (any, error) {
		var req CreateLivestreamRequest
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		if err := validateLivestreamEndpoint(req.Protocol, req.Endpoint); err != nil {
			return nil, requestError{err: err}
		}
		item, err := s.Backend.CreateLivestream(ctx, req, key)
		return normalizeLivestream(item), err
	})
}

func (s *Server) handleGetLivestream(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	controller := strings.TrimSpace(r.URL.Query().Get("controller"))
	if id == "" || controller == "" || len(r.URL.Query()) != 1 {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "id and controller are required")
		return
	}
	item, err := s.Backend.GetLivestream(r.Context(), id, controller)
	if err != nil {
		s.backendError(w, err)
		return
	}
	s.write(w, http.StatusOK, normalizeLivestream(item))
}

func (s *Server) handleStartLivestream(w http.ResponseWriter, r *http.Request) {
	s.livestreamAction(w, r, true)
}

func (s *Server) handleStopLivestream(w http.ResponseWriter, r *http.Request) {
	s.livestreamAction(w, r, false)
}

func (s *Server) livestreamAction(w http.ResponseWriter, r *http.Request, start bool) {
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "livestream id is required")
		return
	}
	s.writeIdempotent(w, r, http.StatusOK, func(ctx context.Context, key string, body []byte) (any, error) {
		var req LivestreamActionRequest
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		var item Livestream
		var err error
		if start {
			item, err = s.Backend.StartLivestream(ctx, id, req, key)
		} else {
			item, err = s.Backend.StopLivestream(ctx, id, req, key)
		}
		return normalizeLivestream(item), err
	})
}

func (s *Server) handleSearch(w http.ResponseWriter, r *http.Request) {
	cursor, limit, ok := s.pageQuery(w, r)
	if !ok {
		return
	}
	page, err := s.Backend.Search(r.Context(), cursor, limit)
	if err != nil {
		s.backendError(w, err)
		return
	}
	for i := range page.Items {
		page.Items[i].Provenance = normalizeProvenance(page.Items[i].Provenance)
	}
	s.write(w, http.StatusOK, page)
}

func (s *Server) handleCreateSubscription(w http.ResponseWriter, r *http.Request) {
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, key string, body []byte) (any, error) {
		var req CreateSubscriptionRequest
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		item, err := s.Backend.CreateSubscription(ctx, req, key)
		if err != nil {
			return nil, err
		}
		item.CreatedAt = utc(item.CreatedAt)
		item.UpdatedAt = utc(item.UpdatedAt)
		return item, nil
	})
}

func (s *Server) handleDeleteSubscription(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSpace(r.PathValue("id"))
	userRef := strings.TrimSpace(r.URL.Query().Get("user_ref"))
	if id == "" || userRef == "" || len(r.URL.Query()) != 1 {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "subscription id and user_ref are required")
		return
	}
	s.writeIdempotent(w, r, http.StatusOK, func(ctx context.Context, key string, _ []byte) (any, error) {
		if err := s.Backend.DeleteSubscription(ctx, id, userRef); err != nil {
			return nil, err
		}
		return map[string]any{"id": id, "deleted": true, "updated_at": s.now()}, nil
	})
}

func (s *Server) handleSigningIntent(w http.ResponseWriter, r *http.Request) {
	s.writeIdempotent(w, r, http.StatusCreated, func(ctx context.Context, key string, body []byte) (any, error) {
		var req SigningIntentRequest
		if err := decodeStrict(body, &req); err != nil {
			return nil, err
		}
		intent, err := s.Backend.PrepareSigningIntent(ctx, req, key)
		if err != nil {
			return nil, err
		}
		if intent.Domain != SigningDomain || intent.ChainID != req.ChainID || intent.Network != req.Network ||
			!strings.EqualFold(intent.Wallet, req.Wallet) || intent.Action != req.Action ||
			intent.ResourceID != req.ResourceID || intent.PayloadHash != req.PayloadHash ||
			strings.TrimSpace(intent.Nonce) == "" || intent.ExpiresAt.IsZero() || strings.TrimSpace(intent.Message) == "" {
			return nil, errors.New("signing intent mismatch")
		}
		intent.ExpiresAt = utc(intent.ExpiresAt)
		return intent, nil
	})
}

func (s *Server) pageQuery(w http.ResponseWriter, r *http.Request) (string, int, bool) {
	for key, values := range r.URL.Query() {
		if key != "cursor" && key != "limit" {
			s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "unsupported pagination parameter")
			return "", 0, false
		}
		if len(values) != 1 {
			s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "duplicate pagination parameter")
			return "", 0, false
		}
	}
	cursor := strings.TrimSpace(r.URL.Query().Get("cursor"))
	if len(cursor) > 512 {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "cursor is too long")
		return "", 0, false
	}
	limit := DefaultPageLimit
	if raw := strings.TrimSpace(r.URL.Query().Get("limit")); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil || value < 1 || value > MaxPageLimit {
			s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "limit must be between 1 and 200")
			return "", 0, false
		}
		limit = value
	}
	return cursor, limit, true
}

func (s *Server) writeIdempotent(
	w http.ResponseWriter,
	r *http.Request,
	successStatus int,
	run func(context.Context, string, []byte) (any, error),
) {
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key == "" || len(key) > 128 {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "valid Idempotency-Key is required")
		return
	}
	body, err := readBody(r)
	if err != nil {
		s.fail(w, http.StatusBadRequest, CodeInvalidRequest, err.Error())
		return
	}
	fingerprint := requestFingerprint(r.Method, r.URL.Path, r.URL.RawQuery, body)
	if s.Idem == nil {
		s.Idem = NewMemoryIdempotency()
	}
	if prior, ok, err := s.Idem.Get(key, fingerprint); err != nil {
		s.fail(w, http.StatusConflict, CodeIdempotencyConflict, err.Error())
		return
	} else if ok {
		s.writeRaw(w, prior.Status, prior.Body)
		return
	}
	value, err := run(r.Context(), key, body)
	if err != nil {
		if errors.Is(err, io.EOF) {
			s.fail(w, http.StatusBadRequest, CodeInvalidRequest, "request body is required")
			return
		}
		s.backendError(w, err)
		return
	}
	payload, err := s.encodeEnvelope(value)
	if err != nil {
		s.fail(w, http.StatusInternalServerError, CodeInternal, "response encoding failed")
		return
	}
	s.Idem.Put(key, replay{Fingerprint: fingerprint, Status: successStatus, Body: payload})
	s.writeRaw(w, successStatus, payload)
}

func (s *Server) backendError(w http.ResponseWriter, err error) {
	type coded interface {
		APIErrorCode() ErrorCode
	}
	var c coded
	if errors.As(err, &c) {
		code := c.APIErrorCode()
		status := statusForCode(code)
		s.fail(w, status, code, err.Error())
		return
	}
	s.fail(w, http.StatusServiceUnavailable, CodeUnavailable, err.Error())
}

func statusForCode(code ErrorCode) int {
	switch code {
	case CodeInvalidRequest:
		return http.StatusBadRequest
	case CodeUnauthorized:
		return http.StatusUnauthorized
	case CodeForbidden:
		return http.StatusForbidden
	case CodeNotFound:
		return http.StatusNotFound
	case CodeConflict, CodeIdempotencyConflict:
		return http.StatusConflict
	case CodeRateLimited:
		return http.StatusTooManyRequests
	case CodeUnsupportedVersion:
		return http.StatusUpgradeRequired
	case CodeUnavailable:
		return http.StatusServiceUnavailable
	default:
		return http.StatusInternalServerError
	}
}

func (s *Server) fail(w http.ResponseWriter, status int, code ErrorCode, message string) {
	s.writeRaw(w, status, mustJSON(ErrorEnvelope{
		Version: Version,
		Error:   APIError{Code: code, Message: strings.TrimSpace(message)},
	}))
}

func (s *Server) write(w http.ResponseWriter, status int, value any) {
	payload, err := s.encodeEnvelope(value)
	if err != nil {
		s.fail(w, http.StatusInternalServerError, CodeInternal, "response encoding failed")
		return
	}
	s.writeRaw(w, status, payload)
}

func (s *Server) encodeEnvelope(value any) ([]byte, error) {
	return json.Marshal(Envelope[any]{
		Version:   Version,
		Data:      value,
		RateLimit: s.rateLimit(),
	})
}

func (s *Server) writeRaw(w http.ResponseWriter, status int, payload []byte) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	meta := s.rateLimit()
	w.Header().Set("X-RateLimit-Limit", strconv.Itoa(meta.Limit))
	w.Header().Set("X-RateLimit-Remaining", strconv.Itoa(meta.Remaining))
	w.Header().Set("X-RateLimit-Reset", meta.ResetAt.Format(time.RFC3339))
	w.WriteHeader(status)
	_, _ = w.Write(append(append([]byte(nil), payload...), '\n'))
}

func (s *Server) rateLimit() RateLimitMeta {
	now := s.now()
	return RateLimitMeta{
		Limit: DefaultRateLimit, Remaining: DefaultRateLimit - 1,
		ResetAt: now.Truncate(time.Minute).Add(time.Minute),
	}
}

func (s *Server) now() time.Time {
	if s.Now != nil {
		return s.Now().UTC().Truncate(time.Second)
	}
	return time.Now().UTC().Truncate(time.Second)
}

func readBody(r *http.Request) ([]byte, error) {
	if r.Body == nil {
		return nil, io.EOF
	}
	defer r.Body.Close()
	body, err := io.ReadAll(io.LimitReader(r.Body, MaxRequestBytes+1))
	if err != nil {
		return nil, err
	}
	if len(body) > MaxRequestBytes {
		return nil, errors.New("request body too large")
	}
	if len(bytes.TrimSpace(body)) == 0 && r.Method != http.MethodDelete {
		return nil, io.EOF
	}
	return body, nil
}

type requestError struct{ err error }

func (e requestError) Error() string           { return e.err.Error() }
func (e requestError) Unwrap() error           { return e.err }
func (e requestError) APIErrorCode() ErrorCode { return CodeInvalidRequest }

func decodeStrict(body []byte, target any) error {
	decoder := json.NewDecoder(bytes.NewReader(body))
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(target); err != nil {
		return requestError{err: err}
	}
	if decoder.Decode(&struct{}{}) != io.EOF {
		return requestError{err: errors.New("request must contain one JSON object")}
	}
	return nil
}

func requestFingerprint(method, path, query string, body []byte) string {
	sum := sha256.Sum256(append([]byte(method+"\x00"+path+"\x00"+query+"\x00"), body...))
	return hex.EncodeToString(sum[:])
}

func mustJSON(value any) []byte {
	payload, _ := json.Marshal(value)
	return payload
}

func utc(value time.Time) time.Time {
	if value.IsZero() {
		return value
	}
	return value.UTC().Truncate(time.Second)
}

func normalizeProvenance(p Provenance) Provenance {
	p.ObservedAt = utc(p.ObservedAt)
	return p
}

func normalizeAsset(item Asset) Asset {
	item.CreatedAt = utc(item.CreatedAt)
	item.UpdatedAt = utc(item.UpdatedAt)
	item.Provenance = normalizeProvenance(item.Provenance)
	return item
}

func normalizeAssetPage(page Page[Asset]) Page[Asset] {
	for i := range page.Items {
		page.Items[i] = normalizeAsset(page.Items[i])
	}
	return page
}

func normalizeLivestream(item Livestream) Livestream {
	item.CreatedAt = utc(item.CreatedAt)
	item.UpdatedAt = utc(item.UpdatedAt)
	item.Provenance = normalizeProvenance(item.Provenance)
	return item
}


func validateLivestreamEndpoint(protocol, endpoint string) error {
	switch strings.ToUpper(strings.TrimSpace(protocol)) {
	case "WHIP", "WHEP":
		return mediasecurity.ValidateOutboundEndpoint(endpoint, "https")
	case "RTMP":
		return mediasecurity.ValidateOutboundEndpoint(endpoint, "rtmps")
	case "SRT":
		return mediasecurity.ValidateOutboundEndpoint(endpoint, "srt")
	case "WEBRTC":
		return mediasecurity.ValidateOutboundEndpoint(endpoint, "webrtc")
	default:
		return mediasecurity.ErrInvalidEndpoint
	}
}
