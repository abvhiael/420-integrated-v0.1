package livegateway

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var (
	ErrNegotiationFailed = errors.New("420media livegateway: negotiation failed")
	ErrMissingCredential = errors.New("420media livegateway: missing credential")
)

// CredentialResolver resolves opaque local references. Implementations should use a
// keystore/HSM/secret manager; resolved credentials never enter SessionSpec persistence.
type CredentialResolver interface {
	Resolve(ctx context.Context, ref CredentialRef) (string, error)
}

// SDPProvider owns the actual WebRTC peer connection implementation. The live gateway
// only coordinates offer/answer exchange and does not manipulate RTP media frames.
type SDPProvider interface {
	Offer(ctx context.Context, spec SessionSpec) (string, error)
	ApplyAnswer(ctx context.Context, spec SessionSpec, answer string) error
	Close(ctx context.Context, spec SessionSpec) error
}

type HTTPDoer interface {
	Do(req *http.Request) (*http.Response, error)
}

type WebRTCDriver struct {
	client      HTTPDoer
	peers       SDPProvider
	credentials CredentialResolver
}

func NewWebRTCDriver(client HTTPDoer, peers SDPProvider, credentials CredentialResolver) (*WebRTCDriver, error) {
	if client == nil || peers == nil {
		return nil, ErrNegotiationFailed
	}
	return &WebRTCDriver{client: client, peers: peers, credentials: credentials}, nil
}

func (d *WebRTCDriver) Start(ctx context.Context, spec SessionSpec) error {
	if spec.Protocol != ProtocolWHIP && spec.Protocol != ProtocolWHEP {
		return ErrUnsupportedProtocol
	}
	offer, err := d.peers.Offer(ctx, spec)
	if err != nil || strings.TrimSpace(offer) == "" {
		return fmt.Errorf("%w: offer", ErrNegotiationFailed)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, spec.Endpoint, bytes.NewBufferString(offer))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/sdp")
	if spec.CredentialRef != "" {
		if d.credentials == nil {
			return ErrMissingCredential
		}
		token, err := d.credentials.Resolve(ctx, spec.CredentialRef)
		if err != nil || token == "" {
			return ErrMissingCredential
		}
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := d.client.Do(req)
	if err != nil {
		return fmt.Errorf("%w: %v", ErrNegotiationFailed, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("%w: status=%d", ErrNegotiationFailed, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil || len(bytes.TrimSpace(body)) == 0 {
		return fmt.Errorf("%w: answer", ErrNegotiationFailed)
	}
	if err := d.peers.ApplyAnswer(ctx, spec, string(body)); err != nil {
		return fmt.Errorf("%w: %v", ErrNegotiationFailed, err)
	}
	return nil
}

func (d *WebRTCDriver) Stop(ctx context.Context, spec SessionSpec) error {
	return d.peers.Close(ctx, spec)
}

// ProcessExecutor launches transport software directly with argv; it MUST NOT invoke a shell.
type ProcessExecutor interface {
	Start(ctx context.Context, binary string, args []string) error
	Stop(ctx context.Context, sessionID string) error
}

type ProcessDriver struct {
	protocol Protocol
	binary   string
	exec     ProcessExecutor
}

func NewProcessDriver(protocol Protocol, binary string, exec ProcessExecutor) (*ProcessDriver, error) {
	if protocol != ProtocolSRT && protocol != ProtocolRTMP {
		return nil, ErrUnsupportedProtocol
	}
	if binary == "" || exec == nil {
		return nil, ErrInvalidEndpoint
	}
	return &ProcessDriver{protocol: protocol, binary: binary, exec: exec}, nil
}

func (d *ProcessDriver) Start(ctx context.Context, spec SessionSpec) error {
	if spec.Protocol != d.protocol {
		return ErrUnsupportedProtocol
	}
	// Endpoint is one argv element. It is never shell-expanded or concatenated into command text.
	args := []string{"--session", spec.ID, "--direction", string(spec.Direction), "--endpoint", spec.Endpoint}
	if spec.CredentialRef != "" {
		// Process drivers receive only an opaque credential reference. The launched gateway
		// process must resolve it from operator-local secure storage.
		args = append(args, "--credential-ref", string(spec.CredentialRef))
	}
	return d.exec.Start(ctx, d.binary, args)
}

func (d *ProcessDriver) Stop(ctx context.Context, spec SessionSpec) error {
	return d.exec.Stop(ctx, spec.ID)
}
