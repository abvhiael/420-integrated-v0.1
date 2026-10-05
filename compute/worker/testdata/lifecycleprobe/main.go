package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

func main() {
	payload, err := io.ReadAll(io.LimitReader(os.Stdin, 64<<20))
	if err != nil {
		fmt.Fprintln(os.Stderr, "cmp-lifecycle-probe:", err)
		os.Exit(1)
	}
	if len(payload) == 0 {
		fmt.Fprintln(os.Stderr, "cmp-lifecycle-probe: empty work unit")
		os.Exit(1)
	}
	sum := sha256.Sum256(payload)
	fmt.Printf("cmp-lifecycle-probe-ok %s\n", hex.EncodeToString(sum[:]))
}
