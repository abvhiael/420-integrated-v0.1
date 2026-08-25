package main

import (
	"bufio"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"os"
	"strconv"
	"strings"
	"sync"
)

type client struct {
	id uint64
	c  net.Conn
	mu sync.Mutex
}

var clientsMu sync.Mutex
var clients = map[uint64]*client{}
var partition map[uint64]int

func parsePartition(spec string) (map[uint64]int, error) {
	if spec == "" {
		return nil, nil
	}
	out := map[uint64]int{}
	groups := strings.Split(spec, "|")
	for gi, g := range groups {
		for _, part := range strings.Split(g, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				continue
			}
			if strings.Contains(part, "-") {
				ab := strings.SplitN(part, "-", 2)
				a, err := strconv.ParseUint(ab[0], 10, 64)
				if err != nil {
					return nil, err
				}
				b, err := strconv.ParseUint(ab[1], 10, 64)
				if err != nil {
					return nil, err
				}
				if b < a {
					return nil, fmt.Errorf("bad range %s", part)
				}
				for id := a; id <= b; id++ {
					out[id] = gi
				}
			} else {
				id, err := strconv.ParseUint(part, 10, 64)
				if err != nil {
					return nil, err
				}
				out[id] = gi
			}
		}
	}
	return out, nil
}

func samePartition(a, b uint64) bool {
	if partition == nil {
		return true
	}
	ga, oka := partition[a]
	gb, okb := partition[b]
	return oka && okb && ga == gb
}

func main() {
	addr := flag.String("listen", "127.0.0.1:9420", "listen address")
	part := flag.String("partition", "", "static node-id groups, e.g. 1000-1007|1008-1014")
	flag.Parse()
	var err error
	partition, err = parsePartition(*part)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	ln, err := net.Listen("tcp", *addr)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	fmt.Printf("devnet-bus listening %s partition=%q\n", *addr, *part)
	for {
		c, err := ln.Accept()
		if err != nil {
			continue
		}
		go handle(c)
	}
}
func handle(c net.Conn) {
	sc := bufio.NewScanner(c)
	sc.Buffer(make([]byte, 1024), 4<<20)
	if !sc.Scan() {
		c.Close()
		return
	}
	var hello struct {
		Type   string `json:"type"`
		NodeID uint64 `json:"node_id"`
	}
	if json.Unmarshal(sc.Bytes(), &hello) != nil || hello.Type != "hello" {
		c.Close()
		return
	}
	cl := &client{id: hello.NodeID, c: c}
	clientsMu.Lock()
	clients[hello.NodeID] = cl
	clientsMu.Unlock()
	defer func() { clientsMu.Lock(); delete(clients, hello.NodeID); clientsMu.Unlock(); c.Close() }()
	for sc.Scan() {
		raw := append([]byte(nil), sc.Bytes()...)
		clientsMu.Lock()
		snapshot := make([]*client, 0, len(clients))
		for _, peer := range clients {
			if samePartition(hello.NodeID, peer.id) {
				snapshot = append(snapshot, peer)
			}
		}
		clientsMu.Unlock()
		for _, peer := range snapshot {
			peer.mu.Lock()
			_, _ = peer.c.Write(raw)
			_, _ = peer.c.Write([]byte("\n"))
			peer.mu.Unlock()
		}
	}
}
