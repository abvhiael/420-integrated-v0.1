package finality

import (
	"encoding/hex"

	eng "github.com/420integrated/420-integrated/consensus/engine"
	ctypes "github.com/420integrated/420-integrated/consensus/types"
)

func hash32(root ctypes.Root) eng.Hash32 {
	return eng.Hash32("0x" + hex.EncodeToString(root[:]))
}

func EngineForkchoice(s Status) eng.ForkchoiceStateV1 {
	return eng.ForkchoiceStateV1{
		HeadBlockHash:      hash32(s.Head.Root),
		SafeBlockHash:      hash32(s.Safe.Root),
		FinalizedBlockHash: hash32(s.Finalized.Root),
	}
}
