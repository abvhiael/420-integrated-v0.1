package main

import (
	"fmt"
	"net"
	"os"
	"strings"
	"time"
)

func main() {
	if os.Geteuid() == 0 {
		fail("running as root")
	}
	if err := os.WriteFile("/cmp-host-root-write", []byte("no"), 0o600); err == nil {
		fail("read-only root filesystem is writable")
	}
	if err := os.WriteFile("/tmp/cmp-sandbox-probe", []byte("ok"), 0o600); err != nil {
		fail("sandbox tmpfs is not writable: " + err.Error())
	}

	status, err := os.ReadFile("/proc/self/status")
	if err != nil {
		fail("cannot read process status: " + err.Error())
	}
	text := string(status)
	if !strings.Contains(text, "NoNewPrivs:\t1") {
		fail("no-new-privileges is not enforced")
	}
	capEff := statusField(text, "CapEff:")
	if capEff == "" || strings.Trim(capEff, "0") != "" {
		fail("effective capabilities are not zero: " + capEff)
	}

	conn, err := net.DialTimeout("tcp", "1.1.1.1:53", 200*time.Millisecond)
	if err == nil {
		_ = conn.Close()
		fail("network egress unexpectedly available")
	}

	fmt.Println("cmp-sandbox-probe-ok")
}

func statusField(status, prefix string) string {
	for _, line := range strings.Split(status, "\n") {
		if strings.HasPrefix(line, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(line, prefix))
		}
	}
	return ""
}

func fail(message string) {
	fmt.Fprintln(os.Stderr, "cmp-sandbox-probe:", message)
	os.Exit(1)
}
