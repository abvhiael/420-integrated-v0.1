package storage

import (
	"context"

	"github.com/420integrated/420-integrated/media/authority"
)

type RightsGuard interface {
	AuthorizePublication(context.Context, authority.Actor, authority.Binding) error
	AuthorizeReuse(context.Context, authority.Actor, authority.Binding) error
}

// AuthorizePublicProjection is the rights-bearing publication gate. CanProjectPublic
// remains only the local visibility/state predicate; callers that actually publish or
// project an asset must pass this live canonical authorization check first.
func AuthorizePublicProjection(
	ctx context.Context,
	guard RightsGuard,
	actor authority.Actor,
	asset Asset,
	binding authority.Binding,
) error {
	if guard == nil || !CanProjectPublic(asset) {
		return ErrAccessDenied
	}
	if err := guard.AuthorizePublication(ctx, actor, binding); err != nil {
		return err
	}
	return nil
}

// ValidateDerivativeReuse combines the existing Media derivative integrity checks with
// a live canonical Rights license check for reuse. A valid local derivative relationship
// never substitutes for a right/license.
func ValidateDerivativeReuse(
	ctx context.Context,
	guard RightsGuard,
	actor authority.Actor,
	source Asset,
	derivative Asset,
	binding authority.Binding,
) error {
	if err := ValidateDerivative(source, derivative); err != nil {
		return err
	}
	if guard == nil {
		return ErrAccessDenied
	}
	return guard.AuthorizeReuse(ctx, actor, binding)
}
