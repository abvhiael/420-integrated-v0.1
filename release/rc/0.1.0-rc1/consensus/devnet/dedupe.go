package devnet

import "sync"

type Dedupe struct {
	mu   sync.Mutex
	seen map[string]bool
}

func NewDedupe() *Dedupe { return &Dedupe{seen: map[string]bool{}} }
func (d *Dedupe) First(key string) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	if d.seen[key] {
		return false
	}
	d.seen[key] = true
	return true
}
