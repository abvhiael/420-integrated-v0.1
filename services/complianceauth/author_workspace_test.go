package complianceauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

var c064FixtureScope = C064AuthorScope{Tenant: "tenant-a", Domain: "delivery", Jurisdiction: "bc"}
const c064FixtureToken = "independent-author-session-token"

type c064TestAuthority struct {
	mu sync.Mutex
	session C064AuthorSession
}
func (a *c064TestAuthority) VerifyAuthorSession(ctx context.Context, token string) (C064AuthorSession, error) {
	a.mu.Lock(); defer a.mu.Unlock()
	if ctx.Err() != nil || token != c064FixtureToken { return C064AuthorSession{}, ErrAuthorDenied }
	return a.session, nil
}
func (a *c064TestAuthority) EndAuthorSession(ctx context.Context, token string) error {
	a.mu.Lock(); defer a.mu.Unlock()
	if ctx.Err() != nil || token != c064FixtureToken { return ErrAuthorDenied }
	a.session.Revoked = true
	return nil
}
type c064TestSource struct { hook func(); invalid bool }
func (s c064TestSource) Citation(ctx context.Context, scope C064AuthorScope, ref C064CitationRef) (C064CitedText, error) {
	if s.hook != nil { s.hook() }
	if ctx.Err() != nil || scope != c064FixtureScope || ref.SourceID != "FED-ACT" || ref.Digest != Digest([]byte("fixture snapshot")) || ref.Locator != "section-1" {
		return C064CitedText{}, ErrAuthorDenied
	}
	status := "PARSED_PENDING_REVIEW"
	if s.invalid { status = "QUARANTINED" }
	return C064CitedText{C064CitationRef: ref, Excerpt: "<script>fixture source text</script>", RetrievedAt: time.Date(2026,1,1,0,0,0,0,time.UTC), Status: status}, nil
}
type c064TestStore struct {
	mu sync.Mutex
	versions map[C064AuthorScope]map[string][]C064DraftVersion
}
func c064Copy(v C064DraftVersion) C064DraftVersion { data, _ := json.Marshal(v); var copy C064DraftVersion; _ = json.Unmarshal(data, &copy); return copy }
func (s *c064TestStore) Save(ctx context.Context, scope C064AuthorScope, id, author string, expected uint64, schema CompliancePolicySchema, citations []C064CitedText, now time.Time) (C064DraftVersion, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	if ctx.Err() != nil { return C064DraftVersion{}, ErrUnavailable }
	if s.versions == nil { s.versions = map[C064AuthorScope]map[string][]C064DraftVersion{} }
	if s.versions[scope] == nil { s.versions[scope] = map[string][]C064DraftVersion{} }
	old := s.versions[scope][id]
	if len(old) > 0 && old[0].AuthorID != author { return C064DraftVersion{}, ErrAuthorDenied }
	if uint64(len(old)) != expected { return C064DraftVersion{}, ErrAuthorConflict }
	v := C064DraftVersion{Scope: scope, ID: id, AuthorID: author, Revision: expected+1, CreatedAt: now, Schema: schema, Citations: citations, DocumentDigest: c064DocumentDigest(schema, citations)}
	s.versions[scope][id] = append(old, c064Copy(v))
	return c064Copy(v), nil
}
func (s *c064TestStore) Load(ctx context.Context, scope C064AuthorScope, id, author string, revision uint64) (C064DraftVersion, error) {
	s.mu.Lock(); defer s.mu.Unlock()
	all := s.versions[scope][id]
	if ctx.Err() != nil || len(all) == 0 || all[0].AuthorID != author { return C064DraftVersion{}, ErrAuthorDenied }
	if revision == 0 { revision = uint64(len(all)) }
	if revision > uint64(len(all)) { return C064DraftVersion{}, ErrAuthorDenied }
	return c064Copy(all[revision-1]), nil
}
func c064FixtureSchema() CompliancePolicySchema {
	return CompliancePolicySchema{Version: "420compliance-policy-schema/v1", PolicyID: "draft1", AuthorityGraphVersion: "graph-v1", LegalJurisdictionID: "bc",
		EffectiveFrom: time.Now().UTC().Add(-time.Hour).Truncate(time.Second),
		Actors: []PolicyActor{{Role: "retailer", IssuerID: "issuer"}},
		Products: []PolicyProduct{{Class: "flower", Unit: "gram", EquivalencyNumerator: 1, EquivalencyDenominator: 1}},
		Stages: []PolicyStage{{Name: "handover", RequiredCredentials: []string{"retailer_licence"}, RecipientVerification: "verified_recipient", PaymentPrerequisite: "permitted_workflow", ReturnDuty: "reviewed_return", RecordObligation: "handover_record"}},
		Hours: PolicyHours{Timezone: "America/Vancouver", StartLocal: "09:00", EndLocal: "17:00"},
		RequiredRecords: []string{"handover_record"}, ReviewState: "DRAFT_REVIEW_REQUIRED"}
}
func c064FixtureRequest() C064SaveRequest {
	return C064SaveRequest{Schema: c064FixtureSchema(), Citations: []C064CitationRef{{SourceID: "FED-ACT", Digest: Digest([]byte("fixture snapshot")), Locator: "section-1"}}}
}
func c064Fixture() (C064AuthorWorkspace, *c064TestAuthority, *c064TestStore) {
	now := time.Now().UTC()
	auth := &c064TestAuthority{session: C064AuthorSession{Scope: c064FixtureScope, SubjectID: "author-a", SessionID: "session-a", Role: "author", Audience: "420compliance-author", CSRFToken: strings.Repeat("C",64), IssuedAt: now.Add(-time.Minute), ExpiresAt: now.Add(10*time.Minute), GrantExpiresAt: now.Add(time.Hour), AuthenticatedAt: now.Add(-time.Minute), MFAAt: now.Add(-time.Minute)}}
	store := &c064TestStore{}
	return C064AuthorWorkspace{Authority: auth, Sources: c064TestSource{}, Store: store, Origin: "https://workspace.example"}, auth, store
}
func c064HTTP(a C064AuthorWorkspace, method, path string, body []byte, mutate func(*http.Request)) *httptest.ResponseRecorder {
	r := httptest.NewRequest(method, "https://workspace.example"+path, bytes.NewReader(body))
	r.AddCookie(&http.Cookie{Name: "__Host-420ComplianceAuthor", Value: c064FixtureToken})
	r.Header.Set("Origin", a.Origin)
	r.Header.Set("X-CSRF-Token", strings.Repeat("C",64))
	r.Header.Set("Content-Type", "application/json")
	if mutate != nil { mutate(r) }
	w := httptest.NewRecorder(); a.ServeHTTP(w,r); return w
}
func c064Body(v any) []byte { data, _ := json.Marshal(v); return data }

func TestC064AuthorWorkspaceSecurityAndEditing(t *testing.T) {
	a, auth, store := c064Fixture()
	request := c064FixtureRequest()
	w := c064HTTP(a, "PUT", "/api/v1/author/drafts/draft1", c064Body(request), nil)
	if w.Code != 200 { t.Fatalf("save: %d %s",w.Code,w.Body.String()) }
	var first C064DraftVersion
	if json.Unmarshal(w.Body.Bytes(), &first) != nil || first.Revision != 1 || first.AuthorID != "author-a" || first.Schema.ReviewState != "DRAFT_REVIEW_REQUIRED" || first.Citations[0].Excerpt != "<script>fixture source text</script>" { t.Fatal("cited private draft mismatch") }
	for name, value := range map[string]string{"Cache-Control":"no-store, private","X-Frame-Options":"DENY","Referrer-Policy":"no-referrer"} {
		if w.Header().Get(name) != value { t.Fatal("missing private response header",name) }
	}
	request.ExpectedRevision = 1
	request.Schema.Hours.EndLocal = "18:00"
	w = c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(request),nil)
	if w.Code != 200 { t.Fatal("second revision",w.Code,w.Body.String()) }
	w = c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(request),nil)
	if w.Code != 409 { t.Fatal("replayed/stale edit accepted",w.Code) }
	w = c064HTTP(a,"GET","/api/v1/author/drafts/draft1?revision=1",nil,nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(), "17:00") { t.Fatal("prior immutable version changed") }
	w = c064HTTP(a,"GET","/api/v1/author/drafts/draft1/compare?from=1&to=2",nil,nil)
	var diff C064Comparison
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(),&diff) != nil || len(diff.Changes) != 1 || diff.Changes[0].Field != "Hours" { t.Fatal("structured comparison",w.Body.String()) }
	w = c064HTTP(a,"POST","/api/v1/author/citations",c064Body(map[string]any{"citations":request.Citations}),nil)
	if w.Code != 200 || !strings.Contains(w.Body.String(),"fixture source text") { t.Fatal("citation preview",w.Code) }
	for _, path := range []string{"/private/author","/private/author/editor.js","/private/author/style.css"} {
		w = c064HTTP(a,"GET",path,nil,nil)
		if w.Code != 200 || !strings.Contains(w.Header().Get("Content-Security-Policy"),"frame-ancestors 'none'") { t.Fatal("private asset",path,w.Code) }
		w = c064HTTP(a,"GET",path,nil,func(r *http.Request){r.Header.Del("Cookie")})
		if w.Code != 401 || strings.Contains(w.Body.String(),"Prepare a cited policy") { t.Fatal("anonymous private asset leaked") }
	}
	for _, mutate := range []func(*http.Request){
		func(r *http.Request){r.Header.Del("Cookie")},
		func(r *http.Request){r.Header.Set("X-CSRF-Token","fake")},
		func(r *http.Request){r.Header.Set("Origin","https://evil.example")},
		func(r *http.Request){r.Header.Set("Sec-Fetch-Site","cross-site")},
		func(r *http.Request){r.TLS=nil},
		func(r *http.Request){r.Host="evil.example"},
	} {
		w = c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(request),mutate)
		if w.Code != 401 && w.Code != 403 { t.Fatal("authentication/CSRF boundary",w.Code) }
	}
	for _, body := range [][]byte{
		[]byte(`{"expected_revision":0,"expected_revision":1}`),
		[]byte(`{"schema":{"ReviewState":"DRAFT_REVIEW_REQUIRED","reviewstate":"APPROVED"}}`),
		[]byte(`{"author_id":"other","role":"publisher"}`),
		[]byte(`{} {}`),
		bytes.Repeat([]byte("x"), 65537),
	} {
		w = c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",body,nil)
		if w.Code != 400 { t.Fatal("closed schema/body limit",w.Code) }
	}
	for _, path := range []string{"/api/v1/author/drafts/draft1?tenant=other","/api/v1/author/drafts/draft1?revision=1&revision=2","/api/v1/author/drafts/draft1?x=%ZZ","/api/v1/author/drafts/draft1/compare?from=0&to=2"} {
		if c064HTTP(a,"GET",path,nil,nil).Code != 400 { t.Fatal("query boundary",path) }
	}
	request.ExpectedRevision=2
	for _, mutate := range []func(*C064SaveRequest){
		func(r *C064SaveRequest){r.Schema.ReviewState="APPROVED"},
		func(r *C064SaveRequest){r.Schema.LegalJurisdictionID="other"},
		func(r *C064SaveRequest){r.Schema.PolicyID="other"},
		func(r *C064SaveRequest){r.Schema.SourceDigest=Digest([]byte("wrong"))},
		func(r *C064SaveRequest){r.Citations[0].Digest=Digest([]byte("missing"))},
		func(r *C064SaveRequest){r.Citations=append(r.Citations,r.Citations[0])},
		func(r *C064SaveRequest){r.Schema.Stages[0].ReturnDuty=""},
	} {
		var changed C064SaveRequest; _ = json.Unmarshal(c064Body(request),&changed); mutate(&changed)
		if c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(changed),nil).Code != 400 { t.Fatal("schema/provenance bypass") }
	}
	auth.mu.Lock(); auth.session.SubjectID="other-author"; auth.mu.Unlock()
	w=c064HTTP(a,"GET","/api/v1/author/drafts/draft1",nil,nil)
	if w.Code != 404 || strings.Contains(w.Body.String(),"fixture source text") { t.Fatal("cross-author read") }
	auth.mu.Lock(); auth.session.SubjectID="author-a"; auth.session.Scope.Tenant="other"; auth.mu.Unlock()
	if c064HTTP(a,"GET","/api/v1/author/drafts/draft1",nil,nil).Code != 404 { t.Fatal("cross-tenant read") }
	auth.mu.Lock(); auth.session.Scope=c064FixtureScope; auth.mu.Unlock()
	a.Sources=c064TestSource{hook:func(){auth.mu.Lock();auth.session.Revoked=true;auth.mu.Unlock()}}
	if c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(request),nil).Code != 401 { t.Fatal("revocation during source read") }
	v,_:=store.Load(context.Background(),c064FixtureScope,"draft1","author-a",0)
	if v.Revision != 2 { t.Fatal("revoked author mutation") }
}

func TestC064AuthorSessionAndFailureGates(t *testing.T) {
	for _, mutate := range []func(*C064AuthorSession){
		func(s *C064AuthorSession){s.Role="reviewer"},
		func(s *C064AuthorSession){s.Revoked=true},
		func(s *C064AuthorSession){s.Audience="420compliance-review"},
		func(s *C064AuthorSession){s.ExpiresAt=time.Now().Add(-time.Second)},
		func(s *C064AuthorSession){s.MFAAt=time.Now().Add(-6*time.Minute)},
		func(s *C064AuthorSession){s.GrantExpiresAt=time.Now().Add(-time.Second)},
		func(s *C064AuthorSession){s.IssuedAt=time.Now().Add(time.Hour)},
		func(s *C064AuthorSession){s.CSRFToken="weak"},
	} {
		a,auth,_:=c064Fixture();auth.mu.Lock();mutate(&auth.session);auth.mu.Unlock()
		if c064HTTP(a,"GET","/api/v1/author/session",nil,nil).Code!=401 {t.Fatal("session gate")}
	}
	a,auth,_:=c064Fixture()
	w:=c064HTTP(a,"POST","/api/v1/author/logout",nil,nil)
	if w.Code!=204||!auth.session.Revoked||len(w.Result().Cookies())!=1||!w.Result().Cookies()[0].HttpOnly||!w.Result().Cookies()[0].Secure {t.Fatal("authoritative logout")}
	if c064HTTP(a,"GET","/private/author",nil,nil).Code!=401 {t.Fatal("logout did not revoke")}
	a,_,_=c064Fixture();a.Authority=nil
	if c064HTTP(a,"GET","/private/author",nil,nil).Code!=503 {t.Fatal("missing provider enabled workspace")}
	a,_,_=c064Fixture();a.Sources=c064TestSource{invalid:true}
	if c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(c064FixtureRequest()),nil).Code!=400 {t.Fatal("quarantined source accepted")}
	a,auth,_=c064Fixture()
	a.Sources=c064TestSource{hook:func(){auth.mu.Lock();auth.session.GrantExpiresAt=time.Now().Add(time.Second);auth.mu.Unlock()}}
	if c064HTTP(a,"PUT","/api/v1/author/drafts/draft1",c064Body(c064FixtureRequest()),nil).Code!=401 {t.Fatal("shortened grant expiry ignored")}
}

type c064ArchiveParser struct{}
func (c064ArchiveParser) Parse(_ string, body []byte) (ParseResult,error) { return ParseResult{Text:string(body),Version:"fixture-v1",Anchors:[]CitationAnchor{{Locator:"section-1",Excerpt:string(body)}}},nil }
func TestC064AuthorArchiveCitationsIntegrity(t *testing.T) {
	body:=[]byte("fixture cited instrument")
	archive:=SnapshotArchive{Root:t.TempDir(),Parser:c064ArchiveParser{}}
	record,err:=archive.Ingest(Snapshot{SourceID:"FED-ACT",Body:body,Digest:Digest(body),ContentType:"text/html",RetrievedAt:time.Now().Add(-time.Hour),Status:200,Archived:true})
	if err!=nil {t.Fatal(err)}
	adapter:=C064ArchiveCitations{Archive:archive,Allowed:map[C064AuthorScope]map[string]bool{c064FixtureScope:{"FED-ACT":true}}}
	ref:=C064CitationRef{SourceID:"FED-ACT",Digest:record.Digest,Locator:"section-1"}
	got,err:=adapter.Citation(context.Background(),c064FixtureScope,ref)
	if err!=nil||got.Excerpt!=string(body) {t.Fatal("pinned source",err)}
	if _,err:=adapter.Citation(context.Background(),C064AuthorScope{Tenant:"other"},ref);!errors.Is(err,ErrAuthorDenied) {t.Fatal("source scope bypass")}
	ref.Locator="missing";if _,err:=adapter.Citation(context.Background(),c064FixtureScope,ref);err==nil {t.Fatal("fabricated locator")}
	ref.Locator="section-1"
	files,_:=filepath.Glob(filepath.Join(archive.Root,"FED-ACT","*.raw"));if len(files)!=1 {t.Fatal("raw archive fixture")}
	if err:=os.WriteFile(files[0],[]byte("corrupt"),0600);err!=nil {t.Fatal(err)}
	if _,err:=adapter.Citation(context.Background(),c064FixtureScope,ref);err==nil {t.Fatal("corrupt source accepted")}
}
