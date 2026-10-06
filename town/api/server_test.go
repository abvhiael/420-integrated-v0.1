package api

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
	"github.com/420integrated/420-integrated/town/moderation"
	"github.com/420integrated/420-integrated/town/projection"
)

type backendFake struct {
	createPostErr error
	lastActor     model.ObjectID
	lastPost      content.CreatePostRequest
}

func (b *backendFake) CreatePost(actor model.ObjectID, req content.CreatePostRequest) (content.Post, error) {
	b.lastActor = actor
	b.lastPost = req
	if b.createPostErr != nil {
		return content.Post{}, b.createPostErr
	}
	return content.Post{
		ID:          req.ID,
		CommunityID: req.CommunityID,
		AuthorID:    actor,
		Anchor:      req.Anchor,
		Visibility:  req.Visibility,
		Revision:    1,
		Status:      content.StatusActive,
		CreatedAt:   time.Unix(1, 0).UTC(),
		UpdatedAt:   time.Unix(1, 0).UTC(),
	}, nil
}

func (b *backendFake) GetPost(viewer content.ViewerContext, id model.ObjectID) (content.Post, error) {
	if id == "missing" {
		return content.Post{}, content.ErrNotFound
	}
	return content.Post{
		ID:          id,
		CommunityID: "community:1",
		AuthorID:    "actor:alice",
		Visibility:  model.VisibilityPublic,
		Revision:    1,
		Status:      content.StatusActive,
	}, nil
}

func (b *backendFake) CreateThread(actor model.ObjectID, req content.CreateThreadRequest) (content.Thread, error) {
	return content.Thread{
		ID:          req.ID,
		RootPostID:  req.RootPostID,
		AuthorID:    actor,
		CommunityID: "community:1",
		Status:      content.StatusActive,
	}, nil
}

func (b *backendFake) CreateComment(actor model.ObjectID, req content.CreateCommentRequest) (content.Comment, error) {
	return content.Comment{
		ID:          req.ID,
		ThreadID:    req.ThreadID,
		ParentID:    req.ParentID,
		AuthorID:    actor,
		CommunityID: "community:1",
		Anchor:      req.Anchor,
		Visibility:  model.VisibilityPublic,
		Revision:    1,
		Status:      content.StatusActive,
	}, nil
}

func (b *backendFake) SetVote(actor model.ObjectID, req content.SetVoteRequest) (content.Vote, error) {
	if req.Value != 1 && req.Value != -1 {
		return content.Vote{}, content.ErrInvalidInput
	}
	return content.Vote{
		TargetKind: req.TargetKind,
		TargetID:   req.TargetID,
		VoterID:    actor,
		Value:      req.Value,
		Active:     true,
		Revision:   1,
	}, nil
}

func apiFixture(t *testing.T) (*Server, *backendFake, *projection.Store) {
	t.Helper()

	projections := projection.NewStore()
	err := projections.ApplyBlock(projection.Block{Height: 1, Hash: "h1", Events: []projection.Event{
		{ID: "e1", Kind: projection.EventPostUpsert, Post: projection.PostDocument{
			ID:            "post:1",
			CommunityID:   "community:1",
			AuthorID:      "actor:alice",
			Visibility:    model.VisibilityPublic,
			ContentRef:    "storage://1",
			ContentSHA256: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
			Revision:      1,
			UpdatedAt:     time.Unix(1, 0).UTC(),
		}},
		{ID: "e2", Kind: projection.EventPostUpsert, Post: projection.PostDocument{
			ID:            "post:2",
			CommunityID:   "community:1",
			AuthorID:      "actor:alice",
			Visibility:    model.VisibilityCommunityOnly,
			ContentRef:    "storage://2",
			ContentSHA256: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
			Revision:      1,
			UpdatedAt:     time.Unix(2, 0).UTC(),
		}},
	}})
	if err != nil {
		t.Fatal(err)
	}

	backend := &backendFake{}
	server, err := NewServer(
		backend,
		projections,
		StaticTokenAuthenticator{Tokens: map[string]model.ObjectID{"good": "actor:alice"}},
		nil,
	)
	if err != nil {
		t.Fatal(err)
	}
	return server, backend, projections
}

func TestV1PublicListUsesProjectionAndCursorBounds(t *testing.T) {
	server, _, _ := apiFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/communities/community:1/posts?limit=1", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("code=%d body=%s", res.Code, res.Body.String())
	}

	var body struct {
		Items      []projection.PostDocument
		NextCursor string
		Generation uint64
	}
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if len(body.Items) != 1 || body.Items[0].ID != "post:1" {
		t.Fatalf("body=%+v", body)
	}
	if body.Items[0].Visibility != model.VisibilityPublic {
		t.Fatal("non-public item leaked")
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/communities/community:1/posts?limit=201", nil)
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("limit code=%d", res.Code)
	}
}

func TestMutationRequiresAuthenticationAndIdempotency(t *testing.T) {
	server, backend, _ := apiFixture(t)
	payload := []byte("{\"ID\":\"post:9\",\"ContentRef\":\"storage://9\",\"SHA256\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"Visibility\":\"PUBLIC\"}")

	req := httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewReader(payload))
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("unauth code=%d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer good")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("missing idem code=%d", res.Code)
	}

	req = httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewReader(payload))
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "idem-1")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("create code=%d body=%s", res.Code, res.Body.String())
	}
	if backend.lastActor != "actor:alice" || backend.lastPost.IdempotencyKey != "idem-1" || backend.lastPost.ID != "post:9" {
		t.Fatalf("backend actor=%s req=%+v", backend.lastActor, backend.lastPost)
	}
}

func TestAPIRejectsUnknownFieldsAndMapsBackendErrors(t *testing.T) {
	server, backend, _ := apiFixture(t)

	req := httptest.NewRequest(
		http.MethodPost,
		"/v1/communities/community:1/posts",
		bytes.NewBufferString("{\"ID\":\"post:9\",\"Bogus\":true}"),
	)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "idem")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("unknown field code=%d", res.Code)
	}

	backend.createPostErr = content.ErrRateLimited
	req = httptest.NewRequest(
		http.MethodPost,
		"/v1/communities/community:1/posts",
		bytes.NewBufferString("{\"ID\":\"post:9\",\"ContentRef\":\"r\",\"SHA256\":\"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc\",\"Visibility\":\"PUBLIC\"}"),
	)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "idem2")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusTooManyRequests {
		t.Fatalf("rate code=%d body=%s", res.Code, res.Body.String())
	}
}

func TestGetPostAllowsAnonymousPublicReadAndMapsNotFound(t *testing.T) {
	server, _, _ := apiFixture(t)

	req := httptest.NewRequest(http.MethodGet, "/v1/posts/post:1", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("read code=%d body=%s", res.Code, res.Body.String())
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/posts/missing", nil)
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusNotFound {
		t.Fatalf("missing code=%d", res.Code)
	}
}

func TestHealthAndMetricsAreNonCanonical(t *testing.T) {
	server, _, _ := apiFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/health", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatal(res.Code)
	}

	var body map[string]any
	if err := json.Unmarshal(res.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["canonical"] != false {
		t.Fatalf("health=%v", body)
	}
	if server.Metrics().Requests == 0 {
		t.Fatal("request counter not incremented")
	}
}

func TestNewServerRequiresDependencies(t *testing.T) {
	_, err := NewServer(nil, projection.NewStore(), StaticTokenAuthenticator{Tokens: map[string]model.ObjectID{}}, nil)
	if err == nil {
		t.Fatal("expected backend requirement")
	}
	_, err = NewServer(&backendFake{}, nil, StaticTokenAuthenticator{Tokens: map[string]model.ObjectID{}}, nil)
	if err == nil {
		t.Fatal("expected projection requirement")
	}
	_, err = NewServer(&backendFake{}, projection.NewStore(), nil, nil)
	if err == nil {
		t.Fatal("expected authenticator requirement")
	}
}

func TestAuthRejectsUnknownToken(t *testing.T) {
	server, _, _ := apiFixture(t)
	req := httptest.NewRequest(http.MethodPost, "/v1/communities/community:1/posts", bytes.NewBufferString("{}"))
	req.Header.Set("Authorization", "Bearer bad")
	req.Header.Set("Idempotency-Key", "idem")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("code=%d", res.Code)
	}
	if server.Metrics().AuthFailures == 0 {
		t.Fatal("auth failure metric missing")
	}
}

func TestProjectionErrorsMapToBadRequest(t *testing.T) {
	server, _, _ := apiFixture(t)
	req := httptest.NewRequest(http.MethodGet, "/v1/communities/community:1/posts?cursor=%25%25%25", nil)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusBadRequest {
		t.Fatalf("code=%d", res.Code)
	}
}


type moderationFake struct {
	report moderation.OpenCaseRequest
	action moderation.ModerateRequest
	appeal moderation.AppealRequest
}

func (m *moderationFake) Report(actor model.ObjectID, req moderation.OpenCaseRequest) (moderation.Record, error) {
	m.report = req
	return moderation.Record{
		ID:           req.RecordID,
		CaseID:       req.CaseID,
		CommunityID:  req.CommunityID,
		TargetKind:   req.TargetKind,
		TargetID:     req.TargetID,
		ActorID:      actor,
		Action:       moderation.ActionReport,
	}, nil
}

func (m *moderationFake) Moderate(actor model.ObjectID, req moderation.ModerateRequest) (moderation.Record, error) {
	m.action = req
	return moderation.Record{
		ID:      req.RecordID,
		CaseID:  req.CaseID,
		ActorID: actor,
		Action:  req.Action,
	}, nil
}

func (m *moderationFake) Appeal(actor model.ObjectID, req moderation.AppealRequest) (moderation.Record, error) {
	m.appeal = req
	return moderation.Record{
		ID:      req.RecordID,
		CaseID:  req.CaseID,
		ActorID: actor,
		Action:  moderation.ActionAppeal,
	}, nil
}

func (m *moderationFake) Case(id model.ObjectID) (moderation.Case, bool) {
	if id == "missing" {
		return moderation.Case{}, false
	}
	return moderation.Case{
		ID:          id,
		CommunityID: "community:1",
		TargetKind:  moderation.TargetPost,
		TargetID:    "post:1",
		AffectedID:  "actor:bob",
		State:       moderation.StateOpen,
		Version:     1,
	}, true
}

func TestModerationRoutesRequireAuthIdempotencyAndDelegate(t *testing.T) {
	server, _, _ := apiFixture(t)
	mod := &moderationFake{}
	server.SetModerationBackend(mod)

	req := httptest.NewRequest(
		http.MethodPost,
		"/v1/moderation/reports",
		bytes.NewBufferString(`{"RecordID":"record:1","CaseID":"case:1","CommunityID":"community:1","TargetKind":"POST","TargetID":"post:1","Reason":"SPAM","BodyRef":"","BodySHA256":""}`),
	)
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusUnauthorized {
		t.Fatalf("unauth code=%d", res.Code)
	}

	req = httptest.NewRequest(
		http.MethodPost,
		"/v1/moderation/reports",
		bytes.NewBufferString(`{"RecordID":"record:1","CaseID":"case:1","CommunityID":"community:1","TargetKind":"POST","TargetID":"post:1","Reason":"SPAM","BodyRef":"","BodySHA256":""}`),
	)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "report-1")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusCreated {
		t.Fatalf("report code=%d body=%s", res.Code, res.Body.String())
	}
	if mod.report.CaseID != "case:1" || mod.report.IdempotencyKey != "report-1" {
		t.Fatalf("report=%+v", mod.report)
	}

	req = httptest.NewRequest(
		http.MethodPost,
		"/v1/moderation/cases/case:1/actions",
		bytes.NewBufferString(`{"RecordID":"record:2","Action":"HIDE","Reason":"SPAM","BodyRef":"","BodySHA256":""}`),
	)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "action-1")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK || mod.action.Action != moderation.ActionHide {
		t.Fatalf("action code=%d action=%+v", res.Code, mod.action)
	}

	req = httptest.NewRequest(http.MethodGet, "/v1/moderation/cases/case:1", nil)
	req.Header.Set("Authorization", "Bearer good")
	res = httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusOK {
		t.Fatalf("case code=%d", res.Code)
	}
}

func TestModerationRoutesFailClosedWithoutBackend(t *testing.T) {
	server, _, _ := apiFixture(t)
	req := httptest.NewRequest(
		http.MethodPost,
		"/v1/moderation/reports",
		bytes.NewBufferString(`{"RecordID":"record:1","CaseID":"case:1","CommunityID":"community:1","TargetKind":"POST","TargetID":"post:1","Reason":"SPAM"}`),
	)
	req.Header.Set("Authorization", "Bearer good")
	req.Header.Set("Idempotency-Key", "report-1")
	res := httptest.NewRecorder()
	server.Handler().ServeHTTP(res, req)
	if res.Code != http.StatusServiceUnavailable {
		t.Fatalf("code=%d", res.Code)
	}
}
