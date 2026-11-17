//go:build stake_signing_faults

package slashing

import (
	"fmt"
	"os"
	"syscall"
)

// Only the explicit signer qualification binary may leave a partial temp file.
// The harness SIGKILLs it and asserts the old journal and witness survive.
func qualificationHistoryWrite(f *os.File, raw []byte) {
	if os.Getenv("STAKE_SIGNING_STOP_AT") != "history-write" {
		return
	}
	if _, err := f.Write(raw[:len(raw)/2]); err != nil {
		panic(err)
	}
	if err := f.Sync(); err != nil {
		panic(err)
	}
	fmt.Fprintf(os.Stderr, "signing_fault stage=history-write pid=%d\n", os.Getpid())
	_ = syscall.Kill(os.Getpid(), syscall.SIGSTOP)
	select {}
}
