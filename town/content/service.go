package content

import (
	"errors"
	"fmt"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

type ContentStatus string

const (
	StatusActive     ContentStatus = "ACTIVE"
	StatusTombstoned ContentStatus = "TOMBSTONED"
)

type TargetKind string

const (
	TargetPost    TargetKind = "POST"
	TargetComment TargetKind = "COMMENT"
)

type AssuranceTier string

const (
	AssuranceUnverified AssuranceTier = "UNVERIFIED"
	AssuranceVerified   AssuranceTier = "VERIFIED"
)

var (
	ErrInvalidInput        = errors.New("invalid input")
	ErrUnauthorized        = errors.New("unauthorized")
	ErrNotFound            = errors.New("not found")
	ErrConflict            = errors.New("conflict")
	ErrTombstoned          = errors.New("tombstoned")
	ErrVisibilityDenied    = errors.New("visibility denied")
	ErrIdempotencyConflict = errors.New("idempotency conflict")
	ErrRateLimited         = errors.New("rate limited")
	ErrDuplicateContent    = errors.New("duplicate content")
	ErrModerationDenied    = errors.New("moderation denied")
)

type ContentAnchor struct {
	Ref    string
	SHA256 string
}

type Post struct {
	ID          model.ObjectID
	CommunityID model.ObjectID
	AuthorID    model.ObjectID
	Anchor      ContentAnchor
	Visibility  model.Visibility
	Status      ContentStatus
	Revision    uint64
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type PostRevision struct {
	PostID      model.ObjectID
	Revision    uint64
	Anchor      ContentAnchor
	CreatedAt   time.Time
	Tombstone   bool
}

type Thread struct {
	ID          model.ObjectID
	CommunityID model.ObjectID
	RootPostID  model.ObjectID
	AuthorID    model.ObjectID
	Status      ContentStatus
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type Comment struct {
	ID          model.ObjectID
	CommunityID model.ObjectID
	ThreadID    model.ObjectID
	ParentID    model.ObjectID
	AuthorID    model.ObjectID
	Anchor      ContentAnchor
	Visibility  model.Visibility
	Status      ContentStatus
	Revision    uint64
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type CommentRevision struct {
	CommentID  model.ObjectID
	Revision   uint64
	Anchor     ContentAnchor
	CreatedAt  time.Time
	Tombstone  bool
}

type Vote struct {
	TargetKind TargetKind
	TargetID   model.ObjectID
	VoterID    model.ObjectID
	Value      int8
	Active     bool
	Revision   uint64
	UpdatedAt  time.Time
}

type ViewerContext struct {
	ActorID             model.ObjectID
	FollowsAuthor       bool
	PurchaserOrBacker   bool
	OrganizationMember  bool
}

type RiskProfile struct {
	Assurance        AssuranceTier
	AccountCreatedAt time.Time
	DeviceKey        string
	NetworkKey       string
}

type CommunityAuthority interface {
	IsActiveMember(communityID, actorID model.ObjectID) bool
	HasRole(communityID, actorID model.ObjectID, role model.RoleID) bool
}

type RiskProvider interface {
	Profile(actorID model.ObjectID) (RiskProfile, bool)
}

type ModerationGate interface {
	CanRead(communityID, viewerID, authorID model.ObjectID, kind string, targetID model.ObjectID) bool
	CanWrite(communityID, actorID model.ObjectID, kind string, targetID model.ObjectID) bool
}

type Policy struct {
	Window                       time.Duration
	DuplicateWindow              time.Duration
	FullLimitMinAccountAge       time.Duration
	UnverifiedWriteLimit         int
	VerifiedWriteLimit           int
	UnverifiedVoteLimit          int
	VerifiedVoteLimit            int
	DeviceWriteLimit             int
	DeviceVoteLimit              int
	NetworkWriteLimit            int
	NetworkVoteLimit             int
	CommunityWriteLimit          int
}

func DefaultPolicy() Policy {
	return Policy{
		Window:                 time.Minute,
		DuplicateWindow:        10 * time.Minute,
		FullLimitMinAccountAge: 24 * time.Hour,
		UnverifiedWriteLimit:   5,
		VerifiedWriteLimit:     20,
		UnverifiedVoteLimit:    15,
		VerifiedVoteLimit:      60,
		DeviceWriteLimit:       40,
		DeviceVoteLimit:        120,
		NetworkWriteLimit:      80,
		NetworkVoteLimit:       240,
		CommunityWriteLimit:    120,
	}
}

type idempotencyRecord struct {
	Fingerprint string
	ResultID    model.ObjectID
}

type rateBucket struct {
	WindowStart time.Time
	Count       int
}

type fingerprintRecord struct {
	At time.Time
}

type Service struct {
	mu sync.RWMutex

	authority  CommunityAuthority
	risk       RiskProvider
	moderation ModerationGate
	policy     Policy
	now       func() time.Time

	posts         map[model.ObjectID]Post
	postRevisions map[model.ObjectID][]PostRevision
	threads       map[model.ObjectID]Thread
	comments      map[model.ObjectID]Comment
	commentRevs   map[model.ObjectID][]CommentRevision
	votes         map[string]Vote

	idempotency   map[string]idempotencyRecord
	actorWrites     map[string]rateBucket
	deviceWrites    map[string]rateBucket
	networkWrites   map[string]rateBucket
	communityWrites map[string]rateBucket
	fingerprints    map[string]fingerprintRecord
}

func NewService(authority CommunityAuthority, risk RiskProvider, moderation ModerationGate, policy Policy) (*Service, error) {
	if authority == nil || risk == nil || moderation == nil {
		return nil, ErrInvalidInput
	}
	if policy.Window <= 0 || policy.DuplicateWindow <= 0 || policy.FullLimitMinAccountAge < 0 ||
		policy.UnverifiedWriteLimit <= 0 || policy.VerifiedWriteLimit <= 0 ||
		policy.UnverifiedVoteLimit <= 0 || policy.VerifiedVoteLimit <= 0 ||
		policy.DeviceWriteLimit <= 0 || policy.DeviceVoteLimit <= 0 ||
		policy.NetworkWriteLimit <= 0 || policy.NetworkVoteLimit <= 0 ||
		policy.CommunityWriteLimit <= 0 {
		return nil, ErrInvalidInput
	}
	return &Service{
		authority:        authority,
		risk:             risk,
		moderation:       moderation,
		policy:           policy,
		now:              func() time.Time { return time.Now().UTC() },
		posts:            make(map[model.ObjectID]Post),
		postRevisions:    make(map[model.ObjectID][]PostRevision),
		threads:          make(map[model.ObjectID]Thread),
		comments:         make(map[model.ObjectID]Comment),
		commentRevs:      make(map[model.ObjectID][]CommentRevision),
		votes:            make(map[string]Vote),
		idempotency:      make(map[string]idempotencyRecord),
		actorWrites:      make(map[string]rateBucket),
		deviceWrites:     make(map[string]rateBucket),
		networkWrites:    make(map[string]rateBucket),
		communityWrites:  make(map[string]rateBucket),
		fingerprints:     make(map[string]fingerprintRecord),
	}, nil
}

func (s *Service) SetClockForTest(now func() time.Time) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.now = now
}

type CreatePostRequest struct {
	ID             model.ObjectID
	CommunityID    model.ObjectID
	Anchor         ContentAnchor
	Visibility     model.Visibility
	IdempotencyKey string
}

func (s *Service) CreatePost(actor model.ObjectID, req CreatePostRequest) (Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.ID.Valid() || !req.CommunityID.Valid() ||
		!validAnchor(req.Anchor) || !validVisibility(req.Visibility) || !validIdempotencyKey(req.IdempotencyKey) {
		return Post{}, ErrInvalidInput
	}
	if !s.authority.IsActiveMember(req.CommunityID, actor) {
		return Post{}, ErrUnauthorized
	}
	if !s.moderation.CanWrite(req.CommunityID, actor, "USER", actor) {
		return Post{}, ErrModerationDenied
	}
	fp := fmt.Sprintf("post|%s|%s|%s|%s", req.ID, req.CommunityID, req.Anchor.SHA256, req.Visibility)
	if id, ok, err := s.idempotent(actor, "create-post", req.IdempotencyKey, fp); ok || err != nil {
		if err != nil {
			return Post{}, err
		}
		return s.posts[id], nil
	}
	if _, exists := s.posts[req.ID]; exists {
		return Post{}, ErrConflict
	}
	now := s.now().UTC()
	if err := s.consume(actor, req.CommunityID, "write", now); err != nil {
		return Post{}, err
	}
	if err := s.rejectDuplicate(actor, req.CommunityID, req.Anchor.SHA256, now); err != nil {
		return Post{}, err
	}
	p := Post{
		ID: req.ID, CommunityID: req.CommunityID, AuthorID: actor, Anchor: req.Anchor,
		Visibility: req.Visibility, Status: StatusActive, Revision: 1, CreatedAt: now, UpdatedAt: now,
	}
	s.posts[p.ID] = p
	s.postRevisions[p.ID] = []PostRevision{{PostID: p.ID, Revision: 1, Anchor: p.Anchor, CreatedAt: now}}
	s.rememberIdempotency(actor, "create-post", req.IdempotencyKey, fp, p.ID)
	return p, nil
}

type RevisePostRequest struct {
	PostID          model.ObjectID
	Anchor          ContentAnchor
	IdempotencyKey  string
}

func (s *Service) RevisePost(actor model.ObjectID, req RevisePostRequest) (Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.PostID.Valid() || !validAnchor(req.Anchor) || !validIdempotencyKey(req.IdempotencyKey) {
		return Post{}, ErrInvalidInput
	}
	p, ok := s.posts[req.PostID]
	if !ok {
		return Post{}, ErrNotFound
	}
	if p.Status != StatusActive {
		return Post{}, ErrTombstoned
	}
	if p.AuthorID != actor {
		return Post{}, ErrUnauthorized
	}
	if !s.moderation.CanWrite(p.CommunityID, actor, string(TargetPost), p.ID) {
		return Post{}, ErrModerationDenied
	}
	fp := fmt.Sprintf("revise-post|%s|%s", req.PostID, req.Anchor.SHA256)
	if id, hit, err := s.idempotent(actor, "revise-post", req.IdempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Post{}, err
		}
		return s.posts[id], nil
	}
	now := s.now().UTC()
	if err := s.consume(actor, p.CommunityID, "write", now); err != nil {
		return Post{}, err
	}
	if err := s.rejectDuplicate(actor, p.CommunityID, req.Anchor.SHA256, now); err != nil {
		return Post{}, err
	}
	p.Anchor = req.Anchor
	p.Revision++
	p.UpdatedAt = now
	s.posts[p.ID] = p
	s.postRevisions[p.ID] = append(s.postRevisions[p.ID], PostRevision{
		PostID: p.ID, Revision: p.Revision, Anchor: p.Anchor, CreatedAt: now,
	})
	s.rememberIdempotency(actor, "revise-post", req.IdempotencyKey, fp, p.ID)
	return p, nil
}

func (s *Service) TombstonePost(actor, postID model.ObjectID, idempotencyKey string) (Post, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !postID.Valid() || !validIdempotencyKey(idempotencyKey) {
		return Post{}, ErrInvalidInput
	}
	p, ok := s.posts[postID]
	if !ok {
		return Post{}, ErrNotFound
	}
	fp := fmt.Sprintf("tombstone-post|%s", postID)
	if id, hit, err := s.idempotent(actor, "tombstone-post", idempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Post{}, err
		}
		return s.posts[id], nil
	}
	if p.AuthorID != actor {
		return Post{}, ErrUnauthorized
	}
	if p.Status == StatusTombstoned {
		return Post{}, ErrTombstoned
	}
	if !s.moderation.CanWrite(p.CommunityID, actor, string(TargetPost), p.ID) {
		return Post{}, ErrModerationDenied
	}
	now := s.now().UTC()
	if err := s.consume(actor, p.CommunityID, "write", now); err != nil {
		return Post{}, err
	}
	p.Status = StatusTombstoned
	p.Anchor.Ref = ""
	p.Revision++
	p.UpdatedAt = now
	s.posts[p.ID] = p
	s.postRevisions[p.ID] = append(s.postRevisions[p.ID], PostRevision{
		PostID: p.ID, Revision: p.Revision, Anchor: ContentAnchor{SHA256: p.Anchor.SHA256},
		CreatedAt: now, Tombstone: true,
	})
	for id, th := range s.threads {
		if th.RootPostID == p.ID && th.Status == StatusActive {
			th.Status = StatusTombstoned
			th.UpdatedAt = now
			s.threads[id] = th
		}
	}
	s.rememberIdempotency(actor, "tombstone-post", idempotencyKey, fp, p.ID)
	return p, nil
}

type CreateThreadRequest struct {
	ID             model.ObjectID
	RootPostID     model.ObjectID
	IdempotencyKey string
}

func (s *Service) CreateThread(actor model.ObjectID, req CreateThreadRequest) (Thread, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.ID.Valid() || !req.RootPostID.Valid() || !validIdempotencyKey(req.IdempotencyKey) {
		return Thread{}, ErrInvalidInput
	}
	root, ok := s.posts[req.RootPostID]
	if !ok {
		return Thread{}, ErrNotFound
	}
	if root.Status != StatusActive {
		return Thread{}, ErrTombstoned
	}
	if root.AuthorID != actor {
		return Thread{}, ErrUnauthorized
	}
	if !s.moderation.CanWrite(root.CommunityID, actor, string(TargetPost), root.ID) {
		return Thread{}, ErrModerationDenied
	}
	fp := fmt.Sprintf("thread|%s|%s", req.ID, req.RootPostID)
	if id, hit, err := s.idempotent(actor, "create-thread", req.IdempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Thread{}, err
		}
		return s.threads[id], nil
	}
	if _, exists := s.threads[req.ID]; exists {
		return Thread{}, ErrConflict
	}
	for _, th := range s.threads {
		if th.RootPostID == req.RootPostID {
			return Thread{}, ErrConflict
		}
	}
	now := s.now().UTC()
	if err := s.consume(actor, root.CommunityID, "write", now); err != nil {
		return Thread{}, err
	}
	th := Thread{
		ID: req.ID, CommunityID: root.CommunityID, RootPostID: root.ID,
		AuthorID: actor, Status: StatusActive, CreatedAt: now, UpdatedAt: now,
	}
	s.threads[th.ID] = th
	s.rememberIdempotency(actor, "create-thread", req.IdempotencyKey, fp, th.ID)
	return th, nil
}

type CreateCommentRequest struct {
	ID             model.ObjectID
	ThreadID       model.ObjectID
	ParentID       model.ObjectID
	Anchor         ContentAnchor
	IdempotencyKey string
	Viewer         ViewerContext
}

func (s *Service) CreateComment(actor model.ObjectID, req CreateCommentRequest) (Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.ID.Valid() || !req.ThreadID.Valid() ||
		!validAnchor(req.Anchor) || !validIdempotencyKey(req.IdempotencyKey) {
		return Comment{}, ErrInvalidInput
	}
	th, ok := s.threads[req.ThreadID]
	if !ok {
		return Comment{}, ErrNotFound
	}
	if th.Status != StatusActive {
		return Comment{}, ErrTombstoned
	}
	if !s.authority.IsActiveMember(th.CommunityID, actor) {
		return Comment{}, ErrUnauthorized
	}
	root := s.posts[th.RootPostID]
	if root.Status != StatusActive {
		return Comment{}, ErrTombstoned
	}
	viewer := req.Viewer
	viewer.ActorID = actor
	if !s.canViewLocked(th.CommunityID, root.AuthorID, root.Visibility, viewer) ||
		!s.moderation.CanRead(th.CommunityID, actor, root.AuthorID, string(TargetPost), root.ID) {
		return Comment{}, ErrVisibilityDenied
	}
	if !s.moderation.CanWrite(th.CommunityID, actor, string(TargetPost), root.ID) {
		return Comment{}, ErrModerationDenied
	}
	if req.ParentID.Valid() {
		parent, exists := s.comments[req.ParentID]
		if !exists {
			return Comment{}, ErrNotFound
		}
		if parent.ThreadID != th.ID || parent.CommunityID != th.CommunityID {
			return Comment{}, ErrConflict
		}
		if parent.Status != StatusActive {
			return Comment{}, ErrTombstoned
		}
		if !s.moderation.CanRead(parent.CommunityID, actor, parent.AuthorID, string(TargetComment), parent.ID) ||
			!s.moderation.CanWrite(parent.CommunityID, actor, string(TargetComment), parent.ID) {
			return Comment{}, ErrModerationDenied
		}
	}
	fp := fmt.Sprintf("comment|%s|%s|%s|%s", req.ID, req.ThreadID, req.ParentID, req.Anchor.SHA256)
	if id, hit, err := s.idempotent(actor, "create-comment", req.IdempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Comment{}, err
		}
		return s.comments[id], nil
	}
	if _, exists := s.comments[req.ID]; exists {
		return Comment{}, ErrConflict
	}
	now := s.now().UTC()
	if err := s.consume(actor, th.CommunityID, "write", now); err != nil {
		return Comment{}, err
	}
	if err := s.rejectDuplicate(actor, th.CommunityID, req.Anchor.SHA256, now); err != nil {
		return Comment{}, err
	}
	c := Comment{
		ID: req.ID, CommunityID: th.CommunityID, ThreadID: th.ID, ParentID: req.ParentID,
		AuthorID: actor, Anchor: req.Anchor, Visibility: root.Visibility, Status: StatusActive,
		Revision: 1, CreatedAt: now, UpdatedAt: now,
	}
	s.comments[c.ID] = c
	s.commentRevs[c.ID] = []CommentRevision{{CommentID: c.ID, Revision: 1, Anchor: c.Anchor, CreatedAt: now}}
	s.rememberIdempotency(actor, "create-comment", req.IdempotencyKey, fp, c.ID)
	return c, nil
}

type ReviseCommentRequest struct {
	CommentID       model.ObjectID
	Anchor          ContentAnchor
	IdempotencyKey  string
}

func (s *Service) ReviseComment(actor model.ObjectID, req ReviseCommentRequest) (Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.CommentID.Valid() || !validAnchor(req.Anchor) || !validIdempotencyKey(req.IdempotencyKey) {
		return Comment{}, ErrInvalidInput
	}
	c, ok := s.comments[req.CommentID]
	if !ok {
		return Comment{}, ErrNotFound
	}
	if c.Status != StatusActive {
		return Comment{}, ErrTombstoned
	}
	if c.AuthorID != actor {
		return Comment{}, ErrUnauthorized
	}
	if !s.moderation.CanWrite(c.CommunityID, actor, string(TargetComment), c.ID) {
		return Comment{}, ErrModerationDenied
	}
	fp := fmt.Sprintf("revise-comment|%s|%s", c.ID, req.Anchor.SHA256)
	if id, hit, err := s.idempotent(actor, "revise-comment", req.IdempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Comment{}, err
		}
		return s.comments[id], nil
	}
	now := s.now().UTC()
	if err := s.consume(actor, c.CommunityID, "write", now); err != nil {
		return Comment{}, err
	}
	if err := s.rejectDuplicate(actor, c.CommunityID, req.Anchor.SHA256, now); err != nil {
		return Comment{}, err
	}
	c.Anchor = req.Anchor
	c.Revision++
	c.UpdatedAt = now
	s.comments[c.ID] = c
	s.commentRevs[c.ID] = append(s.commentRevs[c.ID], CommentRevision{
		CommentID: c.ID, Revision: c.Revision, Anchor: c.Anchor, CreatedAt: now,
	})
	s.rememberIdempotency(actor, "revise-comment", req.IdempotencyKey, fp, c.ID)
	return c, nil
}

func (s *Service) TombstoneComment(actor, commentID model.ObjectID, idempotencyKey string) (Comment, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !commentID.Valid() || !validIdempotencyKey(idempotencyKey) {
		return Comment{}, ErrInvalidInput
	}
	c, ok := s.comments[commentID]
	if !ok {
		return Comment{}, ErrNotFound
	}
	fp := fmt.Sprintf("tombstone-comment|%s", c.ID)
	if id, hit, err := s.idempotent(actor, "tombstone-comment", idempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Comment{}, err
		}
		return s.comments[id], nil
	}
	if c.AuthorID != actor {
		return Comment{}, ErrUnauthorized
	}
	if c.Status == StatusTombstoned {
		return Comment{}, ErrTombstoned
	}
	if !s.moderation.CanWrite(c.CommunityID, actor, string(TargetComment), c.ID) {
		return Comment{}, ErrModerationDenied
	}
	now := s.now().UTC()
	if err := s.consume(actor, c.CommunityID, "write", now); err != nil {
		return Comment{}, err
	}
	c.Status = StatusTombstoned
	c.Anchor.Ref = ""
	c.Revision++
	c.UpdatedAt = now
	s.comments[c.ID] = c
	s.commentRevs[c.ID] = append(s.commentRevs[c.ID], CommentRevision{
		CommentID: c.ID, Revision: c.Revision, Anchor: ContentAnchor{SHA256: c.Anchor.SHA256},
		CreatedAt: now, Tombstone: true,
	})
	s.rememberIdempotency(actor, "tombstone-comment", idempotencyKey, fp, c.ID)
	return c, nil
}

type SetVoteRequest struct {
	TargetKind      TargetKind
	TargetID        model.ObjectID
	Value           int8
	IdempotencyKey  string
	Viewer          ViewerContext
}

func (s *Service) SetVote(actor model.ObjectID, req SetVoteRequest) (Vote, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !req.TargetID.Valid() || (req.Value != -1 && req.Value != 1) ||
		(req.TargetKind != TargetPost && req.TargetKind != TargetComment) || !validIdempotencyKey(req.IdempotencyKey) {
		return Vote{}, ErrInvalidInput
	}
	communityID, authorID, visibility, status, err := s.targetMetadata(req.TargetKind, req.TargetID)
	if err != nil {
		return Vote{}, err
	}
	if status != StatusActive {
		return Vote{}, ErrTombstoned
	}
	if !s.authority.IsActiveMember(communityID, actor) {
		return Vote{}, ErrUnauthorized
	}
	viewer := req.Viewer
	viewer.ActorID = actor
	if !s.canViewLocked(communityID, authorID, visibility, viewer) ||
		!s.moderation.CanRead(communityID, actor, authorID, string(req.TargetKind), req.TargetID) {
		return Vote{}, ErrVisibilityDenied
	}
	if !s.moderation.CanWrite(communityID, actor, string(req.TargetKind), req.TargetID) {
		return Vote{}, ErrModerationDenied
	}
	fp := fmt.Sprintf("vote|%s|%s|%d", req.TargetKind, req.TargetID, req.Value)
	if _, hit, err := s.idempotent(actor, "set-vote", req.IdempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Vote{}, err
		}
		return s.votes[voteKey(req.TargetKind, req.TargetID, actor)], nil
	}
	now := s.now().UTC()
	if err := s.consume(actor, communityID, "vote", now); err != nil {
		return Vote{}, err
	}
	key := voteKey(req.TargetKind, req.TargetID, actor)
	v := s.votes[key]
	if v.Active && v.Value == req.Value {
		s.rememberIdempotency(actor, "set-vote", req.IdempotencyKey, fp, req.TargetID)
		return v, nil
	}
	v.TargetKind = req.TargetKind
	v.TargetID = req.TargetID
	v.VoterID = actor
	v.Value = req.Value
	v.Active = true
	v.Revision++
	v.UpdatedAt = now
	s.votes[key] = v
	s.rememberIdempotency(actor, "set-vote", req.IdempotencyKey, fp, req.TargetID)
	return v, nil
}

func (s *Service) ClearVote(actor model.ObjectID, kind TargetKind, targetID model.ObjectID, idempotencyKey string) (Vote, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !validActor(actor) || !targetID.Valid() || !validIdempotencyKey(idempotencyKey) ||
		(kind != TargetPost && kind != TargetComment) {
		return Vote{}, ErrInvalidInput
	}
	communityID, _, _, _, err := s.targetMetadata(kind, targetID)
	if err != nil {
		return Vote{}, err
	}
	fp := fmt.Sprintf("clear-vote|%s|%s", kind, targetID)
	if _, hit, err := s.idempotent(actor, "clear-vote", idempotencyKey, fp); hit || err != nil {
		if err != nil {
			return Vote{}, err
		}
		return s.votes[voteKey(kind, targetID, actor)], nil
	}
	if !s.moderation.CanWrite(communityID, actor, string(kind), targetID) {
		return Vote{}, ErrModerationDenied
	}
	key := voteKey(kind, targetID, actor)
	v, ok := s.votes[key]
	if !ok || !v.Active {
		return Vote{}, ErrNotFound
	}
	now := s.now().UTC()
	if err := s.consume(actor, communityID, "vote", now); err != nil {
		return Vote{}, err
	}
	v.Active = false
	v.Revision++
	v.UpdatedAt = now
	s.votes[key] = v
	s.rememberIdempotency(actor, "clear-vote", idempotencyKey, fp, targetID)
	return v, nil
}

func (s *Service) GetPost(viewer ViewerContext, id model.ObjectID) (Post, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.posts[id]
	if !ok {
		return Post{}, ErrNotFound
	}
	if !s.canViewLocked(p.CommunityID, p.AuthorID, p.Visibility, viewer) ||
		!s.moderation.CanRead(p.CommunityID, viewer.ActorID, p.AuthorID, string(TargetPost), p.ID) {
		return Post{}, ErrVisibilityDenied
	}
	return p, nil
}

func (s *Service) GetThread(viewer ViewerContext, id model.ObjectID) (Thread, Post, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	th, ok := s.threads[id]
	if !ok {
		return Thread{}, Post{}, ErrNotFound
	}
	root := s.posts[th.RootPostID]
	if !s.canViewLocked(th.CommunityID, root.AuthorID, root.Visibility, viewer) ||
		!s.moderation.CanRead(th.CommunityID, viewer.ActorID, root.AuthorID, string(TargetPost), root.ID) {
		return Thread{}, Post{}, ErrVisibilityDenied
	}
	return th, root, nil
}

func (s *Service) GetComment(viewer ViewerContext, id model.ObjectID) (Comment, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.comments[id]
	if !ok {
		return Comment{}, ErrNotFound
	}
	if !s.canViewLocked(c.CommunityID, c.AuthorID, c.Visibility, viewer) ||
		!s.moderation.CanRead(c.CommunityID, viewer.ActorID, c.AuthorID, string(TargetComment), c.ID) {
		return Comment{}, ErrVisibilityDenied
	}
	return c, nil
}

func (s *Service) PostRevisions(viewer ViewerContext, postID model.ObjectID) ([]PostRevision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	p, ok := s.posts[postID]
	if !ok {
		return nil, ErrNotFound
	}
	if !s.canViewLocked(p.CommunityID, p.AuthorID, p.Visibility, viewer) ||
		!s.moderation.CanRead(p.CommunityID, viewer.ActorID, p.AuthorID, string(TargetPost), p.ID) {
		return nil, ErrVisibilityDenied
	}
	out := append([]PostRevision(nil), s.postRevisions[postID]...)
	return out, nil
}

func (s *Service) CommentRevisions(viewer ViewerContext, commentID model.ObjectID) ([]CommentRevision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	c, ok := s.comments[commentID]
	if !ok {
		return nil, ErrNotFound
	}
	if !s.canViewLocked(c.CommunityID, c.AuthorID, c.Visibility, viewer) ||
		!s.moderation.CanRead(c.CommunityID, viewer.ActorID, c.AuthorID, string(TargetComment), c.ID) {
		return nil, ErrVisibilityDenied
	}
	out := append([]CommentRevision(nil), s.commentRevs[commentID]...)
	return out, nil
}

func (s *Service) CanView(communityID, authorID model.ObjectID, visibility model.Visibility, viewer ViewerContext) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.canViewLocked(communityID, authorID, visibility, viewer)
}

func (s *Service) canViewLocked(communityID, authorID model.ObjectID, visibility model.Visibility, viewer ViewerContext) bool {
	if viewer.ActorID.Valid() && viewer.ActorID == authorID {
		return true
	}
	switch visibility {
	case model.VisibilityPublic, model.VisibilityUnlisted:
		return true
	case model.VisibilityCommunityOnly:
		return viewer.ActorID.Valid() && s.authority.IsActiveMember(communityID, viewer.ActorID)
	case model.VisibilityPrivate:
		return false
	case model.VisibilityModerators:
		return viewer.ActorID.Valid() &&
			(s.authority.HasRole(communityID, viewer.ActorID, model.RoleModerator) ||
				s.authority.HasRole(communityID, viewer.ActorID, model.RoleAdmin))
	case model.VisibilityAdmins:
		return viewer.ActorID.Valid() && s.authority.HasRole(communityID, viewer.ActorID, model.RoleAdmin)
	case model.VisibilityFollowers:
		return viewer.FollowsAuthor
	case model.VisibilityPurchasersBackers:
		return viewer.PurchaserOrBacker
	case model.VisibilityOrganizationMember:
		return viewer.OrganizationMember
	default:
		return false
	}
}

func (s *Service) targetMetadata(kind TargetKind, id model.ObjectID) (model.ObjectID, model.ObjectID, model.Visibility, ContentStatus, error) {
	switch kind {
	case TargetPost:
		p, ok := s.posts[id]
		if !ok {
			return "", "", "", "", ErrNotFound
		}
		return p.CommunityID, p.AuthorID, p.Visibility, p.Status, nil
	case TargetComment:
		c, ok := s.comments[id]
		if !ok {
			return "", "", "", "", ErrNotFound
		}
		return c.CommunityID, c.AuthorID, c.Visibility, c.Status, nil
	default:
		return "", "", "", "", ErrInvalidInput
	}
}

func (s *Service) TargetCommunity(kind string, id model.ObjectID) (model.ObjectID, model.ObjectID, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	switch TargetKind(kind) {
	case TargetPost:
		p, ok := s.posts[id]
		if !ok {
			return "", "", false
		}
		return p.CommunityID, p.AuthorID, true
	case TargetComment:
		c, ok := s.comments[id]
		if !ok {
			return "", "", false
		}
		return c.CommunityID, c.AuthorID, true
	default:
		return "", "", false
	}
}

func (s *Service) idempotent(actor model.ObjectID, operation, key, fingerprint string) (model.ObjectID, bool, error) {
	record, ok := s.idempotency[idempotencyMapKey(actor, operation, key)]
	if !ok {
		return "", false, nil
	}
	if record.Fingerprint != fingerprint {
		return "", false, ErrIdempotencyConflict
	}
	return record.ResultID, true, nil
}

func (s *Service) rememberIdempotency(actor model.ObjectID, operation, key, fingerprint string, resultID model.ObjectID) {
	s.idempotency[idempotencyMapKey(actor, operation, key)] = idempotencyRecord{
		Fingerprint: fingerprint,
		ResultID: resultID,
	}
}

func (s *Service) consume(actor, communityID model.ObjectID, class string, now time.Time) error {
	profile, ok := s.risk.Profile(actor)
	if !ok {
		profile = RiskProfile{Assurance: AssuranceUnverified, AccountCreatedAt: now}
	}
	full := profile.Assurance == AssuranceVerified &&
		!profile.AccountCreatedAt.IsZero() &&
		now.Sub(profile.AccountCreatedAt) >= s.policy.FullLimitMinAccountAge

	actorLimit := s.policy.UnverifiedWriteLimit
	deviceLimit := s.policy.DeviceWriteLimit
	networkLimit := s.policy.NetworkWriteLimit
	if class == "vote" {
		actorLimit = s.policy.UnverifiedVoteLimit
		deviceLimit = s.policy.DeviceVoteLimit
		networkLimit = s.policy.NetworkVoteLimit
		if full {
			actorLimit = s.policy.VerifiedVoteLimit
		}
	} else if full {
		actorLimit = s.policy.VerifiedWriteLimit
	}

	type scopedBucket struct {
		store *map[string]rateBucket
		key   string
		limit int
	}
	scopes := []scopedBucket{
		{store: &s.actorWrites, key: fmt.Sprintf("%s|%s", actor, class), limit: actorLimit},
		{store: &s.communityWrites, key: fmt.Sprintf("%s|%s", communityID, class), limit: s.policy.CommunityWriteLimit},
	}
	if profile.DeviceKey != "" {
		scopes = append(scopes, scopedBucket{
			store: &s.deviceWrites,
			key: fmt.Sprintf("%s|%s", profile.DeviceKey, class),
			limit: deviceLimit,
		})
	}
	if profile.NetworkKey != "" {
		scopes = append(scopes, scopedBucket{
			store: &s.networkWrites,
			key: fmt.Sprintf("%s|%s", profile.NetworkKey, class),
			limit: networkLimit,
		})
	}

	next := make([]rateBucket, len(scopes))
	for i, scope := range scopes {
		bucket := (*scope.store)[scope.key]
		if bucket.WindowStart.IsZero() || now.Sub(bucket.WindowStart) >= s.policy.Window {
			bucket = rateBucket{WindowStart: now}
		}
		if bucket.Count >= scope.limit {
			return ErrRateLimited
		}
		bucket.Count++
		next[i] = bucket
	}
	for i, scope := range scopes {
		(*scope.store)[scope.key] = next[i]
	}
	return nil
}

func (s *Service) rejectDuplicate(actor, communityID model.ObjectID, hash string, now time.Time) error {
	key := fmt.Sprintf("%s|%s|%s", actor, communityID, strings.ToLower(hash))
	if existing, ok := s.fingerprints[key]; ok && now.Sub(existing.At) < s.policy.DuplicateWindow {
		return ErrDuplicateContent
	}
	s.fingerprints[key] = fingerprintRecord{At: now}
	return nil
}

func validActor(id model.ObjectID) bool {
	return id.Valid()
}

var sha256Pattern = regexp.MustCompile("^[a-f0-9]{64}$")

func validAnchor(anchor ContentAnchor) bool {
	ref := strings.TrimSpace(anchor.Ref)
	hash := strings.ToLower(strings.TrimSpace(anchor.SHA256))
	return ref != "" && len(ref) <= 2048 && sha256Pattern.MatchString(hash)
}

func validIdempotencyKey(key string) bool {
	return key != "" && len(key) <= 128 && strings.TrimSpace(key) == key
}

func validVisibility(v model.Visibility) bool {
	switch v {
	case model.VisibilityPublic,
		model.VisibilityUnlisted,
		model.VisibilityFollowers,
		model.VisibilityCommunityOnly,
		model.VisibilityPurchasersBackers,
		model.VisibilityPrivate,
		model.VisibilityOrganizationMember,
		model.VisibilityModerators,
		model.VisibilityAdmins:
		return true
	default:
		return false
	}
}

func idempotencyMapKey(actor model.ObjectID, operation, key string) string {
	return fmt.Sprintf("%s|%s|%s", actor, operation, key)
}

func voteKey(kind TargetKind, targetID, voterID model.ObjectID) string {
	return fmt.Sprintf("%s|%s|%s", kind, targetID, voterID)
}
