package p2p

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"net"
	"sync"
	"time"
)

// TCPDevnetTransport is a local-test transport only. It intentionally sits behind the
// same Transport interface as production libp2p so consensus logic is transport-agnostic.
type TCPDevnetTransport struct {
	addr     string
	nodeID   uint64
	conn     net.Conn
	mu       sync.Mutex
	handlers map[Topic][]Handler
}

func NewTCPDevnetTransport(addr string, nodeID uint64) *TCPDevnetTransport {
	return &TCPDevnetTransport{addr: addr, nodeID: nodeID, handlers: map[Topic][]Handler{}}
}

func (t *TCPDevnetTransport) Subscribe(topic Topic, h Handler) {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.handlers[topic] = append(t.handlers[topic], h)
}

func (t *TCPDevnetTransport) Start(ctx context.Context) error {
	var conn net.Conn
	var err error
	for i := 0; i < 50; i++ {
		conn, err = net.DialTimeout("tcp", t.addr, 250*time.Millisecond)
		if err == nil {
			break
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(50 * time.Millisecond):
		}
	}
	if err != nil {
		return err
	}
	t.conn = conn
	if err := json.NewEncoder(conn).Encode(map[string]any{"type": "hello", "node_id": t.nodeID}); err != nil {
		return err
	}
	go t.readLoop(ctx)
	return nil
}

func (t *TCPDevnetTransport) readLoop(ctx context.Context) {
	sc := bufio.NewScanner(t.conn)
	sc.Buffer(make([]byte, 1024), 4<<20)
	for sc.Scan() {
		var env Envelope
		if json.Unmarshal(sc.Bytes(), &env) != nil {
			continue
		}
		t.mu.Lock()
		hs := append([]Handler(nil), t.handlers[env.Topic]...)
		t.mu.Unlock()
		for _, h := range hs {
			go h(ctx, env)
		}
	}
}

func (t *TCPDevnetTransport) Publish(ctx context.Context, env Envelope) error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.conn == nil {
		return fmt.Errorf("transport not started")
	}
	env.From = t.nodeID
	return json.NewEncoder(t.conn).Encode(env)
}

func (t *TCPDevnetTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.conn != nil {
		return t.conn.Close()
	}
	return nil
}
