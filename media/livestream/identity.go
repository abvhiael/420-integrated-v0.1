package livestream

import (
	"context"

	"github.com/420integrated/420-integrated/media/authority"
	"github.com/420integrated/420-integrated/media/node/livegateway"
)

type ActorAuthorizer interface {
	AuthorizeActor(context.Context, authority.Actor) error
}

func (s Service) CreateForActor(
	ctx context.Context,
	authorizer ActorAuthorizer,
	actor authority.Actor,
	spec livegateway.SessionSpec,
) (Record, error) {
	if authorizer == nil {
		return Record{}, authority.ErrInvalidActor
	}
	if err := authorizer.AuthorizeActor(ctx, actor); err != nil {
		return Record{}, err
	}
	return s.Create(ctx, actor.Wallet, spec)
}

func (s Service) StartForActor(
	ctx context.Context,
	authorizer ActorAuthorizer,
	actor authority.Actor,
	id string,
) (Record, error) {
	if authorizer == nil {
		return Record{}, authority.ErrInvalidActor
	}
	if err := authorizer.AuthorizeActor(ctx, actor); err != nil {
		return Record{}, err
	}
	return s.Start(ctx, actor.Wallet, id)
}

func (s Service) StopForActor(
	ctx context.Context,
	authorizer ActorAuthorizer,
	actor authority.Actor,
	id string,
) (Record, error) {
	if authorizer == nil {
		return Record{}, authority.ErrInvalidActor
	}
	if err := authorizer.AuthorizeActor(ctx, actor); err != nil {
		return Record{}, err
	}
	return s.Stop(ctx, actor.Wallet, id)
}

func (s Service) StatusForActor(
	ctx context.Context,
	authorizer ActorAuthorizer,
	actor authority.Actor,
	id string,
) (Record, error) {
	if authorizer == nil {
		return Record{}, authority.ErrInvalidActor
	}
	if err := authorizer.AuthorizeActor(ctx, actor); err != nil {
		return Record{}, err
	}
	return s.Status(ctx, actor.Wallet, id)
}
