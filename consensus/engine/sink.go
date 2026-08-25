package engine

import (
	"context"
)

type ForkchoiceSink interface {
	UpdateForkchoice(context.Context, ForkchoiceStateV1) error
}

type ClientSink struct {
	Client *Client
}

func (s ClientSink) UpdateForkchoice(ctx context.Context, state ForkchoiceStateV1) error {
	if s.Client == nil {
		return nil
	}
	_, err := s.Client.ForkchoiceUpdatedV3(ctx, state, nil)
	return err
}
