package decoder

import (
	"errors"
	"testing"
)

type fakeDecoder struct{ version string }
func (f fakeDecoder) Version() string { return f.version }
func (f fakeDecoder) Decode(string, []string, string) (any, error) { return "ok", nil }

func TestHistoricalDecoderVersionsRemainDistinct(t *testing.T) {
	r := NewRegistry()
	r.Register("420/service/pay", "v1", fakeDecoder{version: "v1"})
	r.Register("420/service/pay", "v2", fakeDecoder{version: "v2"})

	d1, err := r.Resolve("420/service/pay", "v1")
	if err != nil || d1.Version() != "v1" { t.Fatal("v1 decoder missing") }
	d2, err := r.Resolve("420/service/pay", "v2")
	if err != nil || d2.Version() != "v2" { t.Fatal("v2 decoder missing") }
	if _, err := r.Resolve("420/service/pay", "v3"); !errors.Is(err, ErrDecoderNotFound) {
		t.Fatal("unknown versions must fail closed")
	}
}
