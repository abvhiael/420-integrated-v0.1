package crypto

import (
	"crypto/sha256"
	"encoding/binary"

	"github.com/420integrated/420-integrated/consensus/ssz"
)

type Domain [32]byte

func DomainFromName(name string) Domain {
	return sha256.Sum256([]byte(name))
}

var (
	DomainBlockProposal = DomainFromName("420/BLOCK_PROPOSAL")
	DomainAttestation   = DomainFromName("420/ATTESTATION")
	DomainQC            = DomainFromName("420/QC")
)

func SigningRoot(domain Domain, chainID uint64, protocolVersion uint32, objectRoot ssz.Root) ssz.Root {
	var c [32]byte
	binary.LittleEndian.PutUint64(c[:8], chainID)
	var v [32]byte
	binary.LittleEndian.PutUint32(v[:4], protocolVersion)
	return ssz.Container(
		ssz.Root(domain),
		ssz.Root(c),
		ssz.Root(v),
		objectRoot,
	)
}
