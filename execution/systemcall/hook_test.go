package systemcall

import (
	"errors"
	"testing"
)

type testEncoder struct{}
func (testEncoder) EncodeGatewayApply(e Envelope) ([]byte, error) { return append([]byte{0xaa}, e.Payload...), nil }

type testExec struct { calls int; failAt int }
func (e *testExec) ExecuteConsensusMessage(origin string, destination string, input []byte) error {
	if origin != NativeSystemOrigin || destination != GatewayAddress { return errors.New("wrong route") }
	e.calls++
	if e.failAt != 0 && e.calls == e.failAt { return errors.New("evm revert") }
	return nil
}

func TestApplyBatchOrdersSequences(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	ctx := Context{LastSequence: 4, BlockNumber: 9, ParentHash: parent, ChainID: 420}
	calls := []Envelope{
		{Sequence: 5, ExecutionBlock: 9, ParentHash: parent, ChainID: 420, Action: ActionValidatorState, Target: ValidatorRegistry, Payload: []byte{1,2,3,4}},
		{Sequence: 6, ExecutionBlock: 9, ParentHash: parent, ChainID: 420, Action: ActionReward, Target: RewardController, Payload: []byte{5,6,7,8}},
	}
	exec := &testExec{}
	if err := ApplyBatch(ctx, calls, testEncoder{}, exec); err != nil { t.Fatal(err) }
	if exec.calls != 2 { t.Fatalf("calls=%d", exec.calls) }
}

func TestValidateBatchRejectsGapBeforeExecution(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	ctx := Context{LastSequence: 4, BlockNumber: 9, ParentHash: parent, ChainID: 420}
	calls := []Envelope{
		{Sequence: 5, ExecutionBlock: 9, ParentHash: parent, ChainID: 420, Action: ActionValidatorState, Target: ValidatorRegistry, Payload: []byte{1,2,3,4}},
		{Sequence: 7, ExecutionBlock: 9, ParentHash: parent, ChainID: 420, Action: ActionReward, Target: RewardController, Payload: []byte{5,6,7,8}},
	}
	if err := ValidateBatch(ctx, calls); err == nil { t.Fatal("sequence gap accepted") }
}

func TestApplyBatchPropagatesEVMFailure(t *testing.T) {
	var parent [32]byte
	parent[0] = 1
	ctx := Context{LastSequence: 0, BlockNumber: 1, ParentHash: parent, ChainID: 420}
	calls := []Envelope{{Sequence: 1, ExecutionBlock: 1, ParentHash: parent, ChainID: 420, Action: ActionReward, Target: RewardController, Payload: []byte{1,2,3,4}}}
	exec := &testExec{failAt: 1}
	if err := ApplyBatch(ctx, calls, testEncoder{}, exec); err == nil { t.Fatal("execution failure swallowed") }
}
