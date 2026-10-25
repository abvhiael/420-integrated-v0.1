"""Diagnostic execution only; intentionally cannot issue qualification evidence."""
import argparse,json,os,socket,subprocess,sys,time,urllib.request
from uuid import uuid4
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'clients/420bet-fantasy'))
from formats.funded_flow import FundedFormats


def main():
    p=argparse.ArgumentParser();p.add_argument('--anvil',required=True);p.add_argument('--build',required=True);p.add_argument('--output',required=True);a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    rpc=f'http://127.0.0.1:{port}';log=(out/'anvil.log').open('w')
    node=subprocess.Popen([a.anvil,'--host','127.0.0.1','--port',str(port),'--chain-id','31337','--silent'],stdout=log,stderr=log,**({'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}))
    try:
        for _ in range(100):
            try:urllib.request.urlopen(urllib.request.Request(rpc,data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',headers={'Content-Type':'application/json'}),timeout=1);break
            except Exception:time.sleep(.1)
        f=FundedFormats(rpc,Path(a.build).resolve(),ROOT.parent/'approved-qualification-private'/uuid4().hex,'wrapped-native').setup_formats()
        print('Canonical setup complete',flush=True)
        cases=[('salary',1,'multi',2,2,None),('captain',2,'single',2,2,None),('peer-two',3,'multi',2,2,None),('peer-three',3,'multi',3,3,None),('house-two',4,'multi',1,2,[0,2]),('house-three',4,'multi',1,3,[0,4,2]),('same-game-peer',3,'single',2,3,[0,2,4]),('same-game-house',4,'single',1,3,[0,2,4])]
        for label,kind,slate,users,size,indices in cases:
            f.make_case(label,kind,slate,users=users,card_size=size,indices=indices);print('Funded '+label,flush=True)
        f.make_case('peer-partial-void',3,'multi',users=3,card_size=3,user_indices=[[0,1,2],[2,3,4],[2,3,4]],void_aids=[1,2])
        f.make_case('house-refund-below-two',4,'multi',users=1,card_size=3,void_aids=[1,3])
        f.make_case('house-losing-card',4,'multi',users=1,card_size=2)
        f.make_case('free-launcher-prize',3,'multi',users=2,stake=0,prize=101,card_size=2)
        f.make_case('whole-token-salary',1,'multi',users=2,stake=10**18)
        f.make_case('whole-token-house',4,'multi',users=1,stake=10**18,indices=[0,2])
        for label,kind,verdict in [('peer-denied',3,'denied'),('peer-upheld',3,'upheld'),('peer-unresolved',3,'timeout'),('peer-delegated',3,'delegated'),('house-upheld',4,'upheld'),('house-unresolved',4,'timeout')]:
            c=f.make_case(label,kind,'multi',users=2 if kind==3 else 1,card_size=2,user_indices=[[0,1],[0,2]] if kind==3 else None);c['dispute']=verdict
        c=f.make_case('house-partially-affected',4,'multi',users=2,card_size=2,user_indices=[[0,1],[0,2]]);c['dispute']='upheld'
        f.resolve();print('Revealed and resolved',flush=True)
        for c in f.cases:f.score_case(c);print('Scored '+c['label'],flush=True)
        f.exercise_disputes();print('Real upheld/denied/delegated/timeout dispute paths complete',flush=True)
        f.finish();f.export_execution(out);(out/'diagnostic.json').write_text(json.dumps({'diagnosticOnly':True,'outcomes':f.outcomes,'expectedRejections':f.rejections},indent=2)+'\n',encoding='utf-8');print('Actual funded diagnostic flows complete; no certificate',flush=True)
    finally:node.terminate();node.wait(timeout=15);log.close()


if __name__=='__main__':main()
