package main

import (
	"bytes"
	"fmt"
	"os"
)

const outputBytes = 96 << 10

func main() {
	payload := bytes.Repeat([]byte("R"), outputBytes)
	if _, err := os.Stdout.Write(payload); err != nil {
		fmt.Fprintln(os.Stderr, "cmp-result-probe:", err)
		os.Exit(1)
	}
	fmt.Fprintln(os.Stderr, "cmp-result-probe-diagnostic")
}
