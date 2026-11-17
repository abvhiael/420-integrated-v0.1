//go:build !blst

package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "STAKE_OPERATOR_INITIALIZATION_UNAVAILABLE: build with -tags blst")
	os.Exit(1)
}
