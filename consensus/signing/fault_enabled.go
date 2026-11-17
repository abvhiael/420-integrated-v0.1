//go:build stake_signing_faults

package signing

import (
	"fmt"
	"os"
	"syscall"
)

func qualificationStage(stage string) {
	if os.Getenv("STAKE_SIGNING_STOP_AT") == stage {
		fmt.Fprintf(os.Stderr, "signing_fault stage=%s pid=%d\n", stage, os.Getpid())
		_ = syscall.Kill(os.Getpid(), syscall.SIGSTOP)
		// Remain at the boundary even if the host mediates the stop signal. Only
		// the qualifying parent can terminate this deliberately instrumented process.
		select {}
	}
}
