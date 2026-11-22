#!/usr/bin/env python3
"""Apply the 420 consensus-system-call patch to an exact go-ethereum v1.17.5 tree.

Usage:
  python3 apply-420-systemcall.py /path/to/go-ethereum

The script is intentionally anchor-checked. It aborts rather than guessing if the pinned
upstream source does not match the expected v1.17.5 structure.
"""
from __future__ import annotations

import pathlib
import subprocess
import sys

TAG = "v1.17.5"
EXPECTED_COMMIT = "9621c6ad10934a01b5514886fb6fbd87640b6c05"
HERE = pathlib.Path(__file__).resolve().parent
SYSTEMCALL_TEMPLATE = HERE / "systemcall420.go.in"


def replace_once(path: pathlib.Path, old: str, new: str) -> None:
    text = path.read_text()
    if text.count(old) != 1:
        raise SystemExit(f"anchor mismatch in {path}: expected exactly one occurrence")
    path.write_text(text.replace(old, new, 1))


def git(root: pathlib.Path, *args: str) -> str:
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: apply-420-systemcall.py /path/to/go-ethereum")
    root = pathlib.Path(sys.argv[1]).resolve()
    if not (root / "go.mod").exists():
        raise SystemExit("not a go-ethereum source tree")
    if not SYSTEMCALL_TEMPLATE.exists():
        raise SystemExit(f"missing patch template: {SYSTEMCALL_TEMPLATE}")

    try:
        tag = git(root, "describe", "--tags", "--exact-match")
        commit = git(root, "rev-parse", "HEAD")
    except Exception as exc:
        raise SystemExit(f"cannot verify pinned geth source: {exc}")
    if tag != TAG:
        raise SystemExit(f"refusing to patch {tag!r}; expected {TAG}")
    if commit != EXPECTED_COMMIT:
        raise SystemExit(f"refusing to patch commit {commit}; expected {EXPECTED_COMMIT}")
    if git(root, "status", "--porcelain"):
        raise SystemExit("refusing to patch dirty go-ethereum tree")

    pkg = root / "core" / "systemcall420"
    pkg.mkdir(exist_ok=True)
    target = pkg / "systemcall.go"
    if target.exists():
        raise SystemExit(f"already patched: {target}")
    target.write_text(SYSTEMCALL_TEMPLATE.read_text())

    # After an abrupt path-state restart, canonical block records can be ahead
    # of CurrentBlock's available state. That is forward state reconstruction,
    # not an unsigned subtraction into the bounded *backward* reorg path.
    # SetCanonical retains upstream ancestor/state validation and re-executes
    # only batches independently restaged by consensus.

    catalyst = root / "eth" / "catalyst" / "api.go"
    replace_once(
        catalyst,
        '"github.com/ethereum/go-ethereum/core"\n',
        '"github.com/ethereum/go-ethereum/core"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n',
    )
    replace_once(
        catalyst,
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n',
        '\tstack.RegisterAPIs([]rpc.API{\n\t\tnewTestingAPI(backend),\n\t\t{Namespace: "engine420", Service: &SystemCallAPI{eth: backend}, Authenticated: true},\n',
    )
    replace_once(
        catalyst,
        '\treturn nil\n}\n\nconst (\n',
        '\treturn nil\n}\n\n// SystemCallAPI stages committed consensus data but never executes EVM state from RPC context.\ntype SystemCallAPI struct{ eth *eth.Ethereum }\n\nfunc (api *SystemCallAPI) SubmitSystemCallsV1(batch systemcall420.Batch) systemcall420.Status {\n\tif err := systemcall420.Stage(batch); err != nil {\n\t\ts := err.Error()\n\t\treturn systemcall420.Status{Status: "INVALID", BatchRoot: batch.BatchRoot, ValidationError: &s}\n\t}\n\treturn systemcall420.Status{Status: "ACCEPTED", BatchRoot: batch.BatchRoot}\n}\n\n// ReplaceSystemCallsV1 changes staging only above the existing finalized boundary.\nfunc (api *SystemCallAPI) ReplaceSystemCallsV1(batch systemcall420.Batch) systemcall420.Status {\n invalid := func(err error) systemcall420.Status { s := err.Error(); return systemcall420.Status{Status: "INVALID", BatchRoot: batch.BatchRoot, ValidationError: &s} }\n chain := api.eth.BlockChain()\n if !chain.Config().ChainID.IsUint64() || chain.Config().ChainID.Uint64() != uint64(batch.ChainID) { return invalid(systemcall420.ErrContext) }\n if final := chain.CurrentFinalBlock(); final != nil && uint64(batch.ExecutionBlock) <= final.Number.Uint64() { return invalid(systemcall420.ErrContext) }\n if uint64(batch.ExecutionBlock) == 0 || rawdb.ReadCanonicalHash(api.eth.ChainDb(), uint64(batch.ExecutionBlock)-1) != batch.ParentHash { return invalid(systemcall420.ErrContext) }\n if err := systemcall420.Replace(batch); err != nil { return invalid(err) }\n return systemcall420.Status{Status: "ACCEPTED", BatchRoot: batch.BatchRoot}\n}\n\nconst (\n',
    )

    upstream_exchange_capabilities = '''// ExchangeCapabilities returns the current methods provided by this node.\nfunc (api *ConsensusAPI) ExchangeCapabilities(caps []string) []string {\n\tvalueT := reflect.TypeOf(api)\n\n\t// If the CL supports getBlobsV4, we call EnableCell() on the\n\t// blob cache to skip the blob recovery process. This is a\n\t// one-directional toggle, which assumes that once the CL\n\t// supports getBlobsV4, it will not fall back to getBlobsV3\n\t// again.\n\tcellmode := slices.Contains(caps, "engine_getBlobsV4")\n\tapi.eth.BlobCache().SetCellMode(cellmode)\n\n\tourCaps := make([]string, 0, valueT.NumMethod())\n\tfor i := 0; i < valueT.NumMethod(); i++ {\n\t\tname := []rune(valueT.Method(i).Name)\n\t\tif string(name) == "ExchangeCapabilities" {\n\t\t\tcontinue\n\t\t}\n\t\tourCaps = append(ourCaps, "engine_"+string(unicode.ToLower(name[0]))+string(name[1:]))\n\t}\n\treturn ourCaps\n}\n'''
    patched_exchange_capabilities = '''// ExchangeCapabilities returns the current methods provided by this node.\nfunc (api *ConsensusAPI) ExchangeCapabilities(caps []string) []string {\n\tvalueT := reflect.TypeOf(api)\n\n\t// If the CL supports getBlobsV4, we call EnableCell() on the\n\t// blob cache to skip the blob recovery process. This is a\n\t// one-directional toggle, which assumes that once the CL\n\t// supports getBlobsV4, it will not fall back to getBlobsV3\n\t// again.\n\tcellmode := slices.Contains(caps, "engine_getBlobsV4")\n\tapi.eth.BlobCache().SetCellMode(cellmode)\n\n\tourCaps := make([]string, 0, valueT.NumMethod()+1)\n\tfor i := 0; i < valueT.NumMethod(); i++ {\n\t\tname := []rune(valueT.Method(i).Name)\n\t\tif string(name) == "ExchangeCapabilities" {\n\t\t\tcontinue\n\t\t}\n\t\tourCaps = append(ourCaps, "engine_"+string(unicode.ToLower(name[0]))+string(name[1:]))\n\t}\n\tourCaps = append(ourCaps, "engine420_submitSystemCallsV1", "engine420_replaceSystemCallsV1", "engine420_getSystemCallLogsV1")\n\treturn ourCaps\n}\n'''
    replace_once(catalyst, upstream_exchange_capabilities, patched_exchange_capabilities)

    # Geth's JWT-authenticated endpoint filters namespaces through DefaultAuthModules.
    # Merely registering an Authenticated rpc.API is insufficient for a new namespace.
    defaults = root / "node" / "defaults.go"
    replace_once(
        defaults,
        '\tDefaultAuthModules = []string{"eth", "engine"}\n',
        '\tDefaultAuthModules = []string{"eth", "engine", "engine420"}\n',
    )

    state_processor = root / "core" / "state_processor.go"
    replace_once(state_processor, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(
        state_processor,
        '"github.com/ethereum/go-ethereum/core/state"\n',
        '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n\t"github.com/ethereum/go-ethereum/core/tracing"\n',
    )
    replace_once(
        state_processor,
        '\tblockAccessList.Merge(bal)\n\n\t// Finalize the block, applying any consensus engine specific extras\n',
        '\tblockAccessList.Merge(bal)\n\n\tif err := Process420SystemCalls(block.NumberU64(), block.ParentHash(), header.Extra, evm, uint32(len(block.Transactions())+2), blockAccessList); err != nil {\n\t\treturn nil, fmt.Errorf("420 consensus system calls: %w", err)\n\t}\n\n\t// Finalize the block, applying any consensus engine specific extras\n',
    )
    process_fn = r'''
// Process420SystemCalls executes the consensus-staged batch committed by header.extraData.
func Process420SystemCalls(number uint64, parent common.Hash, extra []byte, evm *vm.EVM, blockAccessIndex uint32, blockAccessList *bal.ConstructionBlockAccessList) error {
    batch, ok := systemcall420.Get(number, parent)
    if !ok {
        return systemcall420.ErrNotStaged
    }
    root := systemcall420.Root(batch)
    if len(extra) != 32 || !bytes.Equal(extra, root[:]) {
        return systemcall420.ErrRoot
    }
    for i, c := range batch.Calls {
        input, err := systemcall420.GatewayInput(c)
        if err != nil {
            return err
        }
        gasLimit, gasBudget := systemCallGasBudget(evm)
        to := systemcall420.GatewayAddress
        minted, isReward, err := systemcall420.RewardBackingAmount(c)
        if err != nil { return err }
        // An EVM account can receive involuntary ETH via SELFDESTRUCT even if it
        // lacks a payable receiver. Requiring a zero pre-balance would let that
        // unrelated forced transfer permanently halt consensus. Instead pin the
        // exact pre-existing amount and require its preservation after reward
        // issuance and verified distribution; only minted may be paid this block.
        priorRewardBalance := new(uint256.Int).Set(evm.StateDB.GetBalance(systemcall420.RewardControllerAddress))
        if isReward {
            if _, overflow := new(uint256.Int).AddOverflow(priorRewardBalance, minted); overflow {
                return systemcall420.ErrRewardBacking
            }
            evm.StateDB.AddBalance(systemcall420.RewardControllerAddress,
                minted, tracing.BalanceIncreaseRewardMineBlock)
        }
        msg := &Message{From: params.SystemAddress, GasLimit: gasLimit, GasPrice: uint256.NewInt(0), GasFeeCap: uint256.NewInt(0), GasTipCap: uint256.NewInt(0), To: &to, Data: input}
        evm.SetTxContext(NewEVMTxContext(msg))
        evm.StateDB.Prepare(evm.GetRules(), common.Address{}, common.Address{}, nil, nil, nil)
        evm.StateDB.SetTxContext(common.Hash{}, int(blockAccessIndex-2), blockAccessIndex+uint32(i))
        evm.StateDB.AddAddressToAccessList(to)
        _, _, err = evm.Call(msg.From, *msg.To, msg.Data, gasBudget, common.U2560)
        if evm.StateDB.AccessEvents() != nil {
            evm.StateDB.AccessEvents().Merge(evm.AccessEvents)
        }
        local := evm.StateDB.Finalise(true)
        if err != nil {
            return fmt.Errorf("420 system call sequence %d: %w", uint64(c.Sequence), err)
        }
        if isReward && evm.StateDB.GetBalance(systemcall420.RewardControllerAddress).Cmp(priorRewardBalance) != 0 {
            return systemcall420.ErrRewardBacking
        }
        blockAccessList.Merge(local)
    }
    return nil
}

'''
    replace_once(state_processor, '\nvar depositTopic = common.HexToHash(', '\n' + process_fn + 'var depositTopic = common.HexToHash(')

    # Preserve native EVM event evidence without inventing extra Ethereum
    # transaction receipts or changing the frozen receipt/header commitment.
    blockchain = root / "core" / "blockchain.go"
    replace_once(blockchain, '"github.com/ethereum/go-ethereum/core/state"\n',
                 '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n')
    replace_once(blockchain, '\trawdb.WritePreimages(batch, statedb.Preimages())\n',
                 '\tif err := systemcall420.WriteNativeLogs(batch, block.Hash(), statedb.GetLogs(common.Hash{}, block.NumberU64(), block.Hash(), block.Time())); err != nil { return err }\n\trawdb.WritePreimages(batch, statedb.Preimages())\n')
    native_rpc = r'''
// GetSystemCallLogsV1 returns only imported canonical native logs. A missing
// archive is an error, including pre-upgrade blocks; it is never an empty proof.
func (api *SystemCallAPI) GetSystemCallLogsV1(hash common.Hash) (map[string]interface{}, error) {
 chain:=api.eth.BlockChain()
 header:=chain.GetHeaderByHash(hash)
 if header==nil || rawdb.ReadCanonicalHash(api.eth.ChainDb(),header.Number.Uint64())!=hash {return nil,fmt.Errorf("native log block is not canonical")}
 logs,err:=systemcall420.ReadNativeLogs(api.eth.ChainDb(),hash);if err!=nil{return nil,err}
 for _,entry:=range logs{if entry.BlockNumber!=header.Number.Uint64(){return nil,fmt.Errorf("native log height mismatch")}}
 if rawdb.ReadCanonicalHash(api.eth.ChainDb(),header.Number.Uint64())!=hash{return nil,fmt.Errorf("canonical block changed")}
 return map[string]interface{}{"blockHash":hash,"blockNumber":hexutil.Uint64(header.Number.Uint64()),"batchRoot":common.BytesToHash(header.Extra),"logs":logs},nil
}
'''
    replace_once(catalyst, '\n// SystemCallAPI stages committed consensus data', native_rpc + '\n// SystemCallAPI stages committed consensus data')

    worker = root / "miner" / "worker.go"
    replace_once(worker, 'import (\n\t"context"\n', 'import (\n\t"bytes"\n\t"context"\n')
    replace_once(
        worker,
        '"github.com/ethereum/go-ethereum/core/state"\n',
        '"github.com/ethereum/go-ethereum/core/state"\n\t"github.com/ethereum/go-ethereum/core/systemcall420"\n',
    )
    replace_once(
        worker,
        '\twork.bal.Merge(bal)\n\n\t// Apply the consensus-specific post-transaction changes\n',
        '\twork.bal.Merge(bal)\n\tif err := core.Process420SystemCalls(work.header.Number.Uint64(), work.header.ParentHash, work.header.Extra, work.evm, uint32(work.tcount+2), work.bal); err != nil {\n\t\treturn &newPayloadResult{err: err}\n\t}\n\n\t// Apply the consensus-specific post-transaction changes\n',
    )
    replace_once(
        worker,
        '\tif len(miner.config.ExtraData) != 0 {\n\t\theader.Extra = miner.config.ExtraData\n\t}\n\tif genParams.forceOverrides {\n\t\theader.Extra = genParams.overrideExtraData\n\t}\n',
        '\tif len(miner.config.ExtraData) != 0 {\n\t\theader.Extra = miner.config.ExtraData\n\t}\n\troot420, ok420 := systemcall420.RootFor(number.Uint64(), parent.Hash())\n\tif !ok420 {\n\t\treturn nil, systemcall420.ErrNotStaged\n\t}\n\theader.Extra = root420[:]\n\tif genParams.forceOverrides {\n\t\tif len(genParams.overrideExtraData) != 0 && !bytes.Equal(genParams.overrideExtraData, root420[:]) {\n\t\t\treturn nil, systemcall420.ErrRoot\n\t\t}\n\t\theader.Extra = root420[:]\n\t}\n',
    )

    replace_once(
        catalyst,
        '\t} else {\n\t\tif finalized := api.eth.BlockChain().CurrentFinalBlock(); finalized != nil && block.NumberU64() <= finalized.Number.Uint64() {\n',
        '\t} else if final := api.eth.BlockChain().CurrentFinalBlock(); payloadAttributes != nil && final != nil && final.Hash() == update.HeadBlockHash {\n'
        '\t\t// 420: build a replacement child of the exact finalized parent.\n'
        '\t\t// Keep the current head; payload generation below uses the supplied parent.\n'
        '\t} else if block.NumberU64() > api.eth.BlockChain().CurrentBlock().Number.Uint64() {\n'
        '\t\t// 420: canonical headers survived a crash but path-state was rewound.\n'
        '\t\t// Reconstruct through the normal staged block processor; do not\n'
        '\t\t// underflow the backward-only reorganization depth calculation.\n'
        '\t\tif latestValid, err := api.eth.BlockChain().SetCanonical(block); err != nil {\n'
        '\t\t\treturn engine.ForkChoiceResponse{PayloadStatus: engine.PayloadStatusV1{Status: engine.INVALID, LatestValidHash: &latestValid}}, err\n'
        '\t\t}\n'
        '\t} else {\n\t\tif finalized := api.eth.BlockChain().CurrentFinalBlock(); finalized != nil && block.NumberU64() <= finalized.Number.Uint64() {\n',
    )
    syncmode = root / "eth" / "downloader" / "syncmode.go"
    replace_once(
        syncmode,
        '\t\tif fullBlock.Number.Uint64() == 0 && snapBlock.Number.Uint64() > 0 {\n',
        '\t\t// 420 full-sync crash recovery can leave canonical headers ahead of\n'
        '\t\t// state without ever having started snap sync. Only a recorded snap\n'
        '\t\t// pivot authorizes restoring the snap-sync mode here.\n'
        '\t\tif fullBlock.Number.Uint64() == 0 && snapBlock.Number.Uint64() > 0 && rawdb.ReadLastPivotNumber(disk) != nil {\n',
    )
    subprocess.check_call(["gofmt", "-w", str(target), str(catalyst), str(defaults), str(state_processor), str(blockchain), str(worker), str(syncmode)])
    print("420 system-call patch applied to", root)


if __name__ == "__main__":
    main()
