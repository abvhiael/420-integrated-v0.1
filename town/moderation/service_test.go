package moderation_test

import (
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
	"github.com/420integrated/420-integrated/town/moderation"
)

type fakeAuthority struct {
	members map[string]bool
	roles   map[string]bool
}

func newFakeAuthority() *fakeAuthority {
	return &fakeAuthority{members: map[string]bool{}, roles: map[string]bool{}}
}

func memberKey(c, a model.ObjectID) string { return string(c) + "|" + string(a) }
func roleKey(c, a model.ObjectID, r model.RoleID) string {
	return memberKey(c, a) + "|" + string(r)
}

func (f *fakeAuthority) IsActiveMember(c, a model.ObjectID) bool {
	return f.members[memberKey(c, a)]
}
func (f *fakeAuthority) HasRole(c, a model.ObjectID, r model.RoleID) bool {
	return f.roles[roleKey(c, a, r)]
}
func (f *fakeAuthority) addMember(c, a model.ObjectID) { f.members[memberKey(c, a)] = true }
func (f *fakeAuthority) addRole(c, a model.ObjectID, r model.RoleID) {
	f.roles[roleKey(c, a, r)] = true
}

type fakeRisk struct {
	profiles map[model.ObjectID]content.RiskProfile
}

func (f *fakeRisk) Profile(a model.ObjectID) (content.RiskProfile, bool) {
	p, ok := f.profiles[a]
	return p, ok
}

const (
	communityA model.ObjectID = "community-a"
	communityB model.ObjectID = "community-b"
	alice      model.ObjectID = "alice"
	bob        model.ObjectID = "bob"
	modA       model.ObjectID = "mod-a"
	adminB     model.ObjectID = "admin-b"
)

func hash(v string) string {
	sum := sha256.Sum256([]byte(v))
	return hex.EncodeToString(sum[:])
}

func anchor(v string) content.ContentAnchor {
	return content.ContentAnchor{Ref: "ipfs://" + v, SHA256: hash(v)}
}

type fixture struct {
	auth *fakeAuthority
	mod  *moderation.Service
	app  *content.Service
	now  time.Time
}

func newFixture(t *testing.T) *fixture {
	t.Helper()
	auth := newFakeAuthority()
	for _, c := range []model.ObjectID{communityA, communityB} {
		for _, a := range []model.ObjectID{alice, bob, modA, adminB} {
			auth.addMember(c, a)
		}
	}
	auth.addRole(communityA, modA, model.RoleModerator)
	auth.addRole(communityB, adminB, model.RoleAdmin)

	now := time.Date(2026, 10, 5, 10, 0, 0, 0, time.UTC)
	risk := &fakeRisk{profiles: map[model.ObjectID]content.RiskProfile{
		alice:  {Assurance: content.AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
		bob:    {Assurance: content.AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
		modA:   {Assurance: content.AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
		adminB: {Assurance: content.AssuranceVerified, AccountCreatedAt: now.Add(-7 * 24 * time.Hour)},
	}}
	modSvc, err := moderation.NewService(auth)
	if err != nil {
		t.Fatal(err)
	}
	app, err := content.NewService(auth, risk, modSvc, content.DefaultPolicy())
	if err != nil {
		t.Fatal(err)
	}
	if err := modSvc.SetContentResolver(app); err != nil {
		t.Fatal(err)
	}
	modSvc.SetClockForTest(func() time.Time { return now })
	app.SetClockForTest(func() time.Time { return now })
	return &fixture{auth: auth, mod: modSvc, app: app, now: now}
}

func (f *fixture) createPost(t *testing.T, c, author, id model.ObjectID) content.Post {
	t.Helper()
	p, err := f.app.CreatePost(author, content.CreatePostRequest{
		ID: id, CommunityID: c, Anchor: anchor(string(id)),
		Visibility: model.VisibilityPublic, IdempotencyKey: "create-" + string(id),
	})
	if err != nil {
		t.Fatal(err)
	}
	return p
}

func reportPost(t *testing.T, f *fixture, reporter model.ObjectID, p content.Post, caseID, recordID model.ObjectID) moderation.Record {
	t.Helper()
	r, err := f.mod.Report(reporter, moderation.OpenCaseRequest{
		RecordID: recordID, CaseID: caseID, CommunityID: p.CommunityID,
		TargetKind: moderation.TargetPost, TargetID: p.ID,
		Reason: "SPAM", BodyRef: "ipfs://report-" + string(recordID), BodySHA256: hash("report-" + string(recordID)),
		IdempotencyKey: "report-" + string(recordID),
	})
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func TestCanonicalModerationVocabularyIsComplete(t *testing.T) {
	actions := []moderation.Action{
		moderation.ActionReport,
		moderation.ActionHide,
		moderation.ActionBlock,
		moderation.ActionMute,
		moderation.ActionSuspend,
		moderation.ActionAppeal,
		moderation.ActionModeratorDecision,
		moderation.ActionRestore,
		moderation.ActionLock,
	}
	want := []string{"REPORT", "HIDE", "BLOCK", "MUTE", "SUSPEND", "APPEAL", "MODERATOR_DECISION", "RESTORE", "LOCK"}
	if len(actions) != len(want) {
		t.Fatal("moderation vocabulary length drift")
	}
	for i := range actions {
		if string(actions[i]) != want[i] {
			t.Fatalf("action[%d]=%s want %s", i, actions[i], want[i])
		}
	}
}

func TestModeratorAuthorityIsCommunityScoped(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityB, alice, "post-b")
	reportPost(t, f, bob, post, "case-b", "report-b")

	_, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "hide-b-denied", CaseID: "case-b", Action: moderation.ActionHide,
		Reason: "SPAM", IdempotencyKey: "hide-b-denied",
	})
	if !errors.Is(err, moderation.ErrUnauthorized) {
		t.Fatalf("cross-community moderator should fail, got %v", err)
	}

	_, err = f.mod.Moderate(adminB, moderation.ModerateRequest{
		RecordID: "hide-b", CaseID: "case-b", Action: moderation.ActionHide,
		Reason: "SPAM", IdempotencyKey: "hide-b",
	})
	if err != nil {
		t.Fatal(err)
	}
}

func TestOrdinaryMemberCannotUsePrivilegedModerationActions(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-member")
	reportPost(t, f, bob, post, "case-member", "report-member")

	for i, action := range []moderation.Action{moderation.ActionHide, moderation.ActionLock, moderation.ActionRestore} {
		_, err := f.mod.Moderate(bob, moderation.ModerateRequest{
			RecordID: model.ObjectID("member-action-" + string(rune('a'+i))),
			CaseID: "case-member", Action: action, Reason: "SPAM",
			IdempotencyKey: "member-key-" + string(rune('a'+i)),
		})
		if !errors.Is(err, moderation.ErrUnauthorized) {
			t.Fatalf("member action %s should fail, got %v", action, err)
		}
	}
}

func TestHideCannotBeBypassedThroughReadVoteRevisionOrThreadPaths(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-hide")
	reportPost(t, f, bob, post, "case-hide", "report-hide")
	_, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "hide-action", CaseID: "case-hide", Action: moderation.ActionHide,
		Reason: "SPAM", IdempotencyKey: "hide-action",
	})
	if err != nil {
		t.Fatal(err)
	}

	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); !errors.Is(err, content.ErrVisibilityDenied) {
		t.Fatalf("hidden post read bypass: %v", err)
	}
	if _, err := f.app.PostRevisions(content.ViewerContext{ActorID: bob}, post.ID); !errors.Is(err, content.ErrVisibilityDenied) {
		t.Fatalf("hidden revision history bypass: %v", err)
	}
	if _, err := f.app.SetVote(bob, content.SetVoteRequest{
		TargetKind: content.TargetPost, TargetID: post.ID, Value: 1, IdempotencyKey: "vote-hidden",
	}); !errors.Is(err, content.ErrVisibilityDenied) {
		t.Fatalf("hidden vote bypass: %v", err)
	}
	if _, err := f.app.RevisePost(alice, content.RevisePostRequest{
		PostID: post.ID, Anchor: anchor("hidden-edit"), IdempotencyKey: "hidden-edit",
	}); !errors.Is(err, content.ErrModerationDenied) {
		t.Fatalf("hidden edit bypass: %v", err)
	}
	if _, err := f.app.CreateThread(alice, content.CreateThreadRequest{
		ID: "thread-hidden", RootPostID: post.ID, IdempotencyKey: "thread-hidden",
	}); !errors.Is(err, content.ErrModerationDenied) {
		t.Fatalf("hidden thread bypass: %v", err)
	}

	if _, err := f.app.GetPost(content.ViewerContext{ActorID: modA}, post.ID); err != nil {
		t.Fatalf("domain moderator must retain review access: %v", err)
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: alice}, post.ID); err != nil {
		t.Fatalf("affected author must retain own hidden-content access: %v", err)
	}
}

func TestLockPreservesReadButBlocksInteractionUntilRestore(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-lock")
	reportPost(t, f, bob, post, "case-lock", "report-lock")
	_, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "lock-action", CaseID: "case-lock", Action: moderation.ActionLock,
		Reason: "HARASSMENT", IdempotencyKey: "lock-action",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); err != nil {
		t.Fatalf("lock should not hide read: %v", err)
	}
	if _, err := f.app.SetVote(bob, content.SetVoteRequest{
		TargetKind: content.TargetPost, TargetID: post.ID, Value: 1, IdempotencyKey: "vote-locked",
	}); !errors.Is(err, content.ErrModerationDenied) {
		t.Fatalf("locked vote bypass: %v", err)
	}
	if _, err := f.app.CreateThread(alice, content.CreateThreadRequest{
		ID: "thread-locked", RootPostID: post.ID, IdempotencyKey: "thread-locked",
	}); !errors.Is(err, content.ErrModerationDenied) {
		t.Fatalf("locked thread bypass: %v", err)
	}

	_, err = f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "restore-lock", CaseID: "case-lock", Action: moderation.ActionRestore,
		Reason: "APPEAL_GRANTED", IdempotencyKey: "restore-lock",
	})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.app.CreateThread(alice, content.CreateThreadRequest{
		ID: "thread-restored", RootPostID: post.ID, IdempotencyKey: "thread-restored",
	}); err != nil {
		t.Fatalf("restoration did not restore interaction: %v", err)
	}
}

func TestAppealPreservesDecisionHistoryAndRestoration(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-appeal")
	report := reportPost(t, f, bob, post, "case-appeal", "report-appeal")

	hide, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "hide-appeal", CaseID: "case-appeal", Action: moderation.ActionHide,
		Reason: "SPAM", BodyRef: "ipfs://hide", BodySHA256: hash("hide"), IdempotencyKey: "hide-appeal",
	})
	if err != nil {
		t.Fatal(err)
	}
	if hide.ParentRecordID != report.ID {
		t.Fatalf("hide parent=%s want %s", hide.ParentRecordID, report.ID)
	}

	_, err = f.mod.Appeal(bob, moderation.AppealRequest{
		RecordID: "wrong-appeal", CaseID: "case-appeal", Reason: "DISAGREE",
		IdempotencyKey: "wrong-appeal",
	})
	if !errors.Is(err, moderation.ErrUnauthorized) {
		t.Fatalf("reporter must not appeal for affected author: %v", err)
	}

	appeal, err := f.mod.Appeal(alice, moderation.AppealRequest{
		RecordID: "appeal-action", CaseID: "case-appeal", Reason: "CONTEXT",
		BodyRef: "ipfs://appeal", BodySHA256: hash("appeal"), IdempotencyKey: "appeal-action",
	})
	if err != nil {
		t.Fatal(err)
	}
	if appeal.ParentRecordID != hide.ID || appeal.PreviousState != moderation.StateHidden {
		t.Fatalf("appeal provenance drift: %+v", appeal)
	}

	decision, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "decision-action", CaseID: "case-appeal", Action: moderation.ActionModeratorDecision,
		Reason: "APPEAL_REVIEWED", BodyRef: "ipfs://decision", BodySHA256: hash("decision"),
		IdempotencyKey: "decision-action",
	})
	if err != nil {
		t.Fatal(err)
	}
	if decision.ParentRecordID != appeal.ID || decision.PreviousState != moderation.StateAppealed {
		t.Fatalf("decision provenance drift: %+v", decision)
	}

	restore, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "restore-action", CaseID: "case-appeal", Action: moderation.ActionRestore,
		Reason: "APPEAL_GRANTED", IdempotencyKey: "restore-action",
	})
	if err != nil {
		t.Fatal(err)
	}
	if restore.ParentRecordID != decision.ID {
		t.Fatalf("restore provenance drift: %+v", restore)
	}

	records := f.mod.Records("case-appeal")
	if len(records) != 5 {
		t.Fatalf("records=%d want 5", len(records))
	}
	for i, r := range records {
		if r.Version != uint64(i+1) {
			t.Fatalf("record %d version=%d", i, r.Version)
		}
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); err != nil {
		t.Fatalf("restored post not readable: %v", err)
	}
}

func TestSuspensionIsCommunityScopedAppealableAndRestorable(t *testing.T) {
	f := newFixture(t)
	report, err := f.mod.Report(alice, moderation.OpenCaseRequest{
		RecordID: "report-user", CaseID: "case-user", CommunityID: communityA,
		TargetKind: moderation.TargetUser, TargetID: bob, Reason: "HARASSMENT",
		IdempotencyKey: "report-user",
	})
	if err != nil {
		t.Fatal(err)
	}
	if report.AffectedID != bob {
		t.Fatal("user report affected identity drift")
	}
	_, err = f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "suspend-user", CaseID: "case-user", Action: moderation.ActionSuspend,
		Reason: "HARASSMENT", IdempotencyKey: "suspend-user",
	})
	if err != nil {
		t.Fatal(err)
	}
	if !f.mod.IsSuspended(communityA, bob) {
		t.Fatal("suspension not active")
	}
	if _, err := f.app.CreatePost(bob, content.CreatePostRequest{
		ID: "bob-suspended", CommunityID: communityA, Anchor: anchor("bob-suspended"),
		Visibility: model.VisibilityPublic, IdempotencyKey: "bob-suspended",
	}); !errors.Is(err, content.ErrModerationDenied) {
		t.Fatalf("suspended write bypass: %v", err)
	}
	if _, err := f.app.CreatePost(bob, content.CreatePostRequest{
		ID: "bob-other-community", CommunityID: communityB, Anchor: anchor("bob-other-community"),
		Visibility: model.VisibilityPublic, IdempotencyKey: "bob-other-community",
	}); err != nil {
		t.Fatalf("community-scoped suspension leaked across domain: %v", err)
	}

	if _, err := f.mod.Appeal(bob, moderation.AppealRequest{
		RecordID: "appeal-user", CaseID: "case-user", Reason: "CONTEXT",
		IdempotencyKey: "appeal-user",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "decision-user", CaseID: "case-user", Action: moderation.ActionModeratorDecision,
		Reason: "APPEAL_REVIEWED", IdempotencyKey: "decision-user",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "restore-user", CaseID: "case-user", Action: moderation.ActionRestore,
		Reason: "APPEAL_GRANTED", IdempotencyKey: "restore-user",
	}); err != nil {
		t.Fatal(err)
	}
	if f.mod.IsSuspended(communityA, bob) {
		t.Fatal("suspension not restored")
	}
	if _, err := f.app.CreatePost(bob, content.CreatePostRequest{
		ID: "bob-restored", CommunityID: communityA, Anchor: anchor("bob-restored"),
		Visibility: model.VisibilityPublic, IdempotencyKey: "bob-restored",
	}); err != nil {
		t.Fatalf("restored user cannot write: %v", err)
	}
}

func TestBlockAndMuteAreUserScoped(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-rel")

	if _, err := f.mod.Mute(bob, alice, "mute-alice"); err != nil {
		t.Fatal(err)
	}
	if !f.mod.IsMuted(bob, alice) {
		t.Fatal("mute not active")
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); !errors.Is(err, content.ErrVisibilityDenied) {
		t.Fatalf("muted author should be hidden from muting user: %v", err)
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: modA}, post.ID); err != nil {
		t.Fatalf("mute leaked to unrelated viewer: %v", err)
	}
	if err := f.mod.Unmute(bob, alice); err != nil {
		t.Fatal(err)
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); err != nil {
		t.Fatalf("unmute did not restore read: %v", err)
	}

	if _, err := f.mod.Block(alice, bob, "block-bob"); err != nil {
		t.Fatal(err)
	}
	if !f.mod.IsBlocked(alice, bob) {
		t.Fatal("block not active")
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); !errors.Is(err, content.ErrVisibilityDenied) {
		t.Fatalf("blocked viewer bypass: %v", err)
	}
	if err := f.mod.Unblock(alice, bob); err != nil {
		t.Fatal(err)
	}
	if _, err := f.app.GetPost(content.ViewerContext{ActorID: bob}, post.ID); err != nil {
		t.Fatalf("unblock did not restore read: %v", err)
	}
}

func TestModerationIdempotencyAndConflictingReplay(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-idem-mod")
	req := moderation.OpenCaseRequest{
		RecordID: "report-idem", CaseID: "case-idem", CommunityID: communityA,
		TargetKind: moderation.TargetPost, TargetID: post.ID, Reason: "SPAM",
		IdempotencyKey: "report-idem-key",
	}
	first, err := f.mod.Report(bob, req)
	if err != nil {
		t.Fatal(err)
	}
	second, err := f.mod.Report(bob, req)
	if err != nil {
		t.Fatal(err)
	}
	if first.ID != second.ID || first.Version != second.Version {
		t.Fatal("idempotent moderation retry mutated result")
	}

	req.CaseID = "case-idem-other"
	req.RecordID = "report-idem-other"
	_, err = f.mod.Report(bob, req)
	if !errors.Is(err, moderation.ErrIdempotencyConflict) {
		t.Fatalf("expected moderation idempotency conflict, got %v", err)
	}
}

func TestRestoredTargetCanBeReportedAgainWithoutRewritingHistory(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-repeat")
	reportPost(t, f, bob, post, "case-first", "report-first")
	if _, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "hide-first", CaseID: "case-first", Action: moderation.ActionHide,
		Reason: "SPAM", IdempotencyKey: "hide-first",
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.mod.Moderate(modA, moderation.ModerateRequest{
		RecordID: "restore-first", CaseID: "case-first", Action: moderation.ActionRestore,
		Reason: "CORRECTED", IdempotencyKey: "restore-first",
	}); err != nil {
		t.Fatal(err)
	}

	second := reportPost(t, f, bob, post, "case-second", "report-second")
	if second.CaseID != "case-second" {
		t.Fatal("second report did not open independent case")
	}
	if got := len(f.mod.Records("case-first")); got != 3 {
		t.Fatalf("first case history rewritten, records=%d", got)
	}
}

func TestInvalidModerationEvidenceDigestFailsClosed(t *testing.T) {
	f := newFixture(t)
	post := f.createPost(t, communityA, alice, "post-bad-evidence")
	_, err := f.mod.Report(bob, moderation.OpenCaseRequest{
		RecordID: "bad-evidence", CaseID: "bad-evidence-case", CommunityID: communityA,
		TargetKind: moderation.TargetPost, TargetID: post.ID, Reason: "SPAM",
		BodyRef: "ipfs://bad", BodySHA256: "NOT-A-SHA256", IdempotencyKey: "bad-evidence-key",
	})
	if !errors.Is(err, moderation.ErrInvalidInput) {
		t.Fatalf("invalid moderation digest must fail closed, got %v", err)
	}
}
