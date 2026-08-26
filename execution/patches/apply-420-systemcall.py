#!/usr/bin/env python3
"""Apply the 420 consensus-system-call patch to an exact go-ethereum v1.17.5 tree.

Usage:
  python3 apply-420-systemcall.py /path/to/go-ethereum

The script is intentionally anchor-checked. It aborts rather than guessing if the pinned
upstream source does not match the expected v1.17.5 structure.
"""
from __future__ import annotations
import pathlib, subprocess, sys

TAG = "v1.17.5"

SYSTEMCALL_GO = r'''package systemcall420

import (
    "bytes"
    "crypto/sha256"
    "encoding/binary"
    "errors"
    "fmt"
    "math/big"
    "sync"

    "github.com/ethereum/go-ethereum/accounts/abi"
    "github.com/ethereum/go-ethereum/common"
    "github.com/ethereum/go-ethereum/common/hexutil"
    "github.com/ethereum/go-ethereum/crypto"
)

const BatchDomain = "420/CONSENSUS_SYSTEM_CALL_BATCH/V1"

var GatewayAddress = common.HexToAddress("0x000000000000000000000000000000000000043c")

var (
    ErrRoot = errors.New("420 system-call batch root mismatch")
    ErrSequence = errors.New("420 system-call sequence invalid")
    ErrContext = errors.New("420 system-call context mismatch")
    ErrNotStaged = errors.New("420 system-call batch not staged")
    ErrDuplicate = errors.New("420 system-call batch already staged with different root")
)

type Call struct {
    Sequence hexutil.Uint64 `json:"sequence"`
    ExecutionBlock hexutil.Uint64 `json:"executionBlock"`
    ParentHash common.Hash `json:"parentHash"`
    ChainID hexutil.Uint64 `json:"chainId"`
    Action string `json:"action"`
    Target common.Address `json:"target"`
    Payload hexutil.Bytes `json:"payload"`
}

type Batch struct {
    ExecutionBlock hexutil.Uint64 `json:"executionBlock"`
    ParentHash common.Hash `json:"parentHash"`
    ChainID hexutil.Uint64 `json:"chainId"`
    BatchRoot common.Hash `json:"batchRoot"`
    Calls []Call `json:"calls"`
}

type Status struct {
    Status string `json:"status"`
    BatchRoot common.Hash `json:"batchRoot"`
    ValidationError *string `json:"validationError,omitempty"`
}

type key struct { Number uint64; Parent common.Hash }
var staged = struct { sync.RWMutex; m map[key]Batch }{m: make(map[key]Batch)}

func Stage(batch Batch) error {
    if err := Validate(batch); err != nil { return err }
    want := Root(batch)
    if batch.BatchRoot != want { return fmt.Errorf("%w: supplied=%s computed=%s", ErrRoot, batch.BatchRoot, want) }
    k := key{Number:uint64(batch.ExecutionBlock), Parent:batch.ParentHash}
    staged.Lock(); defer staged.Unlock()
    if old, ok := staged.m[k]; ok && old.BatchRoot != batch.BatchRoot { return ErrDuplicate }
    staged.m[k] = clone(batch)
    return nil
}

func Get(number uint64, parent common.Hash) (Batch, bool) {
    staged.RLock(); defer staged.RUnlock()
    b, ok := staged.m[key{Number:number, Parent:parent}]
    return clone(b), ok
}
func RootFor(number uint64, parent common.Hash) (common.Hash, bool) {
    b, ok := Get(number,parent); if !ok { return common.Hash{}, false }; return b.BatchRoot, true
}

func Validate(batch Batch) error {
    if batch.ParentHash == (common.Hash{}) || uint64(batch.ChainID) == 0 { return ErrContext }
    if len(batch.Calls) == 0 { return nil }
    want := uint64(batch.Calls[0].Sequence)
    if want == 0 { return ErrSequence }
    for i := range batch.Calls {
        c := batch.Calls[i]
        if uint64(c.Sequence) != want { return ErrSequence }
        if c.ExecutionBlock != batch.ExecutionBlock || c.ParentHash != batch.ParentHash || c.ChainID != batch.ChainID { return ErrContext }
        want++
    }
    return nil
}

func Root(batch Batch) common.Hash {
    h := sha256.New()
    writeBytes(h, []byte(BatchDomain)); writeU64(h,uint64(batch.ChainID)); writeU64(h,uint64(batch.ExecutionBlock)); h.Write(batch.ParentHash[:]); writeU64(h,uint64(len(batch.Calls)))
    for i := range batch.Calls { writeCall(h,batch.Calls[i]) }
    return common.BytesToHash(h.Sum(nil))
}
func writeCall(w interface{Write([]byte)(int,error)}, c Call) {
    writeU64(w,uint64(c.Sequence)); writeU64(w,uint64(c.ExecutionBlock)); w.Write(c.ParentHash[:]); writeU64(w,uint64(c.ChainID)); writeBytes(w,[]byte(c.Action)); w.Write(c.Target[:]); writeBytes(w,c.Payload)
}
func writeBytes(w interface{Write([]byte)(int,error)}, b []byte) { writeU64(w,uint64(len(b))); w.Write(b) }
func writeU64(w interface{Write([]byte)(int,error)}, v uint64) { var b [8]byte; binary.BigEndian.PutUint64(b[:],v); w.Write(b[:]) }
func clone(b Batch) Batch { out:=b; out.Calls=make([]Call,len(b.Calls)); copy(out.Calls,b.Calls); for i:=range out.Calls { out.Calls[i].Payload=bytes.Clone(b.Calls[i].Payload) }; return out }

var gatewayABI = mustABI(`[{"type":"function","name":"apply","inputs":[{"name":"sequence","type":"uint64"},{"name":"executionBlock","type":"uint64"},{"name":"parentHash","type":"bytes32"},{"name":"chainId","type":"uint256"},{"name":"action","type":"bytes32"},{"name":"target","type":"address"},{"name":"payload","type":"bytes"}],"outputs":[{"name":"callHash","type":"bytes32"}]}]`)
func mustABI(s string) abi.ABI { a,err:=abi.JSON(bytes.NewBufferString(s)); if err!=nil { panic(err) }; return a }
func GatewayInput(c Call) ([]byte,error) {
    action:=crypto.Keccak256Hash([]byte(c.Action))
    return gatewayABI.Pack("apply",uint64(c.Sequence),uint64(c.ExecutionBlock),c.ParentHash,new(big.Int).SetUint64(uint64(c.ChainID)),action,c.Target,[]byte(c.Payload))
}
'''


def replace_once(path: pathlib.Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"anchor mismatch in {path}: expected exactly one occurrence")
    path.write_text(text.replace(old, new, 1))


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: apply-420-systemcall.py /path/to/go-ethereum")
    root = pathlib.Path(sys.argv[1]).resolve()
    if not (root / "go.mod").exists():
        raise SystemExit("not a go-ethereum source tree")
    try:
        tag = subprocess.check_output(["git","-C",str(root),"describe","--tags","--exact-match"], text=True).strip()
    except Exception as exc:
        raise SystemExit(f"cannot verify pinned geth tag: {exc}")
    if tag != TAG:
        raise SystemExit(f"refusing to patch {tag!r}; expected {TAG}")

    pkg = root / "core" / "systemcall420"
    pkg.mkdir(exist_ok=True)
    target = pkg / "systemcall.go"
    if target.exists():
        raise SystemExit(f"already patched: {target}")
    target.write_text(SYSTEMCALL_GO)

    catalyst = root / "eth" / "catalyst" / "api.go"
    replace_once(catalyst,
        '"github.com/ethereum/go-ethereum/core"\n',
        '"github.com/ethereum/go-ethereum/core"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n')
    replace_once(catalyst,
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n',
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n\t\t{Namespace: "engine420", Service: &SystemCallAPI{}, Authenticated: true},\n')
    replace_once(catalyst,
        '\treturn nil\n}\n\nconst (\n',
        '\treturn nil\n}\n\n// SystemCallAPI stages committed consensus data but never executes EVM state from RPC context.\ntype SystemCallAPI struct{}\nfunc (api *SystemCallAPI) SubmitSystemCallsV1(batch systemcall420.Batch) systemcall420.Status {\n\tif err := systemcall420.Stage(batch); err != nil { s:=err.Error(); return systemcall420.Status{Status:"INVALID",BatchRoot:batch.BatchRoot,ValidationError:&s} }\n\treturn systemcall420.Status{Status:"ACCEPTED",BatchRoot:batch.BatchRoot}\n}\n\nconst (\n')

    sp = root / "core" / "state_processor.go"
    replace_once(sp, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(sp, '"github.com/ethereum/go-ethereum/core/state"\n', '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n')
    replace_once(sp,
        '\tblockAccessList.Merge(bal)\n\t// Finalize the block, applying any consensus engine specific extras\n',
        '\tblockAccessList.Merge(bal)\n\tif err := Process420SystemCalls(block.NumberU64(), block.ParentHash(), header.Extra, evm, uint32(len(block.Transactions())+2), blockAccessList); err != nil { return nil, fmt.Errorf("420 consensus system calls: %w", err) }\n\t// Finalize the block, applying any consensus engine specific extras\n')
    process_fn = r'''
// Process420SystemCalls executes the consensus-staged batch committed by header.extraData.
func Process420SystemCalls(number uint64, parent common.Hash, extra []byte, evm *vm.EVM, blockAccessIndex uint32, blockAccessList *bal.ConstructionBlockAccessList) error {
    batch,ok:=systemcall420.Get(number,parent); if !ok { return systemcall420.ErrNotStaged }
    root:=systemcall420.Root(batch); if len(extra)!=32 || !bytes.Equal(extra,root[:]) { return systemcall420.ErrRoot }
    for i,c:=range batch.Calls {
        input,err:=systemcall420.GatewayInput(c); if err!=nil { return err }
        gasLimit,gasBudget:=systemCallGasBudget(evm); to:=systemcall420.GatewayAddress
        msg:=&Message{From:params.SystemAddress,GasLimit:gasLimit,GasPrice:uint256.NewInt(0),GasFeeCap:uint256.NewInt(0),GasTipCap:uint256.NewInt(0),To:&to,Data:input}
        evm.SetTxContext(NewEVMTxContext(msg)); evm.StateDB.Prepare(evm.GetRules(),common.Address{},common.Address{},nil,nil,nil); evm.StateDB.SetTxContext(common.Hash{},0,blockAccessIndex+uint32(i)); evm.StateDB.AddAddressToAccessList(to)
        _,_,err=evm.Call(msg.From,*msg.To,msg.Data,gasBudget,common.U2560)
        if evm.StateDB.AccessEvents()!=nil { evm.StateDB.AccessEvents().Merge(evm.AccessEvents) }
        local:=evm.StateDB.Finalise(true); if err!=nil { return fmt.Errorf("420 system call sequence %d: %w",uint64(c.Sequence),err) }; blockAccessList.Merge(local)
    }
    return nil
}

'''
    replace_once(sp, '\nvar depositTopic = common.HexToHash(', '\n' + process_fn + 'var depositTopic = common.HexToHash(')

    worker = root / "miner" / "worker.go"
    replace_once(worker, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(worker, '"github.com/ethereum/go-ethereum/core/state"\n', '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n')
    replace_once(worker,
        '\twork.bal.Merge(bal)\n\t// Apply the consensus-specific post-transaction changes\n',
        '\twork.bal.Merge(bal)\n\tif err := core.Process420SystemCalls(work.header.Number.Uint64(),work.header.ParentHash,work.header.Extra,work.evm,uint32(work.tcount+2),work.bal); err != nil { return &newPayloadResult{err:err} }\n\t// Apply the consensus-specific post-transaction changes\n')
    replace_once(worker,
        '\tif len(miner.config.ExtraData) != 0 {\n\t\theader.Extra = miner.config.ExtraData\n\t}\n\tif genParams.forceOverrides {\n\t\theader.Extra = genParams.overrideExtraData\n\t}\n',
        '\tif len(miner.config.ExtraData) != 0 { header.Extra = miner.config.ExtraData }\n\troot420,ok420:=systemcall420.RootFor(number.Uint64(),parent.Hash()); if !ok420 { return nil,systemcall420.ErrNotStaged }; header.Extra=root420[:]\n\tif genParams.forceOverrides { if len(genParams.overrideExtraData)!=0 && !bytes.Equal(genParams.overrideExtraData,root420[:]) { return nil,systemcall420.ErrRoot }; header.Extra=root420[:] }\n')

    subprocess.check_call(["gofmt","-w",str(target),str(catalyst),str(sp),str(worker)])
    print("420 system-call patch applied to", root)

if __name__ == "__main__":
    main()
