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
	resp, err := s.Client.ForkchoiceUpdatedV3(ctx, state, nil)
	if err != nil { return err }
	return requireValidExecution(resp.PayloadStatus, state.HeadBlockHash)
}
