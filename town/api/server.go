package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync/atomic"
	"time"

	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
	"github.com/420integrated/420-integrated/town/projection"
)

const maxRequestBytes = 64 << 10

var (
	ErrAuthRequired = errors.New("authentication required")
	ErrAuthInvalid = errors.New("invalid authentication")
)

type ContentBackend interface {
	CreatePost(model.ObjectID, content.CreatePostRequest) (content.Post,error)
	GetPost(content.ViewerContext, model.ObjectID) (content.Post,error)
	CreateThread(model.ObjectID, content.CreateThreadRequest) (content.Thread,error)
	CreateComment(model.ObjectID, content.CreateCommentRequest) (content.Comment,error)
	SetVote(model.ObjectID, content.SetVoteRequest) (content.Vote,error)
}

type ProjectionReader interface {
	ListPublicPosts(model.ObjectID,string,int)(projection.Page,error)
	Checkpoint() projection.Checkpoint
}

type Authenticator interface {
	Authenticate(*http.Request)(model.ObjectID,error)
}

type ViewerResolver interface {
	ResolveViewer(*http.Request,model.ObjectID) content.ViewerContext
}

type ActorOnlyViewer struct{}
func (ActorOnlyViewer) ResolveViewer(_ *http.Request,actor model.ObjectID) content.ViewerContext{return content.ViewerContext{ActorID:actor}}

type StaticTokenAuthenticator struct{ Tokens map[string]model.ObjectID }
func (a StaticTokenAuthenticator) Authenticate(r *http.Request)(model.ObjectID,error){
	raw:=strings.TrimSpace(r.Header.Get("Authorization"))
	if raw==""{return "",ErrAuthRequired}
	parts:=strings.SplitN(raw," ",2)
	if len(parts)!=2 || !strings.EqualFold(parts[0],"Bearer") || strings.TrimSpace(parts[1])==""{return "",ErrAuthInvalid}
	id,ok:=a.Tokens[strings.TrimSpace(parts[1])]
	if !ok || !id.Valid(){return "",ErrAuthInvalid}
	return id,nil
}

type MetricsSnapshot struct {
	Requests uint64
	Errors uint64
	AuthFailures uint64
	Mutations uint64
	TotalLatencyNanos uint64
}

type Server struct {
	backend ContentBackend
	projections ProjectionReader
	auth Authenticator
	viewers ViewerResolver
	requests atomic.Uint64
	errors atomic.Uint64
	authFailures atomic.Uint64
	mutations atomic.Uint64
	latency atomic.Uint64
}

func NewServer(backend ContentBackend,projections ProjectionReader,auth Authenticator,viewers ViewerResolver)(*Server,error){
	if backend==nil || projections==nil || auth==nil{return nil,errors.New("Town API requires backend, projection reader and authenticator")}
	if viewers==nil{viewers=ActorOnlyViewer{}}
	return &Server{backend:backend,projections:projections,auth:auth,viewers:viewers},nil
}

func (s *Server) Handler() http.Handler {
	mux:=http.NewServeMux()
	mux.HandleFunc("GET /v1/health",s.wrap(s.handleHealth))
	mux.HandleFunc("GET /v1/communities/{community}/posts",s.wrap(s.handleListPosts))
	mux.HandleFunc("POST /v1/communities/{community}/posts",s.wrap(s.handleCreatePost))
	mux.HandleFunc("GET /v1/posts/{post}",s.wrap(s.handleGetPost))
	mux.HandleFunc("POST /v1/posts/{post}/threads",s.wrap(s.handleCreateThread))
	mux.HandleFunc("POST /v1/threads/{thread}/comments",s.wrap(s.handleCreateComment))
	mux.HandleFunc("POST /v1/posts/{post}/votes",s.wrap(s.handlePostVote))
	return mux
}

func (s *Server) Metrics() MetricsSnapshot {
	return MetricsSnapshot{Requests:s.requests.Load(),Errors:s.errors.Load(),AuthFailures:s.authFailures.Load(),Mutations:s.mutations.Load(),TotalLatencyNanos:s.latency.Load()}
}

func (s *Server) wrap(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter,r *http.Request){
		start:=time.Now()
		s.requests.Add(1)
		defer func(){s.latency.Add(uint64(time.Since(start).Nanoseconds()))}()
		next(w,r)
	}
}

func (s *Server) handleHealth(w http.ResponseWriter,_ *http.Request){
	writeJSON(w,http.StatusOK,map[string]any{"service":"420Town","version":"v1","canonical":false,"projection_checkpoint":s.projections.Checkpoint(),"metrics":s.Metrics()})
}

func (s *Server) handleListPosts(w http.ResponseWriter,r *http.Request){
	community:=model.ObjectID(r.PathValue("community"))
	if !community.Valid(){s.fail(w,http.StatusBadRequest,"invalid community id");return}
	limit:=50
	if raw:=r.URL.Query().Get("limit");raw!=""{
		v,err:=strconv.Atoi(raw);if err!=nil||v<1||v>200{s.fail(w,http.StatusBadRequest,"limit must be between 1 and 200");return};limit=v
	}
	page,err:=s.projections.ListPublicPosts(community,r.URL.Query().Get("cursor"),limit)
	if err!=nil{
		if errors.Is(err,projection.ErrInvalidCursor)||errors.Is(err,projection.ErrStaleCursor){s.fail(w,http.StatusBadRequest,err.Error());return}
		s.fail(w,http.StatusInternalServerError,"projection unavailable");return
	}
	writeJSON(w,http.StatusOK,map[string]any{"canonical":false,"items":page.Items,"next_cursor":page.NextCursor,"generation":page.Generation})
}

func (s *Server) handleCreatePost(w http.ResponseWriter,r *http.Request){
	actor,ok:=s.requireActor(w,r);if !ok{return}
	key,ok:=s.idempotency(w,r);if !ok{return}
	community:=model.ObjectID(r.PathValue("community"));if !community.Valid(){s.fail(w,http.StatusBadRequest,"invalid community id");return}
	var body struct{ID string;ContentRef string;SHA256 string;Visibility model.Visibility}
	if !s.decode(w,r,&body){return}
	req:=content.CreatePostRequest{ID:model.ObjectID(body.ID),CommunityID:community,Anchor:content.ContentAnchor{Ref:body.ContentRef,SHA256:body.SHA256},Visibility:body.Visibility,IdempotencyKey:key}
	p,err:=s.backend.CreatePost(actor,req);if err!=nil{s.contentError(w,err);return}
	s.mutations.Add(1);writeJSON(w,http.StatusCreated,p)
}

func (s *Server) handleGetPost(w http.ResponseWriter,r *http.Request){
	actor:=""
	if strings.TrimSpace(r.Header.Get("Authorization"))!=""{
		id,err:=s.auth.Authenticate(r);if err!=nil{s.authFailures.Add(1);s.fail(w,http.StatusUnauthorized,"invalid authentication");return};actor=string(id)
	}
	id:=model.ObjectID(r.PathValue("post"));if !id.Valid(){s.fail(w,http.StatusBadRequest,"invalid post id");return}
	p,err:=s.backend.GetPost(s.viewers.ResolveViewer(r,model.ObjectID(actor)),id);if err!=nil{s.contentError(w,err);return}
	writeJSON(w,http.StatusOK,p)
}

func (s *Server) handleCreateThread(w http.ResponseWriter,r *http.Request){
	actor,ok:=s.requireActor(w,r);if !ok{return}
	key,ok:=s.idempotency(w,r);if !ok{return}
	post:=model.ObjectID(r.PathValue("post"));if !post.Valid(){s.fail(w,http.StatusBadRequest,"invalid post id");return}
	var body struct{ID string}
	if !s.decode(w,r,&body){return}
	th,err:=s.backend.CreateThread(actor,content.CreateThreadRequest{ID:model.ObjectID(body.ID),RootPostID:post,IdempotencyKey:key});if err!=nil{s.contentError(w,err);return}
	s.mutations.Add(1);writeJSON(w,http.StatusCreated,th)
}

func (s *Server) handleCreateComment(w http.ResponseWriter,r *http.Request){
	actor,ok:=s.requireActor(w,r);if !ok{return}
	key,ok:=s.idempotency(w,r);if !ok{return}
	thread:=model.ObjectID(r.PathValue("thread"));if !thread.Valid(){s.fail(w,http.StatusBadRequest,"invalid thread id");return}
	var body struct{ID string;ParentID string;ContentRef string;SHA256 string}
	if !s.decode(w,r,&body){return}
	req:=content.CreateCommentRequest{ID:model.ObjectID(body.ID),ThreadID:thread,ParentID:model.ObjectID(body.ParentID),Anchor:content.ContentAnchor{Ref:body.ContentRef,SHA256:body.SHA256},IdempotencyKey:key,Viewer:s.viewers.ResolveViewer(r,actor)}
	c,err:=s.backend.CreateComment(actor,req);if err!=nil{s.contentError(w,err);return}
	s.mutations.Add(1);writeJSON(w,http.StatusCreated,c)
}

func (s *Server) handlePostVote(w http.ResponseWriter,r *http.Request){
	actor,ok:=s.requireActor(w,r);if !ok{return}
	key,ok:=s.idempotency(w,r);if !ok{return}
	post:=model.ObjectID(r.PathValue("post"));if !post.Valid(){s.fail(w,http.StatusBadRequest,"invalid post id");return}
	var body struct{Value int8}
	if !s.decode(w,r,&body){return}
	v,err:=s.backend.SetVote(actor,content.SetVoteRequest{TargetKind:content.TargetPost,TargetID:post,Value:body.Value,IdempotencyKey:key,Viewer:s.viewers.ResolveViewer(r,actor)});if err!=nil{s.contentError(w,err);return}
	s.mutations.Add(1);writeJSON(w,http.StatusOK,v)
}

func (s *Server) requireActor(w http.ResponseWriter,r *http.Request)(model.ObjectID,bool){
	id,err:=s.auth.Authenticate(r)
	if err!=nil{s.authFailures.Add(1);s.fail(w,http.StatusUnauthorized,"authentication required");return "",false}
	return id,true
}

func (s *Server) idempotency(w http.ResponseWriter,r *http.Request)(string,bool){
	key:=strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key=="" || len(key)>256{s.fail(w,http.StatusBadRequest,"valid Idempotency-Key is required");return "",false}
	return key,true
}

func (s *Server) decode(w http.ResponseWriter,r *http.Request,out any)bool{
	r.Body=http.MaxBytesReader(w,r.Body,maxRequestBytes)
	dec:=json.NewDecoder(r.Body);dec.DisallowUnknownFields()
	if err:=dec.Decode(out);err!=nil{s.fail(w,http.StatusBadRequest,"invalid JSON body");return false}
	var extra any
	if err:=dec.Decode(&extra);err!=io.EOF{s.fail(w,http.StatusBadRequest,"request body must contain one JSON object");return false}
	return true
}

func (s *Server) contentError(w http.ResponseWriter,err error){
	switch {
	case errors.Is(err,content.ErrInvalidInput):s.fail(w,http.StatusBadRequest,err.Error())
	case errors.Is(err,content.ErrUnauthorized),errors.Is(err,content.ErrVisibilityDenied),errors.Is(err,content.ErrModerationDenied):s.fail(w,http.StatusForbidden,err.Error())
	case errors.Is(err,content.ErrNotFound):s.fail(w,http.StatusNotFound,err.Error())
	case errors.Is(err,content.ErrConflict),errors.Is(err,content.ErrIdempotencyConflict),errors.Is(err,content.ErrTombstoned),errors.Is(err,content.ErrDuplicateContent):s.fail(w,http.StatusConflict,err.Error())
	case errors.Is(err,content.ErrRateLimited):s.fail(w,http.StatusTooManyRequests,err.Error())
	default:s.fail(w,http.StatusInternalServerError,"Town service error")
	}
}

func (s *Server) fail(w http.ResponseWriter,status int,message string){s.errors.Add(1);writeJSON(w,status,map[string]any{"error":message})}

func writeJSON(w http.ResponseWriter,status int,value any){
	w.Header().Set("Content-Type","application/json")
	w.Header().Set("X-Content-Type-Options","nosniff")
	w.Header().Set("Cache-Control","no-store")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
