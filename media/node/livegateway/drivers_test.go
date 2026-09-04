package livegateway

import (
	"context"
	"errors"
	"io"
	"net/http"
	"strings"
	"testing"
)

type fakeHTTP struct {
	status int
	body   string
	req    *http.Request
	err    error
}
func (f *fakeHTTP) Do(req *http.Request) (*http.Response, error) {
	f.req = req
	if f.err != nil { return nil, f.err }
	return &http.Response{StatusCode: f.status, Body: io.NopCloser(strings.NewReader(f.body)), Header: make(http.Header)}, nil
}

type fakeSDP struct { answer string; closed bool }
func (f *fakeSDP) Offer(context.Context, SessionSpec) (string, error) { return "v=0\no=offer", nil }
func (f *fakeSDP) ApplyAnswer(_ context.Context, _ SessionSpec, answer string) error { f.answer = answer; return nil }
func (f *fakeSDP) Close(context.Context, SessionSpec) error { f.closed = true; return nil }

type fakeCreds struct { value string; err error }
func (f fakeCreds) Resolve(context.Context, CredentialRef) (string, error) { return f.value, f.err }

type fakeProcessExec struct { binary string; args []string; stopped string }
func (f *fakeProcessExec) Start(_ context.Context, binary string, args []string) error { f.binary = binary; f.args = append([]string(nil), args...); return nil }
func (f *fakeProcessExec) Stop(_ context.Context, id string) error { f.stopped = id; return nil }

func TestWHIPNegotiationUsesSDPAndBearerCredential(t *testing.T) {
	httpClient := &fakeHTTP{status: 201, body: "v=0\no=answer"}
	peers := &fakeSDP{}
	driver, err := NewWebRTCDriver(httpClient, peers, fakeCreds{value: "token"})
	if err != nil { t.Fatal(err) }
	spec := SessionSpec{ID: "whip", Protocol: ProtocolWHIP, Direction: DirectionIngress, Endpoint: "https://edge.example/whip", CredentialRef: "cred-1", StreamRef: ref(1)}
	if err := driver.Start(context.Background(), spec); err != nil { t.Fatal(err) }
	if peers.answer == "" { t.Fatal("answer not applied") }
	if got := httpClient.req.Header.Get("Content-Type"); got != "application/sdp" { t.Fatalf("content-type=%q", got) }
	if got := httpClient.req.Header.Get("Authorization"); got != "Bearer token" { t.Fatalf("authorization=%q", got) }
}

func TestWHIPMissingCredentialFailsClosed(t *testing.T) {
	driver, _ := NewWebRTCDriver(&fakeHTTP{status: 201, body: "answer"}, &fakeSDP{}, nil)
	err := driver.Start(context.Background(), SessionSpec{ID: "whip", Protocol: ProtocolWHIP, Direction: DirectionIngress, Endpoint: "https://edge.example/whip", CredentialRef: "cred", StreamRef: ref(1)})
	if !errors.Is(err, ErrMissingCredential) { t.Fatalf("err=%v", err) }
}

func TestWHEPRejectsNonSuccessStatus(t *testing.T) {
	driver, _ := NewWebRTCDriver(&fakeHTTP{status: 401, body: "no"}, &fakeSDP{}, nil)
	err := driver.Start(context.Background(), SessionSpec{ID: "whep", Protocol: ProtocolWHEP, Direction: DirectionEgress, Endpoint: "https://edge.example/whep", StreamRef: ref(1)})
	if !errors.Is(err, ErrNegotiationFailed) { t.Fatalf("err=%v", err) }
}

func TestProcessDriverUsesDirectArgv(t *testing.T) {
	exec := &fakeProcessExec{}
	driver, err := NewProcessDriver(ProtocolSRT, "srt-gateway", exec)
	if err != nil { t.Fatal(err) }
	spec := SessionSpec{ID: "srt-1", Protocol: ProtocolSRT, Direction: DirectionIngress, Endpoint: "srt://edge.example:9000?streamid=abc;touch /tmp/pwn", CredentialRef: "vault:key", StreamRef: ref(2)}
	if err := driver.Start(context.Background(), spec); err != nil { t.Fatal(err) }
	if exec.binary != "srt-gateway" { t.Fatalf("binary=%q", exec.binary) }
	foundEndpoint := false
	for _, arg := range exec.args { if arg == spec.Endpoint { foundEndpoint = true } }
	if !foundEndpoint { t.Fatalf("args=%v", exec.args) }
	if err := driver.Stop(context.Background(), spec); err != nil { t.Fatal(err) }
	if exec.stopped != spec.ID { t.Fatalf("stopped=%q", exec.stopped) }
}
