package content

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/model"
)

type fakeAuthority struct {
	members map[string]bool
	roles   map[string]bool
}

func newFakeAuthority() *fakeAuthority {
	return &fakeAuthority{members: map[string]bool{}, roles: map[string]bool{}}
}

func authKey(community, actor model.ObjectID) string {
	return string(community) + "|" + string(actor)
}

func roleKey(community, actor model.ObjectID, role model.RoleID) string {
	return authKey(community, actor) + "|" + string(role)
}

func (f *fakeAuthority) IsActiveMember(communityID, actorID model.ObjectID) bool {
	return f.members[authKey(communityID, actorID)]
}

func (f *fakeAuthority) HasRole(communityID, actorID model.ObjectID, role model.RoleID) bool {
	return f.roles[roleKey(communityID, actorID, role)]
}

func (f *fakeAuthority) addMember(community, actor model.ObjectID) {
	f.members[authKey(community, actor)] = true
}

func (f *fakeAuthority) setRole(community, actor model.ObjectID, role model.RoleID) {
	f.roles[roleKey(community, actor, role)] = true
}

type fakeRisk struct {
	profiles map[model.ObjectID]RiskProfile
}

func (f *fakeRisk) Profile(actorID model.ObjectID) (RiskProfile, bool) {
	p, ok := f.profiles[actorID]
	return p, ok
}

const (
	community model.ObjectID = "community-1"
	otherCommunity model.ObjectID = "community-2"
	alice model.ObjectID = "alice"
	bob model.ObjectID = "bob"
	mod model.ObjectID = "moderator"
	admin model.ObjectID = "admin"
	outsider model.ObjectID = "outsider"
)

func digest(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func anchor(value string) ContentAnchor {
	return ContentAnchor{Ref: "ipfs://" + value, SHA256: digest(value)}
}

func newTestService(t *testing.T) (*Service, *fakeAuthority, *fakeRisk, *time.Time) {
	t.Helper()
	auth := newFakeAuthority()
	for _, actor := range []model.ObjectID{alice, bob, mod, admin} {
		auth.addMember(community, actor)
	}
	auth.addMember(otherCommunity, alice)
	auth.addMember(otherCommunity, bob)
	auth.setRole(community, mod, model.RoleModerator)
	auth.setRole(community, admin, model.RoleAdmin)

	now := time.Date(2026, 10, 5, 5, 0, 0, 0, time.UTC)
	risk := &fakeRisk{profiles: map[model.ObjectID]RiskProfile{
		alice: {Assurance: AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
		bob:   {Assurance: AssuranceUnverified, AccountCreatedAt: now.Add(-time.Hour)},
		mod:   {Assurance: AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
		admin: {Assurance: AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
	}}
	policy := DefaultPolicy()
	svc, err := NewService(auth, risk, policy)
	if err != nil {
		t.Fatal(err)
	}
	svc.SetClockForTest(func() time.Time { return now })
	return svc, auth, risk, &now
}

func createPost(t *testing.T, svc *Service, actor, id model.ObjectID, visibility model.Visibility, key, body string) Post {
	t.Helper()
	p, err := svc.CreatePost(actor, CreatePostRequest{
		ID: id, CommunityID: community, Anchor: anchor(body), Visibility: visibility, IdempotencyKey: key,
	})
	if err != nil {
		t.Fatalf("create post: %v", err)
	}
	return p
}

func createThread(t *testing.T, svc *Service, actor, threadID, postID model.ObjectID, key string) Thread {
	t.Helper()
	th, err := svc.CreateThread(actor, CreateThreadRequest{ID: threadID, RootPostID: postID, IdempotencyKey: key})
	if err != nil {
		t.Fatalf("create thread: %v", err)
	}
	return th
}

func TestMemberCanCreatePostThreadCommentAndReply(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	post := createPost(t, svc, alice, "post-1", model.VisibilityCommunityOnly, "p1", "root")
	thread := createThread(t, svc, alice, "thread-1", post.ID, "t1")

	comment, err := svc.CreateComment(bob, CreateCommentRequest{
		ID: "comment-1", ThreadID: thread.ID, Anchor: anchor("comment"), IdempotencyKey: "c1",
	})
	if err != nil {
		t.Fatal(err)
	}
	if comment.Visibility != post.Visibility {
		t.Fatal("comment must inherit root visibility")
	}

	reply, err := svc.CreateComment(alice, CreateCommentRequest{
		ID: "comment-2", ThreadID: thread.ID, ParentID: comment.ID, Anchor: anchor("reply"), IdempotencyKey: "c2",
	})
	if err != nil {
		t.Fatal(err)
	}
	if reply.ParentID != comment.ID || reply.ThreadID != thread.ID {
		t.Fatal("reply linkage drift")
	}
}

func TestWritesRequireActiveMembershipAndThreadOwnership(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	_, err := svc.CreatePost(outsider, CreatePostRequest{
		ID: "post-out", CommunityID: community, Anchor: anchor("outside"), Visibility: model.VisibilityPublic, IdempotencyKey: "out",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected unauthorized outsider, got %v", err)
	}

	root := createPost(t, svc, alice, "post-own", model.VisibilityPublic, "own", "owned")
	_, err = svc.CreateThread(bob, CreateThreadRequest{ID: "thread-steal", RootPostID: root.ID, IdempotencyKey: "steal"})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected root author ownership check, got %v", err)
	}
}

func TestReplyCannotCrossThreadOrUseTombstonedParent(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	p1 := createPost(t, svc, alice, "p-a", model.VisibilityPublic, "p-a-key", "a")
	t1 := createThread(t, svc, alice, "t-a", p1.ID, "t-a-key")
	p2 := createPost(t, svc, alice, "p-b", model.VisibilityPublic, "p-b-key", "b")
	t2 := createThread(t, svc, alice, "t-b", p2.ID, "t-b-key")
	c1, err := svc.CreateComment(bob, CreateCommentRequest{
		ID: "c-a", ThreadID: t1.ID, Anchor: anchor("ca"), IdempotencyKey: "ca-key",
	})
	if err != nil {
		t.Fatal(err)
	}

	_, err = svc.CreateComment(alice, CreateCommentRequest{
		ID: "c-cross", ThreadID: t2.ID, ParentID: c1.ID, Anchor: anchor("cross"), IdempotencyKey: "cross-key",
	})
	if !errors.Is(err, ErrConflict) {
		t.Fatalf("expected cross-thread conflict, got %v", err)
	}

	if _, err = svc.TombstoneComment(bob, c1.ID, "c-tomb"); err != nil {
		t.Fatal(err)
	}
	_, err = svc.CreateComment(alice, CreateCommentRequest{
		ID: "c-after", ThreadID: t1.ID, ParentID: c1.ID, Anchor: anchor("after"), IdempotencyKey: "after-key",
	})
	if !errors.Is(err, ErrTombstoned) {
		t.Fatalf("expected tombstoned parent rejection, got %v", err)
	}
}

func TestVisibilityScopesFailClosedAndRespectTownRoles(t *testing.T) {
	svc, _, _, _ := newTestService(t)

	cases := []struct {
		visibility model.Visibility
		viewer     ViewerContext
		want       bool
	}{
		{model.VisibilityPublic, ViewerContext{}, true},
		{model.VisibilityUnlisted, ViewerContext{}, true},
		{model.VisibilityCommunityOnly, ViewerContext{ActorID: bob}, true},
		{model.VisibilityCommunityOnly, ViewerContext{ActorID: outsider}, false},
		{model.VisibilityPrivate, ViewerContext{ActorID: bob}, false},
		{model.VisibilityModerators, ViewerContext{ActorID: mod}, true},
		{model.VisibilityModerators, ViewerContext{ActorID: bob}, false},
		{model.VisibilityAdmins, ViewerContext{ActorID: admin}, true},
		{model.VisibilityAdmins, ViewerContext{ActorID: mod}, false},
		{model.VisibilityFollowers, ViewerContext{ActorID: bob, FollowsAuthor: true}, true},
		{model.VisibilityFollowers, ViewerContext{ActorID: bob}, false},
		{model.VisibilityPurchasersBackers, ViewerContext{ActorID: bob, PurchaserOrBacker: true}, true},
		{model.VisibilityPurchasersBackers, ViewerContext{ActorID: bob}, false},
		{model.VisibilityOrganizationMember, ViewerContext{ActorID: bob, OrganizationMember: true}, true},
		{model.VisibilityOrganizationMember, ViewerContext{ActorID: bob}, false},
		{model.Visibility("UNKNOWN"), ViewerContext{ActorID: admin}, false},
	}

	for _, tc := range cases {
		got := svc.CanView(community, alice, tc.visibility, tc.viewer)
		if got != tc.want {
			t.Fatalf("visibility %s got %v want %v", tc.visibility, got, tc.want)
		}
	}

	if !svc.CanView(community, alice, model.VisibilityPrivate, ViewerContext{ActorID: alice}) {
		t.Fatal("author must retain access to own private content")
	}
}

func TestCommentsCannotWidenRootVisibility(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	root := createPost(t, svc, alice, "post-private-thread", model.VisibilityAdmins, "root-admin", "admin-only")
	th := createThread(t, svc, alice, "thread-private", root.ID, "thread-admin")
	c, err := svc.CreateComment(bob, CreateCommentRequest{
		ID: "comment-admin", ThreadID: th.ID, Anchor: anchor("reply-admin"), IdempotencyKey: "comment-admin-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	if c.Visibility != model.VisibilityAdmins {
		t.Fatal("comment widened thread visibility")
	}
	if _, err := svc.GetComment(ViewerContext{ActorID: bob}, c.ID); !errors.Is(err, ErrVisibilityDenied) {
		t.Fatalf("expected commenter without admin role to be visibility denied on inherited admin scope, got %v", err)
	}
}

func TestPostRevisionHistoryIsAppendOnlyAndTombstonePreservesDigest(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	p := createPost(t, svc, alice, "post-rev", model.VisibilityPublic, "rev-create", "v1")
	v1hash := p.Anchor.SHA256

	p, err := svc.RevisePost(alice, RevisePostRequest{PostID: p.ID, Anchor: anchor("v2"), IdempotencyKey: "rev-2"})
	if err != nil {
		t.Fatal(err)
	}
	if p.Revision != 2 {
		t.Fatalf("revision=%d", p.Revision)
	}

	p, err = svc.TombstonePost(alice, p.ID, "rev-delete")
	if err != nil {
		t.Fatal(err)
	}
	if p.Status != StatusTombstoned || p.Anchor.Ref != "" || p.Anchor.SHA256 == "" {
		t.Fatal("tombstone must clear body reference but preserve digest")
	}

	revs, err := svc.PostRevisions(ViewerContext{ActorID: alice}, p.ID)
	if err != nil {
		t.Fatal(err)
	}
	if len(revs) != 3 || revs[0].Anchor.SHA256 != v1hash || !revs[2].Tombstone {
		t.Fatalf("unexpected revision history: %+v", revs)
	}
}

func TestTombstoningRootPostTombstonesThreadButKeepsIdentity(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	p := createPost(t, svc, alice, "root-delete", model.VisibilityPublic, "root-create", "root-body")
	th := createThread(t, svc, alice, "thread-delete", p.ID, "thread-create")

	if _, err := svc.TombstonePost(alice, p.ID, "root-tomb"); err != nil {
		t.Fatal(err)
	}
	gotThread, gotRoot, err := svc.GetThread(ViewerContext{}, th.ID)
	if err != nil {
		t.Fatal(err)
	}
	if gotThread.Status != StatusTombstoned || gotRoot.Status != StatusTombstoned {
		t.Fatal("thread/root tombstone mismatch")
	}
	_, err = svc.CreateComment(bob, CreateCommentRequest{
		ID: "comment-after-root-delete", ThreadID: th.ID, Anchor: anchor("late"), IdempotencyKey: "late-key",
	})
	if !errors.Is(err, ErrTombstoned) {
		t.Fatalf("expected tombstoned thread rejection, got %v", err)
	}
}

func TestIdempotentCreateReturnsSameObjectWithoutDuplicateWrite(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	req := CreatePostRequest{
		ID: "idem-post", CommunityID: community, Anchor: anchor("idem"), Visibility: model.VisibilityPublic, IdempotencyKey: "idem-key",
	}
	first, err := svc.CreatePost(alice, req)
	if err != nil {
		t.Fatal(err)
	}
	second, err := svc.CreatePost(alice, req)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || first.Revision != second.Revision || !first.CreatedAt.Equal(second.CreatedAt) {
		t.Fatal("idempotent retry mutated result")
	}
}

func TestIdempotencyKeyCannotBeReusedForDifferentPayload(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	_, err := svc.CreatePost(alice, CreatePostRequest{
		ID: "idem-a", CommunityID: community, Anchor: anchor("one"), Visibility: model.VisibilityPublic, IdempotencyKey: "same-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.CreatePost(alice, CreatePostRequest{
		ID: "idem-b", CommunityID: community, Anchor: anchor("two"), Visibility: model.VisibilityPublic, IdempotencyKey: "same-key",
	})
	if !errors.Is(err, ErrIdempotencyConflict) {
		t.Fatalf("expected idempotency conflict, got %v", err)
	}
}

func TestDuplicateFingerprintBlocksSpamWithinWindow(t *testing.T) {
	svc, _, _, now := newTestService(t)
	body := anchor("duplicate")
	_, err := svc.CreatePost(alice, CreatePostRequest{
		ID: "dup-a", CommunityID: community, Anchor: body, Visibility: model.VisibilityPublic, IdempotencyKey: "dup-a-key",
	})
	if err != nil {
		t.Fatal(err)
	}
	_, err = svc.CreatePost(alice, CreatePostRequest{
		ID: "dup-b", CommunityID: community, Anchor: body, Visibility: model.VisibilityPublic, IdempotencyKey: "dup-b-key",
	})
	if !errors.Is(err, ErrDuplicateContent) {
		t.Fatalf("expected duplicate rejection, got %v", err)
	}

	*now = now.Add(11 * time.Minute)
	_, err = svc.CreatePost(alice, CreatePostRequest{
		ID: "dup-c", CommunityID: community, Anchor: body, Visibility: model.VisibilityPublic, IdempotencyKey: "dup-c-key",
	})
	if err != nil {
		t.Fatalf("expected duplicate window expiry, got %v", err)
	}
}

func TestUnverifiedYoungIdentityReceivesLowerWriteLimit(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	policyLimit := DefaultPolicy().UnverifiedWriteLimit

	for i := 0; i < policyLimit; i++ {
		_, err := svc.CreatePost(bob, CreatePostRequest{
			ID: model.ObjectID("bob-post-" + string(rune('a'+i))),
			CommunityID: community,
			Anchor: anchor("bob-body-" + string(rune('a'+i))),
			Visibility: model.VisibilityPublic,
			IdempotencyKey: "bob-key-" + string(rune('a'+i)),
		})
		if err != nil {
			t.Fatalf("unexpected pre-limit error at %d: %v", i, err)
		}
	}
	_, err := svc.CreatePost(bob, CreatePostRequest{
		ID: "bob-over", CommunityID: community, Anchor: anchor("bob-over"), Visibility: model.VisibilityPublic, IdempotencyKey: "bob-over-key",
	})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected rate limit, got %v", err)
	}
}

func TestVerifiedEstablishedIdentityReceivesHigherWriteLimit(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	unverified := DefaultPolicy().UnverifiedWriteLimit
	for i := 0; i < unverified+1; i++ {
		_, err := svc.CreatePost(alice, CreatePostRequest{
			ID: model.ObjectID("alice-post-" + string(rune('a'+i))),
			CommunityID: community,
			Anchor: anchor("alice-body-" + string(rune('a'+i))),
			Visibility: model.VisibilityPublic,
			IdempotencyKey: "alice-key-" + string(rune('a'+i)),
		})
		if err != nil {
			t.Fatalf("verified identity hit unverified limit at %d: %v", i, err)
		}
	}
}

func TestUnknownRiskProfileFailsToUnverifiedLimits(t *testing.T) {
	svc, auth, _, _ := newTestService(t)
	auth.addMember(community, outsider)
	limit := DefaultPolicy().UnverifiedWriteLimit
	for i := 0; i < limit; i++ {
		_, err := svc.CreatePost(outsider, CreatePostRequest{
			ID: model.ObjectID("out-post-" + string(rune('a'+i))),
			CommunityID: community,
			Anchor: anchor("out-body-" + string(rune('a'+i))),
			Visibility: model.VisibilityPublic,
			IdempotencyKey: "out-key-" + string(rune('a'+i)),
		})
		if err != nil {
			t.Fatalf("unexpected pre-limit error: %v", err)
		}
	}
	_, err := svc.CreatePost(outsider, CreatePostRequest{
		ID: "out-over", CommunityID: community, Anchor: anchor("out-over"), Visibility: model.VisibilityPublic, IdempotencyKey: "out-over-key",
	})
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("missing risk profile must fail to low limit, got %v", err)
	}
}

func TestVoteIsOneCanonicalRecordPerIdentityTargetAndRevisioned(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	p := createPost(t, svc, alice, "vote-post", model.VisibilityCommunityOnly, "vote-post-key", "vote-body")

	v, err := svc.SetVote(bob, SetVoteRequest{
		TargetKind: TargetPost, TargetID: p.ID, Value: 1, IdempotencyKey: "vote-1", Viewer: ViewerContext{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if v.Revision != 1 || !v.Active || v.Value != 1 {
		t.Fatalf("unexpected initial vote: %+v", v)
	}

	v, err = svc.SetVote(bob, SetVoteRequest{
		TargetKind: TargetPost, TargetID: p.ID, Value: -1, IdempotencyKey: "vote-2", Viewer: ViewerContext{},
	})
	if err != nil {
		t.Fatal(err)
	}
	if v.Revision != 2 || v.Value != -1 {
		t.Fatalf("vote update not revisioned: %+v", v)
	}

	v, err = svc.ClearVote(bob, TargetPost, p.ID, "vote-clear")
	if err != nil {
		t.Fatal(err)
	}
	if v.Active || v.Revision != 3 {
		t.Fatalf("vote clear not revisioned: %+v", v)
	}
}

func TestVoteRequiresMembershipAndTargetVisibility(t *testing.T) {
	svc, auth, _, _ := newTestService(t)
	p := createPost(t, svc, alice, "private-vote-post", model.VisibilityPrivate, "private-vote-key", "private-vote")

	_, err := svc.SetVote(bob, SetVoteRequest{
		TargetKind: TargetPost, TargetID: p.ID, Value: 1, IdempotencyKey: "private-vote-attempt",
	})
	if !errors.Is(err, ErrVisibilityDenied) {
		t.Fatalf("expected visibility denial, got %v", err)
	}

	auth.addMember(community, outsider)
	pub := createPost(t, svc, alice, "public-vote-post", model.VisibilityPublic, "public-vote-key", "public-vote")
	delete(auth.members, authKey(community, outsider))
	_, err = svc.SetVote(outsider, SetVoteRequest{
		TargetKind: TargetPost, TargetID: pub.ID, Value: 1, IdempotencyKey: "outsider-vote",
	})
	if !errors.Is(err, ErrUnauthorized) {
		t.Fatalf("expected nonmember vote denial, got %v", err)
	}
}

func TestInvalidContentAnchorAndUnknownVisibilityFailClosed(t *testing.T) {
	svc, _, _, _ := newTestService(t)
	_, err := svc.CreatePost(alice, CreatePostRequest{
		ID: "bad-hash", CommunityID: community,
		Anchor: ContentAnchor{Ref: "ipfs://x", SHA256: "not-a-sha256"},
		Visibility: model.VisibilityPublic, IdempotencyKey: "bad-hash-key",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid digest rejection, got %v", err)
	}

	_, err = svc.CreatePost(alice, CreatePostRequest{
		ID: "bad-vis", CommunityID: community, Anchor: anchor("bad-vis"),
		Visibility: model.Visibility("GLOBAL"), IdempotencyKey: "bad-vis-key",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected unknown visibility rejection, got %v", err)
	}
}
