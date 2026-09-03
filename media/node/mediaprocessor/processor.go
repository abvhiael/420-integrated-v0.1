package mediaprocessor

import (
	"context"
	"errors"
	"fmt"
	"time"

	medianode "github.com/420integrated/420-integrated/media/node"
)

type Engine string

const (
	EngineFFmpeg     Engine = "ffmpeg"
	EngineGStreamer Engine = "gstreamer"
)

type Mode string

const (
	ModeTranscode Mode = "transcode"
	ModeRecord    Mode = "record"
)

var (
	ErrUnsupportedProfile = errors.New("420media processor: unsupported profile")
	ErrInvalidInput       = errors.New("420media processor: invalid input")
	ErrInvalidOutput      = errors.New("420media processor: invalid output")
	ErrExecutionFailed    = errors.New("420media processor: execution failed")
)

// Profile is operator-controlled static configuration, never requester-supplied command text.
// CapabilityID is the exact MediaCapabilityRegistry420 identifier advertised by the operator.
type Profile struct {
	CapabilityID [32]byte
	Engine       Engine
	Mode         Mode
	VideoCodec   string
	AudioCodec   string
	Container    string
	Width        int
	Height       int
	VideoBitrate string
	AudioBitrate string
}

// Resolver turns an opaque on-chain inputRef into an operator-local source URI/path.
// Stream secrets and raw media remain outside chain-facing job state.
type Resolver interface {
	ResolveInput(ctx context.Context, inputRef [32]byte) (string, error)
}

// Sink allocates the local/remote destination before processing and commits the completed
// artifact to an opaque 32-byte reference suitable for MediaJobMarket420.commitResult.
type Sink interface {
	Allocate(ctx context.Context, job medianode.Job, profile Profile) (string, error)
	Commit(ctx context.Context, destination string) ([32]byte, error)
	Abort(ctx context.Context, destination string) error
}

// Executor executes a binary directly with argv. Implementations MUST NOT invoke a shell.
type Executor interface {
	Run(ctx context.Context, binary string, args []string) error
}

type Config struct {
	FFmpegBinary    string
	GStreamerBinary string
	MaxRuntime      time.Duration
	Profiles        map[[32]byte]Profile
}

type Processor struct {
	cfg      Config
	resolver Resolver
	sink     Sink
	exec     Executor
	now      func() time.Time
}

func New(cfg Config, resolver Resolver, sink Sink, executor Executor) (*Processor, error) {
	if resolver == nil || sink == nil || executor == nil {
		return nil, errors.New("420media processor: missing dependency")
	}
	if cfg.FFmpegBinary == "" {
		cfg.FFmpegBinary = "ffmpeg"
	}
	if cfg.GStreamerBinary == "" {
		cfg.GStreamerBinary = "gst-launch-1.0"
	}
	if cfg.MaxRuntime <= 0 {
		cfg.MaxRuntime = 6 * time.Hour
	}
	if len(cfg.Profiles) == 0 {
		return nil, ErrUnsupportedProfile
	}
	for id, profile := range cfg.Profiles {
		if id == ([32]byte{}) || profile.CapabilityID != id || !validProfile(profile) {
			return nil, ErrUnsupportedProfile
		}
	}
	return &Processor{cfg: cfg, resolver: resolver, sink: sink, exec: executor, now: time.Now}, nil
}

func (p *Processor) Process(ctx context.Context, job medianode.Job) (medianode.Result, error) {
	profile, ok := p.cfg.Profiles[job.CapabilityID]
	if !ok {
		return medianode.Result{}, medianode.ErrUnsupportedCapability
	}
	source, err := p.resolver.ResolveInput(ctx, job.InputRef)
	if err != nil || source == "" {
		return medianode.Result{}, fmt.Errorf("%w: %v", ErrInvalidInput, err)
	}
	destination, err := p.sink.Allocate(ctx, job, profile)
	if err != nil || destination == "" {
		return medianode.Result{}, fmt.Errorf("%w: %v", ErrInvalidOutput, err)
	}
	committed := false
	defer func() {
		if !committed {
			_ = p.sink.Abort(context.Background(), destination)
		}
	}()

	runFor := p.cfg.MaxRuntime
	if !job.Deadline.IsZero() {
		remaining := job.Deadline.Sub(p.now())
		if remaining <= 0 {
			return medianode.Result{}, medianode.ErrDeadlineExceeded
		}
		if remaining < runFor {
			runFor = remaining
		}
	}
	runCtx, cancel := context.WithTimeout(ctx, runFor)
	defer cancel()

	engine, args, err := command(profile, source, destination)
	if err != nil {
		return medianode.Result{}, err
	}
	started := p.now()
	if err := p.exec.Run(runCtx, binaryFor(p.cfg, engine), args); err != nil {
		return medianode.Result{}, fmt.Errorf("%w: %v", ErrExecutionFailed, err)
	}
	finished := p.now()
	outputRef, err := p.sink.Commit(ctx, destination)
	if err != nil || outputRef == ([32]byte{}) {
		return medianode.Result{}, fmt.Errorf("%w: %v", ErrInvalidOutput, err)
	}
	committed = true
	return medianode.Result{OutputRef: outputRef, StartedAt: started, FinishedAt: finished}, nil
}

func binaryFor(cfg Config, engine Engine) string {
	if engine == EngineGStreamer {
		return cfg.GStreamerBinary
	}
	return cfg.FFmpegBinary
}

func validProfile(p Profile) bool {
	if p.Engine != EngineFFmpeg && p.Engine != EngineGStreamer {
		return false
	}
	if p.Mode != ModeTranscode && p.Mode != ModeRecord {
		return false
	}
	if p.Width < 0 || p.Height < 0 || p.Width > 7680 || p.Height > 4320 {
		return false
	}
	if (p.Width == 0) != (p.Height == 0) {
		return false
	}
	return allowedVideo(p.VideoCodec) && allowedAudio(p.AudioCodec) && allowedContainer(p.Container)
}

func allowedVideo(v string) bool {
	switch v {
	case "copy", "h264", "h265", "av1", "vp9", "":
		return true
	default:
		return false
	}
}

func allowedAudio(v string) bool {
	switch v {
	case "copy", "aac", "opus", "":
		return true
	default:
		return false
	}
}

func allowedContainer(v string) bool {
	switch v {
	case "mp4", "matroska", "mpegts", "webm":
		return true
	default:
		return false
	}
}

func command(p Profile, source, destination string) (Engine, []string, error) {
	if !validProfile(p) || source == "" || destination == "" {
		return "", nil, ErrUnsupportedProfile
	}
	if p.Engine == EngineFFmpeg {
		args := []string{"-nostdin", "-hide_banner", "-loglevel", "warning", "-y", "-i", source}
		if p.VideoCodec != "" {
			args = append(args, "-c:v", ffmpegVideo(p.VideoCodec))
		}
		if p.AudioCodec != "" {
			args = append(args, "-c:a", ffmpegAudio(p.AudioCodec))
		}
		if p.Width > 0 {
			args = append(args, "-vf", fmt.Sprintf("scale=%d:%d", p.Width, p.Height))
		}
		if p.VideoBitrate != "" {
			args = append(args, "-b:v", p.VideoBitrate)
		}
		if p.AudioBitrate != "" {
			args = append(args, "-b:a", p.AudioBitrate)
		}
		args = append(args, "-f", p.Container, destination)
		return EngineFFmpeg, args, nil
	}

	// Initial GStreamer support is intentionally video-only and profile-driven. Audio
	// graph composition and live tees are introduced with the gateway increment.
	if p.AudioCodec != "" && p.AudioCodec != "copy" {
		return "", nil, ErrUnsupportedProfile
	}
	args := []string{"uridecodebin", "uri=" + source, "!", "videoconvert"}
	if p.Width > 0 {
		args = append(args, "!", "videoscale", "!", fmt.Sprintf("video/x-raw,width=%d,height=%d", p.Width, p.Height))
	}
	args = append(args, "!", gstVideo(p.VideoCodec), "!", gstMux(p.Container), "!", "filesink", "location="+destination)
	return EngineGStreamer, args, nil
}

func ffmpegVideo(v string) string {
	switch v {
	case "h264":
		return "libx264"
	case "h265":
		return "libx265"
	case "av1":
		return "libaom-av1"
	case "vp9":
		return "libvpx-vp9"
	default:
		return v
	}
}

func ffmpegAudio(v string) string {
	if v == "opus" {
		return "libopus"
	}
	return v
}

func gstVideo(v string) string {
	switch v {
	case "h264":
		return "x264enc"
	case "h265":
		return "x265enc"
	case "av1":
		return "av1enc"
	case "vp9":
		return "vp9enc"
	case "copy", "":
		return "identity"
	default:
		return "identity"
	}
}

func gstMux(v string) string {
	switch v {
	case "mp4":
		return "mp4mux"
	case "matroska":
		return "matroskamux"
	case "mpegts":
		return "mpegtsmux"
	case "webm":
		return "webmmux"
	default:
		return "identity"
	}
}

var _ medianode.Processor = (*Processor)(nil)
