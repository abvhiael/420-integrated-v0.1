//go:build blst

package signing

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/consensus/slashing"
)

type child struct {
	cmd    *exec.Cmd
	done   chan error
	log    string
	output bytes.Buffer
	input  io.WriteCloser
}

func spawn(t *testing.T, binary string, args []string, env []string) *child {
	t.Helper()
	log := filepath.Join(privateDir(t), "stderr.log")
	f, err := os.Create(log)
	if err != nil {
		t.Fatal(err)
	}
	c := &child{cmd: exec.Command(binary, args...), done: make(chan error, 1), log: log}
	c.cmd.Env = append(os.Environ(), env...)
	c.cmd.Stderr = f
	c.cmd.Stdout = &c.output
	c.input, err = c.cmd.StdinPipe()
	if err != nil {
		t.Fatal(err)
	}
	if err = c.cmd.Start(); err != nil {
		t.Fatal(err)
	}
	go func() { err := c.cmd.Wait(); f.Close(); c.done <- err; close(c.done) }()
	t.Cleanup(func() {
		if c.cmd.Process != nil {
			_ = c.cmd.Process.Kill()
		}
		select {
		case <-c.done:
		case <-time.After(5 * time.Second):
			t.Errorf("child did not exit: %d", c.cmd.Process.Pid)
		}
	})
	return c
}
func (c *child) wait(t *testing.T, success bool) {
	t.Helper()
	select {
	case err := <-c.done:
		if (err == nil) != success {
			raw, _ := os.ReadFile(c.log)
			t.Fatalf("child success=%v error=%v stderr=%s stdout=%s", success, err, raw, c.output.String())
		}
	case <-time.After(15 * time.Second):
		t.Fatal("child timed out")
	}
}
func (c *child) kill(t *testing.T) {
	t.Helper()
	if err := c.cmd.Process.Signal(syscall.SIGKILL); err != nil {
		t.Fatal(err)
	}
	c.wait(t, false)
}
func freeAddress(t *testing.T) string {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	a := l.Addr().String()
	l.Close()
	return a
}
func waitListener(t *testing.T, addr string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		c, err := net.DialTimeout("tcp", addr, 100*time.Millisecond)
		if err == nil {
			c.Close()
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Fatal("signer listener not ready")
}
func waitFault(t *testing.T, c *child, stage string) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for time.Now().Before(deadline) {
		raw, _ := os.ReadFile(c.log)
		if strings.Contains(string(raw), "signing_fault stage="+stage) {
			return
		}
		time.Sleep(20 * time.Millisecond)
	}
	raw, _ := os.ReadFile(c.log)
	t.Fatalf("fault boundary not reached: %s", raw)
}
func write(t *testing.T, path string, raw []byte) {
	t.Helper()
	if err := os.WriteFile(path, raw, 0600); err != nil {
		t.Fatal(err)
	}
}

func TestActualProtectedSigningProcesses(t *testing.T) {
	signerBinary, nodeBinary := os.Getenv("STAKE_SIGNER_BINARY"), os.Getenv("STAKE_CONSENSUS_BINARY")
	productionBinary := os.Getenv("STAKE_SIGNER_PRODUCTION_BINARY")
	if signerBinary == "" || nodeBinary == "" || productionBinary == "" {
		if os.Getenv("STAKE_SIGNER_REQUIRE_PG") == "1" {
			t.Fatal("built production signing binaries required")
		}
		t.Skip("set signer/consensus binary paths for process qualification")
	}
	db := database(t)
	f := transportFiles(t)
	for _, stage := range []string{"local-reserved", "witness-committed", "signature-created"} {
		t.Run(stage, func(t *testing.T) {
			p, ikm := policy(t)
			remoteDir, nodeDir := privateDir(t), privateDir(t)
			policyRaw, _ := json.Marshal(p)
			pin := sha256.Sum256(policyRaw)
			policyPath := filepath.Join(remoteDir, "policy.json")
			write(t, policyPath, policyRaw)
			write(t, filepath.Join(nodeDir, "policy.json"), policyRaw)
			remoteHistory := filepath.Join(remoteDir, "history.json")
			nodeHistory := filepath.Join(nodeDir, "history.json")
			write(t, filepath.Join(remoteDir, "bls.hex"), []byte(hex.EncodeToString(ikm)))
			write(t, filepath.Join(remoteDir, "witness.dsn"), []byte(os.Getenv("STAKE_SIGNER_PG_DSN")))
			// The consensus process gets a distinct directory and transport key. It is
			// never configured with the BLS key or the witness database credential file.
			if err := slashing.InitializeHistory(nodeHistory, p.Identity); err != nil {
				t.Fatal(err)
			}
			addr := freeAddress(t)
			args := []string{"--policy", policyPath, "--policy-sha256", hex.EncodeToString(pin[:]), "--history", remoteHistory, "--bls-ikm", filepath.Join(remoteDir, "bls.hex"), "--witness-dsn", filepath.Join(remoteDir, "witness.dsn"), "--tls-cert", filepath.Join(f.dir, "server.pem"), "--tls-key", filepath.Join(f.dir, "server.key"), "--tls-ca", filepath.Join(f.dir, "ca.pem"), "--client-spki-sha256", fmt.Sprintf("%x", f.pins["client"]), "--listen", addr}
			provision := spawn(t, productionBinary, append(append([]string{}, args...), "--provision-never-used-key"), nil)
			provision.input.Close()
			provision.wait(t, true)
			initial, err := os.ReadFile(remoteHistory)
			if err != nil {
				t.Fatal(err)
			}
			startSigner := func(fault string) *child {
				env := []string{}
				if fault != "" {
					env = append(env, "STAKE_SIGNING_STOP_AT="+fault)
				}
				binary := productionBinary
				if fault != "" {
					binary = signerBinary
				}
				c := spawn(t, binary, args, env)
				c.input.Close()
				return c
			}
			nodeArgs := []string{"--protected-signing", "--signer", "https://" + addr, "--signing-policy", filepath.Join(nodeDir, "policy.json"), "--signing-policy-sha256", hex.EncodeToString(pin[:]), "--signing-history", nodeHistory, "--signer-client-cert", filepath.Join(f.dir, "client.pem"), "--signer-client-key", filepath.Join(f.dir, "client.key"), "--signer-ca", filepath.Join(f.dir, "ca.pem"), "--signer-spki-sha256", fmt.Sprintf("%x", f.pins["server"])}
			duty := proposal(p, 10)
			dutyRaw, _ := json.Marshal(duty)
			request := func(raw []byte) *child {
				c := spawn(t, nodeBinary, nodeArgs, nil)
				_, _ = c.input.Write(append(raw, '\n'))
				c.input.Close()
				return c
			}
			server := startSigner(stage)
			waitListener(t, addr)
			node := request(dutyRaw)
			waitFault(t, server, stage)
			serverPID := server.cmd.Process.Pid
			server.kill(t)
			node.wait(t, false)
			if node.output.Len() != 0 {
				t.Fatal("crashed signer released signature")
			}
			var witnessed []byte
			if err = db.QueryRow(`select history from stake_signing_witness_v1 where identity=$1`, identityKey(p)).Scan(&witnessed); err != nil {
				t.Fatal(err)
			}
			local, err := os.ReadFile(remoteHistory)
			if err != nil {
				t.Fatal(err)
			}
			if stage == "local-reserved" {
				if bytes.Equal(local, witnessed) || !bytes.Equal(initial, witnessed) {
					t.Fatal("pre-witness crash evidence inconsistent")
				}
				halted := startSigner("")
				halted.wait(t, false)
				recovery := spawn(t, productionBinary, append(append([]string{}, args...), "--recover-witness-history"), nil)
				recovery.input.Close()
				recovery.wait(t, true)
			} else if !bytes.Equal(local, witnessed) {
				t.Fatal("accepted reservation missing independent witness")
			}
			server = startSigner("")
			waitListener(t, addr)
			node = request(dutyRaw)
			node.wait(t, true)
			var response struct{ Result Result }
			scanner := bufio.NewScanner(bytes.NewReader(node.output.Bytes()))
			if !scanner.Scan() {
				t.Fatal("no signature after recovery")
			}
			if err = json.Unmarshal(scanner.Bytes(), &response); err != nil {
				t.Fatal(err)
			}
			if err = verifyResult(p, duty, response.Result); err != nil {
				t.Fatal(err)
			}
			nextDuty := proposal(p, 11)
			nextRaw, _ := json.Marshal(nextDuty)
			progressed := request(nextRaw)
			progressed.wait(t, true)
			var nextResponse struct{ Result Result }
			if err = json.Unmarshal(bytes.TrimSpace(progressed.output.Bytes()), &nextResponse); err != nil {
				t.Fatal(err)
			}
			if err = verifyResult(p, nextDuty, nextResponse.Result); err != nil {
				t.Fatal(err)
			}
			server.kill(t)
			// Roll back the integrity-valid journal while both signing processes are
			// offline. A live independent witness must prevent reopening the old state.
			write(t, remoteHistory, initial)
			halted := startSigner("")
			halted.wait(t, false)
			if !bytes.Contains(mustRead(t, halted.log), []byte("offline signing history rollback")) {
				t.Fatal("rollback did not fail at independent witness")
			}
			recovery := spawn(t, productionBinary, append(append([]string{}, args...), "--recover-witness-history"), nil)
			recovery.input.Close()
			recovery.wait(t, true)
			server = startSigner("")
			waitListener(t, addr)
			// A second consensus directory cannot bypass signer-side protection.
			freshPath := filepath.Join(privateDir(t), "history.json")
			if err = slashing.InitializeHistory(freshPath, p.Identity); err != nil {
				t.Fatal(err)
			}
			for i, arg := range nodeArgs {
				if arg == "--signing-history" {
					nodeArgs[i+1] = freshPath
				}
			}
			duty.Proposal.ExecutionPayloadHash = root(99)
			conflictRaw, _ := json.Marshal(duty)
			conflict := request(conflictRaw)
			conflict.wait(t, false)
			if conflict.output.Len() != 0 {
				t.Fatal("restored journal permitted double proposal")
			}
			server.kill(t)
			t.Logf("scenario=%s signer_pid=%d consensus_pid=%d fault=SIGKILL next_duty=verified production_signer=true witnessed_recovery=true offline_rollback=rejected conflicting_signature=absent", stage, serverPID, node.cmd.Process.Pid)
		})
	}
}
func mustRead(t *testing.T, path string) []byte {
	t.Helper()
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	return b
}
