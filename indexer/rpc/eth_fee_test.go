package rpc

import "testing"

func TestReceiptFeeWeiKnownVector(t *testing.T) {
	price, fee, err := receiptFeeWei(21000, "0x3b9aca00")
	if err != nil { t.Fatal(err) }
	if price != "1000000000" { t.Fatalf("price=%s", price) }
	if fee != "21000000000000" { t.Fatalf("fee=%s", fee) }
}

func TestReceiptFeeWeiZeroEdge(t *testing.T) {
	price, fee, err := receiptFeeWei(0, "0x0")
	if err != nil { t.Fatal(err) }
	if price != "0" || fee != "0" { t.Fatalf("price=%s fee=%s", price, fee) }
}

func TestReceiptFeeWeiIsOverflowSafe(t *testing.T) {
	price, fee, err := receiptFeeWei(^uint64(0), "0xffffffffffffffffffffffffffffffff")
	if err != nil { t.Fatal(err) }
	if price != "340282366920938463463374607431768211455" { t.Fatalf("price=%s", price) }
	if fee != "6277101735386680763495507056286727952620534092958556749825" { t.Fatalf("fee=%s", fee) }
}

func TestReceiptFeeWeiRejectsMissingPrice(t *testing.T) {
	if _, _, err := receiptFeeWei(21000, ""); err == nil { t.Fatal("expected missing effective gas price to fail") }
}

func TestReceiptFeeWeiRejectsMalformedPrice(t *testing.T) {
	if _, _, err := receiptFeeWei(21000, "0xwat"); err == nil { t.Fatal("expected malformed effective gas price to fail") }
}
