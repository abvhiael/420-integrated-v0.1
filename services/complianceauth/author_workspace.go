package complianceauth

import (
	"bytes"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

var ErrAuthorDenied = errors.New("author workspace denied")
var ErrAuthorConflict = errors.New("author draft revision conflict")
var ErrAuthorInvalid = errors.New("invalid author draft")

// These assertions come from an independently configured identity authority.
// Neither the browser nor this workspace can mint an author role or legal approval.
type C064AuthorScope struct {
	Tenant string `json:"tenant"`
	Domain string `json:"domain"`
	Jurisdiction string `json:"jurisdiction"`
}
type C064AuthorSession struct {
	Scope C064AuthorScope
	SubjectID string
	SessionID string
	Role string
	Audience string
	CSRFToken string
	IssuedAt time.Time
	ExpiresAt time.Time
	GrantExpiresAt time.Time
	AuthenticatedAt time.Time
	MFAAt time.Time
	Revoked bool
}
type C064AuthorAuthority interface {
	VerifyAuthorSession(context.Context, string) (C064AuthorSession, error)
	EndAuthorSession(context.Context, string) error
}
type C064CitationRef struct {
	SourceID string `json:"source_id"`
	Digest string `json:"digest"`
	Locator string `json:"locator"`
}
type C064CitedText struct {
	C064CitationRef
	Excerpt string `json:"excerpt"`
	RetrievedAt time.Time `json:"retrieved_at"`
	Status string `json:"status"`
}
type C064CitationSource interface {
	Citation(context.Context, C064AuthorScope, C064CitationRef) (C064CitedText, error)
}
// Archive citations reuse C02.3 integrity checking. Allowsets are configured
// by scope; request-supplied source IDs do not expand source access.
type C064ArchiveCitations struct {
	Archive SnapshotArchive
	Allowed map[C064AuthorScope]map[string]bool
}
func (a C064ArchiveCitations) Citation(ctx context.Context, scope C064AuthorScope, ref C064CitationRef) (C064CitedText, error) {
	if ctx == nil || ctx.Err() != nil || !a.Allowed[scope][ref.SourceID] {
		return C064CitedText{}, ErrAuthorDenied
	}
	history, err := a.Archive.History(ref.SourceID)
	if err != nil { return C064CitedText{}, ErrUnavailable }
	for _, record := range history {
		if record.Digest != ref.Digest || record.Status != "PARSED_PENDING_REVIEW" { continue }
		for _, anchor := range record.Citations {
			if anchor.Locator == ref.Locator && ctx.Err() == nil {
				return C064CitedText{C064CitationRef: ref, Excerpt: anchor.Excerpt, RetrievedAt: record.RetrievedAt, Status: record.Status}, nil
			}
		}
	}
	return C064CitedText{}, ErrAuthorInvalid
}
type C064DraftVersion struct {
	Scope C064AuthorScope `json:"scope"`
	ID string `json:"id"`
	AuthorID string `json:"author_id"`
	Revision uint64 `json:"revision"`
	CreatedAt time.Time `json:"created_at"`
	DocumentDigest string `json:"document_digest"`
	Schema CompliancePolicySchema `json:"schema"`
	Citations []C064CitedText `json:"citations"`
}
type C064DraftStore interface {
	Save(context.Context, C064AuthorScope, string, string, uint64, CompliancePolicySchema, []C064CitedText, time.Time) (C064DraftVersion, error)
	Load(context.Context, C064AuthorScope, string, string, uint64) (C064DraftVersion, error)
}
type C064SaveRequest struct {
	ExpectedRevision uint64 `json:"expected_revision"`
	Schema CompliancePolicySchema `json:"schema"`
	Citations []C064CitationRef `json:"citations"`
}
type C064FieldChange struct {
	Field string `json:"field"`
	Before json.RawMessage `json:"before"`
	After json.RawMessage `json:"after"`
}
type C064Comparison struct {
	ID string `json:"id"`
	From uint64 `json:"from"`
	To uint64 `json:"to"`
	Changes []C064FieldChange `json:"changes"`
}

//go:embed authorweb/*
var c064Assets embed.FS

var c064ID = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$`)
var c064CSRF = regexp.MustCompile(`^[A-Za-z0-9_-]{32,128}$`)
const maxC064Revision = 9007199254740991

type C064AuthorWorkspace struct {
	Authority C064AuthorAuthority
	Sources C064CitationSource
	Store C064DraftStore
	Origin string
	Now func() time.Time
}
func (a C064AuthorWorkspace) now() time.Time {
	if a.Now != nil { return a.Now().UTC() }
	return time.Now().UTC()
}
func (a C064AuthorWorkspace) authorize(ctx context.Context, token string) (C064AuthorSession, time.Time, error) {
	if a.Authority == nil || ctx == nil || ctx.Err() != nil || len(token) < 16 || len(token) > 4096 {
		return C064AuthorSession{}, time.Time{}, ErrAuthorDenied
	}
	s, err := a.Authority.VerifyAuthorSession(ctx, token)
	now := a.now()
	if err != nil || ctx.Err() != nil || s.Revoked || s.Role != "author" || s.Audience != "420compliance-author" ||
		!c064ID.MatchString(s.SubjectID) || !c064ID.MatchString(s.SessionID) ||
		!c051Scope(s.Scope.Tenant) || !c051Scope(s.Scope.Domain) || !c051Scope(s.Scope.Jurisdiction) || !c064CSRF.MatchString(s.CSRFToken) ||
		s.IssuedAt.IsZero() || s.IssuedAt.After(now) || !now.Before(s.ExpiresAt) || s.ExpiresAt.Sub(s.IssuedAt) > 15*time.Minute ||
		!now.Before(s.GrantExpiresAt) || s.AuthenticatedAt.IsZero() || s.AuthenticatedAt.After(now) || now.Sub(s.AuthenticatedAt) > 15*time.Minute ||
		s.MFAAt.IsZero() || s.MFAAt.After(now) || now.Sub(s.MFAAt) >= 5*time.Minute {
		return C064AuthorSession{}, time.Time{}, ErrAuthorDenied
	}
	until := s.ExpiresAt
	for _, expiry := range []time.Time{s.GrantExpiresAt, s.MFAAt.Add(5*time.Minute)} {
		if expiry.Before(until) { until = expiry }
	}
	return s, until, nil
}
func c064Headers(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store, private")
	w.Header().Set("Pragma", "no-cache")
	w.Header().Set("Vary", "Cookie")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Referrer-Policy", "no-referrer")
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'")
}
func c064Fail(w http.ResponseWriter, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": "author_request_unavailable"})
}
func c064Write(w http.ResponseWriter, value any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(value)
}
// Reject duplicate keys and excessive depth before decoding the closed typed schema.
func c064JSON(data []byte, dst any) error {
	d := json.NewDecoder(bytes.NewReader(data))
	var walk func(int) error
	walk = func(depth int) error {
		if depth > 32 { return ErrAuthorInvalid }
		token, err := d.Token()
		if err != nil { return err }
		delim, ok := token.(json.Delim)
		if !ok { return nil }
		if delim != '{' && delim != '[' { return ErrAuthorInvalid }
		seen := map[string]bool{}
		for d.More() {
			if delim == '{' {
				key, err := d.Token()
				if err != nil { return err }
				name, ok := key.(string)
				if !ok || seen[strings.ToLower(name)] { return ErrAuthorInvalid }
				seen[strings.ToLower(name)] = true
			}
			if err := walk(depth+1); err != nil { return err }
		}
		end, err := d.Token()
		if err != nil || (delim == '{' && end != json.Delim('}')) || (delim == '[' && end != json.Delim(']')) { return ErrAuthorInvalid }
		return nil
	}
	if err := walk(0); err != nil { return err }
	if _, err := d.Token(); !errors.Is(err, io.EOF) { return ErrAuthorInvalid }
	typed := json.NewDecoder(bytes.NewReader(data))
	typed.DisallowUnknownFields()
	return typed.Decode(dst)
}
func c064Resolve(ctx context.Context, source C064CitationSource, scope C064AuthorScope, refs []C064CitationRef, now time.Time) ([]C064CitedText, string, error) {
	if source == nil || len(refs) == 0 || len(refs) > 32 { return nil, "", ErrAuthorInvalid }
	seen := map[C064CitationRef]bool{}
	cited := make([]C064CitedText, 0, len(refs))
	for _, ref := range refs {
		if !sourceIDPattern.MatchString(ref.SourceID) || !digestValid(ref.Digest) || len(ref.Locator) == 0 || len(ref.Locator) > 256 || ref.Locator != strings.TrimSpace(ref.Locator) || seen[ref] {
			return nil, "", ErrAuthorInvalid
		}
		seen[ref] = true
		text, err := source.Citation(ctx, scope, ref)
		if err != nil || ctx.Err() != nil || text.C064CitationRef != ref || text.Status != "PARSED_PENDING_REVIEW" ||
			strings.TrimSpace(text.Excerpt) == "" || len(text.Excerpt) > 8192 || text.RetrievedAt.IsZero() || text.RetrievedAt.After(now) {
			return nil, "", ErrAuthorInvalid
		}
		cited = append(cited, text)
	}
	sort.Slice(cited, func(i, j int) bool {
		a, _ := json.Marshal(cited[i].C064CitationRef)
		b, _ := json.Marshal(cited[j].C064CitationRef)
		return string(a) < string(b)
	})
	pins := make([]C064CitationRef, len(cited))
	for i := range cited { pins[i] = cited[i].C064CitationRef }
	data, _ := json.Marshal(pins)
	sum := sha256.Sum256(data)
	return cited, hex.EncodeToString(sum[:]), nil
}
func c064SchemaValid(p CompliancePolicySchema, id string, scope C064AuthorScope) bool {
	if p.PolicyID != id || p.LegalJurisdictionID != scope.Jurisdiction || len(p.Actors) > 32 || len(p.Products) > 32 || len(p.Stages) > 32 ||
		!c051Scope(p.AuthorityGraphVersion) || len(p.Hours.Timezone) > 128 { return false }
	for _, actor := range p.Actors { if !c051Scope(actor.Role) || !c051Scope(actor.IssuerID) { return false } }
	for _, product := range p.Products { if !c051Scope(product.Class) || !c051Scope(product.Unit) { return false } }
	for _, stage := range p.Stages {
		if !c051Scope(stage.Name) || len(stage.RecipientVerification) > 256 || len(stage.PaymentPrerequisite) > 256 || len(stage.ReturnDuty) > 256 || len(stage.RecordObligation) > 256 { return false }
	}
	return ValidatePolicySchema(p) == nil
}
func c064Comparison(from, to C064DraftVersion) C064Comparison {
	result := C064Comparison{ID: from.ID, From: from.Revision, To: to.Revision, Changes: []C064FieldChange{}}
	leftBytes, _ := json.Marshal(from.Schema)
	rightBytes, _ := json.Marshal(to.Schema)
	var left, right map[string]json.RawMessage
	_ = json.Unmarshal(leftBytes, &left)
	_ = json.Unmarshal(rightBytes, &right)
	left["Citations"], _ = json.Marshal(from.Citations)
	right["Citations"], _ = json.Marshal(to.Citations)
	keys := make([]string, 0, len(left))
	for key := range left { keys = append(keys, key) }
	sort.Strings(keys)
	for _, key := range keys {
		if !bytes.Equal(left[key], right[key]) { result.Changes = append(result.Changes, C064FieldChange{Field: key, Before: left[key], After: right[key]}) }
	}
	return result
}
func c064Revision(q url.Values, name string, optional bool) (uint64, bool) {
	values, exists := q[name]
	if !exists { return 0, optional }
	if len(values) != 1 { return 0, false }
	n, err := strconv.ParseUint(values[0], 10, 63)
	return n, err == nil && n > 0 && n <= maxC064Revision
}
func (a C064AuthorWorkspace) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	c064Headers(w)
	origin, err := url.Parse(a.Origin)
	if err != nil || origin.Scheme != "https" || origin.Host == "" || origin.User != nil || origin.RawQuery != "" || origin.Fragment != "" || origin.Path != "" || a.Authority == nil || a.Store == nil || a.Sources == nil {
		c064Fail(w, http.StatusServiceUnavailable); return
	}
	if r.TLS == nil || r.Host != origin.Host || r.URL.RawPath != "" || (r.Header.Get("Sec-Fetch-Site") != "" && r.Header.Get("Sec-Fetch-Site") != "same-origin" && r.Header.Get("Sec-Fetch-Site") != "none") {
		c064Fail(w, http.StatusForbidden); return
	}
	if _, err := url.ParseQuery(r.URL.RawQuery); err != nil { c064Fail(w, http.StatusBadRequest); return }
	cookie, err := r.Cookie("__Host-420ComplianceAuthor")
	if err != nil { c064Fail(w, http.StatusUnauthorized); return }
	cookieCount := 0
	for _, candidate := range r.Cookies() { if candidate.Name == "__Host-420ComplianceAuthor" { cookieCount++ } }
	if cookieCount != 1 { c064Fail(w, http.StatusBadRequest); return }
	session, until, err := a.authorize(r.Context(), cookie.Value)
	if err != nil { c064Fail(w, http.StatusUnauthorized); return }
	ctx, cancel := context.WithDeadline(r.Context(), until)
	defer cancel()
	if r.Method != http.MethodGet {
		if r.Header.Get("Origin") != a.Origin || subtle.ConstantTimeCompare([]byte(r.Header.Get("X-CSRF-Token")), []byte(session.CSRFToken)) != 1 {
			c064Fail(w, http.StatusForbidden); return
		}
	}
	reauthorize := func() bool {
		fresh, _, err := a.authorize(ctx, cookie.Value)
		return err == nil && fresh.Scope == session.Scope && fresh.SubjectID == session.SubjectID && fresh.SessionID == session.SessionID && fresh.CSRFToken == session.CSRFToken
	}
	path := r.URL.Path
	assets := map[string]string{"/private/author": "workspace.html", "/private/author/workspace.html": "workspace.html", "/private/author/editor.js": "editor.js", "/private/author/style.css": "style.css"}
	if file, ok := assets[path]; ok {
		if r.Method != http.MethodGet || r.URL.RawQuery != "" { c064Fail(w, http.StatusBadRequest); return }
		body, err := c064Assets.ReadFile("authorweb/" + file)
		if err != nil || !reauthorize() { c064Fail(w, http.StatusServiceUnavailable); return }
		contentType := "text/html; charset=utf-8"
		if strings.HasSuffix(file, ".js") { contentType = "text/javascript; charset=utf-8" }
		if strings.HasSuffix(file, ".css") { contentType = "text/css; charset=utf-8" }
		w.Header().Set("Content-Type", contentType)
		_, _ = w.Write(body)
		return
	}
	if path == "/api/v1/author/session" {
		if r.Method != http.MethodGet || r.URL.RawQuery != "" { c064Fail(w, http.StatusBadRequest); return }
		c064Write(w, map[string]any{"subject": session.SubjectID, "scope": session.Scope, "csrf_token": session.CSRFToken, "valid_until": until, "state": "AUTHOR_DRAFT_ONLY"})
		return
	}
	if path == "/api/v1/author/logout" {
		if r.Method != http.MethodPost || r.URL.RawQuery != "" { c064Fail(w, http.StatusBadRequest); return }
		if !reauthorize() || a.Authority.EndAuthorSession(ctx, cookie.Value) != nil { c064Fail(w, http.StatusServiceUnavailable); return }
		http.SetCookie(w, &http.Cookie{Name: "__Host-420ComplianceAuthor", Value: "", Path: "/", MaxAge: -1, Secure: true, HttpOnly: true, SameSite: http.SameSiteStrictMode})
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if path == "/api/v1/author/citations" {
		if r.Method != http.MethodPost || r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" { c064Fail(w, http.StatusBadRequest); return }
		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
		var request struct { Citations []C064CitationRef `json:"citations"` }
		if err != nil || c064JSON(body, &request) != nil { c064Fail(w, http.StatusBadRequest); return }
		citations, digest, err := c064Resolve(ctx, a.Sources, session.Scope, request.Citations, a.now())
		if !reauthorize() { c064Fail(w, http.StatusUnauthorized); return }
		if err != nil { c064Fail(w, http.StatusBadRequest); return }
		c064Write(w, map[string]any{"citations": citations, "source_digest": digest, "state": "PARSED_PENDING_REVIEW"})
		return
	}
	if !strings.HasPrefix(path, "/api/v1/author/drafts/") { c064Fail(w, http.StatusNotFound); return }
	tail := strings.TrimPrefix(path, "/api/v1/author/drafts/")
	compare := strings.HasSuffix(tail, "/compare")
	id := tail
	if compare { id = strings.TrimSuffix(tail, "/compare") }
	if !c064ID.MatchString(id) { c064Fail(w, http.StatusBadRequest); return }
	if compare {
		q := r.URL.Query()
		from, ok1 := c064Revision(q, "from", false)
		to, ok2 := c064Revision(q, "to", false)
		if r.Method != http.MethodGet || len(q) != 2 || !ok1 || !ok2 { c064Fail(w, http.StatusBadRequest); return }
		left, e1 := a.Store.Load(ctx, session.Scope, id, session.SubjectID, from)
		right, e2 := a.Store.Load(ctx, session.Scope, id, session.SubjectID, to)
		if !reauthorize() { c064Fail(w, http.StatusUnauthorized); return }
		if e1 != nil || e2 != nil || left.Scope != session.Scope || right.Scope != session.Scope || left.AuthorID != session.SubjectID || right.AuthorID != session.SubjectID || left.ID != id || right.ID != id || left.Revision != from || right.Revision != to { c064Fail(w, http.StatusNotFound); return }
		c064Write(w, c064Comparison(left, right)); return
	}
	if r.Method == http.MethodGet {
		q := r.URL.Query()
		revision, ok := c064Revision(q, "revision", true)
		if !ok || len(q) > 1 || (len(q) == 1 && q["revision"] == nil) { c064Fail(w, http.StatusBadRequest); return }
		version, err := a.Store.Load(ctx, session.Scope, id, session.SubjectID, revision)
		if !reauthorize() { c064Fail(w, http.StatusUnauthorized); return }
		if err != nil || version.Scope != session.Scope || version.AuthorID != session.SubjectID || version.ID != id || (revision != 0 && version.Revision != revision) { c064Fail(w, http.StatusNotFound); return }
		c064Write(w, version); return
	}
	if r.Method != http.MethodPut { w.Header().Set("Allow", "GET, PUT"); c064Fail(w, http.StatusMethodNotAllowed); return }
	if r.URL.RawQuery != "" || r.Header.Get("Content-Type") != "application/json" { c064Fail(w, http.StatusBadRequest); return }
	body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, 64<<10))
	var request C064SaveRequest
	if err != nil || c064JSON(body, &request) != nil || request.ExpectedRevision >= maxC064Revision { c064Fail(w, http.StatusBadRequest); return }
	citations, digest, err := c064Resolve(ctx, a.Sources, session.Scope, request.Citations, a.now())
	if err != nil || (request.Schema.SourceDigest != "" && request.Schema.SourceDigest != digest) { c064Fail(w, http.StatusBadRequest); return }
	request.Schema.SourceDigest = digest
	if !c064SchemaValid(request.Schema, id, session.Scope) { c064Fail(w, http.StatusBadRequest); return }
	if !reauthorize() { c064Fail(w, http.StatusUnauthorized); return }
	saved, err := a.Store.Save(ctx, session.Scope, id, session.SubjectID, request.ExpectedRevision, request.Schema, citations, a.now())
	if errors.Is(err, ErrAuthorConflict) { c064Fail(w, http.StatusConflict); return }
	if err != nil || !reauthorize() || saved.Scope != session.Scope || saved.AuthorID != session.SubjectID || saved.ID != id || saved.Revision != request.ExpectedRevision+1 { c064Fail(w, http.StatusServiceUnavailable); return }
	c064Write(w, saved)
}
