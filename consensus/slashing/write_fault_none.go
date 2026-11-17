//go:build !stake_signing_faults

package slashing

import "os"

// Production builds contain no environment-controlled write interruption.
func qualificationHistoryWrite(*os.File, []byte) {}
