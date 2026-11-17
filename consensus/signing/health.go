package signing

import (
	"bytes"
	"context"
	"fmt"
	"github.com/420integrated/420-integrated/consensus/slashing"
	"net/http"
	"strings"
)

// Check observes the complete local/witness histories under the existing locks.
// It never reserves a duty, advances a generation, reconnects or releases a key.
func (w *Witness) Check(ctx context.Context, protector *slashing.Protector) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.failed != nil {
		return w.failed
	}
	remote, err := w.read(ctx)
	if err != nil {
		return err
	}
	local, err := protector.Snapshot()
	if err != nil {
		return err
	}
	if !bytes.Equal(remote, w.current) || !bytes.Equal(remote, local) {
		return slashing.ErrHistoryUnavailable
	}
	return nil
}
func (c *Client) Health(ctx context.Context) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	if c.failed != nil {
		return c.failed
	}
	if _, err := c.protector.Snapshot(); err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, "GET", strings.TrimSuffix(c.endpoint, "/v1/sign")+"/v1/health", nil)
	if err != nil {
		return fmt.Errorf("signer health unavailable")
	}
	response, err := c.http.Do(request)
	if err != nil {
		return fmt.Errorf("signer health unavailable")
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		return fmt.Errorf("signer health unavailable")
	}
	return nil
}
