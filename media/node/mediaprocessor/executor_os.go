package mediaprocessor

import (
	"context"
	"os/exec"
)

// OSExecutor runs media engines directly without a shell. This prevents requester-controlled
// URIs or destinations from being interpreted as shell syntax.
type OSExecutor struct{}

func (OSExecutor) Run(ctx context.Context, binary string, args []string) error {
	cmd := exec.CommandContext(ctx, binary, args...)
	return cmd.Run()
}
