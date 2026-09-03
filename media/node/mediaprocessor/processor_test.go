package mediaprocessor

import (
	"context"
	"errors"
	"testing"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

type fakeResolver struct {
	uri string
	err error
}
func (f fakeResolver) ResolveInput(context.Context, [32]byte) (string, error) { return f.uri, f.err }

type fakeSink struct {
	destination string
	ref         [32]byte
	allocErr    error
	commitErr   error
	aborted     bool
}
func (f *fakeSink) Allocate(context.Context, medianode.Job, Profile) (string, error) { return f.destination, f.allocErr }
func (f *fakeSink) Commit(context.Context, string) ([32]byte, error) { return f.ref, f.commitErr }
func (f *fakeSink) Abort(context.Context, string) error { f.aborted = true; return nil }

type fakeExec struct {
	binary string
	args   []string
	err    error
}
func (f *fakeExec) Run(_ context.Context, binary string, args []string) error {
	f.binary = binary
	f.args = append([]string(nil), args...)
	return f.err
}

func id(v byte) [32]byte { var out [32]byte; out[31] = v; return out }

func profile(cap [32]byte) Profile {
	return Profile{CapabilityID: cap, Engine: EngineFFmpeg, Mode: ModeTranscode, VideoCodec: "h264", AudioCodec: "aac", Container: "mp4", Width: 1280, Height: 720, VideoBitrate: "2500k", AudioBitrate: "128k"}
}

func TestFFmpegProcessCommitsOpaqueOutputReference(t *testing.T) {
	cap := id(1)
	sink := &fakeSink{destination: "/tmp/out.mp4", ref: id(9)}
	executor := &fakeExec{}
	p, err := New(Config{Profiles: map[[32]byte]Profile{cap: profile(cap)}, MaxRuntime: time.Minute}, fakeResolver{uri: "file:///tmp/in.mov"}, sink, executor)
	if err != nil { t.Fatal(err) }
	p.now = func() time.Time { return time.Unix(1000, 0) }
	res, err := p.Process(context.Background(), medianode.Job{ID: id(2), InputRef: id(3), CapabilityID: cap, Deadline: time.Unix(1100, 0)})
	if err != nil { t.Fatal(err) }
	if res.OutputRef != id(9) { t.Fatalf("ref=%x", res.OutputRef) }
	if executor.binary != "ffmpeg" { t.Fatalf("binary=%q", executor.binary) }
	if len(executor.args) == 0 || executor.args[len(executor.args)-1] != "/tmp/out.mp4" { t.Fatalf("args=%v", executor.args) }
	if sink.aborted { t.Fatal("successful artifact was aborted") }
}

func TestUnsupportedCapabilityFailsBeforeResolution(t *testing.T) {
	cap := id(1)
	p, err := New(Config{Profiles: map[[32]byte]Profile{cap: profile(cap)}}, fakeResolver{uri: "file:///tmp/in"}, &fakeSink{}, &fakeExec{})
	if err != nil { t.Fatal(err) }
	_, err = p.Process(context.Background(), medianode.Job{CapabilityID: id(4), InputRef: id(3)})
	if !errors.Is(err, medianode.ErrUnsupportedCapability) { t.Fatalf("err=%v", err) }
}

func TestExecutionFailureAbortsDestination(t *testing.T) {
	cap := id(1)
	sink := &fakeSink{destination: "/tmp/out.mp4", ref: id(9)}
	executor := &fakeExec{err: errors.New("boom")}
	p, err := New(Config{Profiles: map[[32]byte]Profile{cap: profile(cap)}}, fakeResolver{uri: "file:///tmp/in.mov"}, sink, executor)
	if err != nil { t.Fatal(err) }
	_, err = p.Process(context.Background(), medianode.Job{CapabilityID: cap, InputRef: id(3)})
	if !errors.Is(err, ErrExecutionFailed) { t.Fatalf("err=%v", err) }
	if !sink.aborted { t.Fatal("failed destination not aborted") }
}

func TestExpiredJobRejectedBeforeExecution(t *testing.T) {
	cap := id(1)
	executor := &fakeExec{}
	sink := &fakeSink{destination: "/tmp/out.mp4", ref: id(9)}
	p, err := New(Config{Profiles: map[[32]byte]Profile{cap: profile(cap)}}, fakeResolver{uri: "file:///tmp/in.mov"}, sink, executor)
	if err != nil { t.Fatal(err) }
	p.now = func() time.Time { return time.Unix(1000, 0) }
	_, err = p.Process(context.Background(), medianode.Job{CapabilityID: cap, InputRef: id(3), Deadline: time.Unix(999, 0)})
	if !errors.Is(err, medianode.ErrDeadlineExceeded) { t.Fatalf("err=%v", err) }
	if executor.binary != "" { t.Fatal("executor called for expired job") }
	if !sink.aborted { t.Fatal("allocated destination not aborted") }
}

func TestInvalidProfileRejected(t *testing.T) {
	cap := id(1)
	bad := profile(cap)
	bad.VideoCodec = "requester-controlled;rm"
	_, err := New(Config{Profiles: map[[32]byte]Profile{cap: bad}}, fakeResolver{}, &fakeSink{}, &fakeExec{})
	if !errors.Is(err, ErrUnsupportedProfile) { t.Fatalf("err=%v", err) }
}

func TestGStreamerCommandUsesDirectArguments(t *testing.T) {
	cap := id(1)
	p := profile(cap)
	p.Engine = EngineGStreamer
	p.AudioCodec = ""
	engine, args, err := command(p, "file:///tmp/input with spaces.mov", "/tmp/out file.mp4")
	if err != nil { t.Fatal(err) }
	if engine != EngineGStreamer { t.Fatalf("engine=%q", engine) }
	foundSource, foundDest := false, false
	for _, arg := range args {
		if arg == "uri=file:///tmp/input with spaces.mov" { foundSource = true }
		if arg == "location=/tmp/out file.mp4" { foundDest = true }
	}
	if !foundSource || !foundDest { t.Fatalf("args=%v", args) }
}

func TestEmptyCommittedReferenceFailsClosed(t *testing.T) {
	cap := id(1)
	sink := &fakeSink{destination: "/tmp/out.mp4"}
	p, err := New(Config{Profiles: map[[32]byte]Profile{cap: profile(cap)}}, fakeResolver{uri: "file:///tmp/in.mov"}, sink, &fakeExec{})
	if err != nil { t.Fatal(err) }
	_, err = p.Process(context.Background(), medianode.Job{CapabilityID: cap, InputRef: id(3)})
	if !errors.Is(err, ErrInvalidOutput) { t.Fatalf("err=%v", err) }
	if !sink.aborted { t.Fatal("uncommitted artifact not aborted") }
}
