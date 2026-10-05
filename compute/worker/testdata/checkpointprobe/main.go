package main

import (
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"fmt"
	"io"
	"os"
)

const magic = "CMP420R1"

func main() {
	header := make([]byte, len(magic))
	if _, err := io.ReadFull(os.Stdin, header); err != nil || string(header) != magic {
		fail("invalid resume magic")
	}
	var workSize uint64
	var checkpointSize uint64
	if err := binary.Read(os.Stdin, binary.BigEndian, &workSize); err != nil {
		fail(err.Error())
	}
	if err := binary.Read(os.Stdin, binary.BigEndian, &checkpointSize); err != nil {
		fail(err.Error())
	}
	if workSize == 0 || checkpointSize == 0 || workSize > 64<<20 || checkpointSize > 64<<20 {
		fail("invalid resume sizes")
	}
	work := make([]byte, workSize)
	if _, err := io.ReadFull(os.Stdin, work); err != nil {
		fail(err.Error())
	}
	checkpoint := make([]byte, checkpointSize)
	if _, err := io.ReadFull(os.Stdin, checkpoint); err != nil {
		fail(err.Error())
	}
	var extra [1]byte
	if n, _ := os.Stdin.Read(extra[:]); n != 0 {
		fail("trailing resume bytes")
	}
	workHash := sha256.Sum256(work)
	checkpointHash := sha256.Sum256(checkpoint)
	fmt.Printf("cmp-checkpoint-resume-ok %s %s\n", hex.EncodeToString(workHash[:]), hex.EncodeToString(checkpointHash[:]))
}

func fail(message string) {
	fmt.Fprintln(os.Stderr, "cmp-checkpoint-probe:", message)
	os.Exit(1)
}
