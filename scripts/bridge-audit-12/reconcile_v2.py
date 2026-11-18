#!/usr/bin/env python3
"""Re-materialize the existing Swap and Pay compiler identities for the active frozen Genesis configuration.

Retained Swap compiler artifacts stay byte-for-byte intact. Fresh affected-owner
compiler output must reproduce their template, ABI and creation identity. Pay's
existing generator derives its nine runtime identities from that same fresh build.
"""
import argparse, importlib.util, json
import copy
from pathlib import Path

HERE=Path(__file__).resolve().parent
def module(name,path):
    spec=importlib.util.spec_from_file_location(name,path);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
p=module('package12',HERE/'package.py')
s=module('swap6',p.ROOT/'scripts/generate-swap-audit-6-predeploy.py')
pay=module('pay6',p.ROOT/'scripts/generate-420pay-audit-6-deployment.py')
# These three current-main implementations superseded the older Pay package.
# Their exact source identities are reconciled explicitly, never reverted.
CURRENT_PAY_SOURCES={
    'InvoiceRegistry420':'98061a3fed76b4caae040dec1f26ae3de698ecee',
    'PaymentRegistry420':'2c57d344e36995d17154a1553fc7aac24dc0d7d3',
    'RefundManager420':'432705e375bef5c4f1a6b3d336a46e48ec1903f8',
}
def preserve_order(reference,value):
    if isinstance(reference,dict) and isinstance(value,dict):
        return {k:preserve_order(reference.get(k),value[k]) for k in list(reference)+[k for k in value if k not in reference] if k in value}
    if isinstance(reference,list) and isinstance(value,list) and len(reference)==len(value):
        return [preserve_order(a,b) for a,b in zip(reference,value)]
    return value

def derive():
    frozen,drift=p.commitment();assert not drift,'frozen authority drift'
    cfg=frozen['genesisConfigHash'];artifacts={}
    for name,(source,address) in s.DEPLOYMENT_COMPONENTS.items():
        retained=json.loads((s.ARTIFACT_DIR/f'{name}.json').read_text())
        fresh=s.artifact_record(name,source,address,s.compiler_provenance())
        # AST numeric labels and historical config-file provenance do not change
        # compiler bytes. Preserve the original evidence rather than relabel it.
        for field in ['source','sourceBlobSha1','creationBytecodeKeccak256','deployedBytecodeTemplate','deployedBytecodeTemplateKeccak256','immutableReferences','abiSha256']:
            assert fresh[field]==retained[field],(name,field,'compiler evidence changed')
        artifacts[name]=retained
    states={name:s.build_state(name,artifacts[name],address,cfg) for name,(_,address) in s.FROZEN.items()}
    outputs={s.PREDEPLOY_DIR/f'{name}-predeploy-state.json':state for name,state in states.items()}
    outputs[s.PLAN_PATH]=s.update_plan(json.loads(s.PLAN_PATH.read_text()),states,artifacts)
    outputs[s.DEPLOYMENT_PATH]=s.update_deployment(json.loads(s.DEPLOYMENT_PATH.read_text()),states,artifacts)
    package=json.loads(pay.PACKAGE.read_text());original=copy.deepcopy(package);derived=pay.derive()
    # Exact compiler identities must match retained Pay evidence before changing
    # the configuration immutable; no source/template/ABI update is smuggled in.
    old={x['contract']:x for x in package['residents']}
    for rec in derived['residents']:
        if rec['contract'] in CURRENT_PAY_SOURCES:
            assert rec['source_blob_sha1']==CURRENT_PAY_SOURCES[rec['contract']], 'current-main Pay source drift'
            continue
        for field in ['source','source_blob_sha1','runtime_template_hash','creation_bytecode_hash','abi_sha256','runtime_bytes']:
            assert rec[field]==old[rec['contract']][field],(rec['contract'],field,'compiler evidence changed')
    package.update(derived)
    for args in package['constructor_manifest'].values():args['genesis_config_hash']=cfg
    outputs[pay.PACKAGE]=preserve_order(original,package)
    return outputs

def main():
    a=argparse.ArgumentParser();a.add_argument('--write',action='store_true');a.add_argument('--check',action='store_true');args=a.parse_args()
    outputs=derive()
    for path,obj in outputs.items():
        data=json.dumps(obj,indent=2)+'\n' if path==pay.PACKAGE else p.dump(obj)
        if args.write:path.write_text(data)
        if args.check:assert path.read_text()==data,'non-reproducible Genesis resident output: '+str(path)
    print(json.dumps({'pass':True,'swap_fixed_runtimes':4,'pay_runtime_identities':9,'retained_swap_compiler_artifacts_changed':False,'configuration':p.CONFIG_HASH}))
if __name__=='__main__':main()
