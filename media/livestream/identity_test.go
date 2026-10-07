package livestream

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/authority"
)

type actorAuthorizerFake struct {
	err   error
	calls int
	actor authority.Actor
}

func (f *actorAuthorizerFake) AuthorizeActor(_ context.Context, actor authority.Actor) error {
	f.calls++
	f.actor = actor
	return f.err
}

func TestIdentityAwareLivestreamControllerFlow(t *testing.T) {
	driver := &driverFake{}
	streamAuthority := &authorityFake{controller: "0x1111111111111111111111111111111111111111"}
	svc := serviceFixture(t, driver, streamAuthority, FixedFeatureGate{Livestreaming: true})
	actorAuth := &actorAuthorizerFake{}
	actor := authority.Actor{
		Wallet:    "0x1111111111111111111111111111111111111111",
		ProfileID: streamRef(9),
	}
	created, err := svc.CreateForActor(context.Background(), actorAuth, actor, sessionSpec())
	if err != nil {
		t.Fatal(err)
	}
	if actorAuth.calls != 1 || actorAuth.actor.ProfileID != actor.ProfileID {
		t.Fatalf("actor auth=%+v calls=%d", actorAuth.actor, actorAuth.calls)
	}
	if _, err := svc.StartForActor(context.Background(), actorAuth, actor, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.StatusForActor(context.Background(), actorAuth, actor, created.ID); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.StopForActor(context.Background(), actorAuth, actor, created.ID); err != nil {
		t.Fatal(err)
	}
}

func TestIdentityFailureBlocksLivestreamBeforeTransport(t *testing.T) {
	driver := &driverFake{}
	streamAuthority := &authorityFake{controller: "0x1111111111111111111111111111111111111111"}
	svc := serviceFixture(t, driver, streamAuthority, FixedFeatureGate{Livestreaming: true})
	actorAuth := &actorAuthorizerFake{err: authority.ErrIdentityInactive}
	_, err := svc.CreateForActor(
		context.Background(),
		actorAuth,
		authority.Actor{Wallet: "0x1111111111111111111111111111111111111111", ProfileID: streamRef(9)},
		sessionSpec(),
	)
	if !errors.Is(err, authority.ErrIdentityInactive) {
		t.Fatalf("err=%v", err)
	}
	if driver.starts != 0 {
		t.Fatalf("transport started=%d", driver.starts)
	}
}
