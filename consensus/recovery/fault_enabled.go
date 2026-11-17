//go:build recoveryfault

package recovery

import (
	"os"
	"strconv"
	"syscall"
)

// Only the explicitly instrumented qualification build can stop at this boundary.
// The harness must send the actual SIGKILL; the production build has no env hook.
func QualificationStop(slot uint64) {
	if os.Getenv("FOURTWENTYD_RECOVERY_STOP_SLOT") == strconv.FormatUint(slot, 10) {
		_ = syscall.Kill(os.Getpid(), syscall.SIGSTOP)
	}
}
