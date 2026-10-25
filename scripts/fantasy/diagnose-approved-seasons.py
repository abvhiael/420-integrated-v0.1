"""Actual funded season diagnostic; no certificate or acceptance marker."""
import argparse,json,os,socket,subprocess,sys,time,urllib.request
from pathlib import Path
from uuid import uuid4
ROOT=Path(__file__).resolve().parents[2];sys.path.insert(0,str(ROOT/'clients/420bet-fantasy'))
from formats.season_flow import FundedSeasons


def main():
    p=argparse.ArgumentParser();p.add_argument('--anvil',required=True);p.add_argument('--build',required=True);p.add_argument('--output',required=True);p.add_argument('--all-modes',action='store_true');a=p.parse_args()
    out=Path(a.output).resolve();out.mkdir(parents=True,exist_ok=True)
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    rpc=f'http://127.0.0.1:{port}';log=(out/'anvil.log').open('w');node=subprocess.Popen([a.anvil,'--host','127.0.0.1','--port',str(port),'--chain-id','31337','--silent'],stdout=log,stderr=log,**({'creationflags':subprocess.CREATE_NO_WINDOW} if os.name=='nt' else {}))
    try:
        for _ in range(100):
            try:urllib.request.urlopen(urllib.request.Request(rpc,data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}',headers={'Content-Type':'application/json'}),timeout=1);break
            except Exception:time.sleep(.1)
        f=FundedSeasons(rpc,Path(a.build).resolve(),ROOT.parent/'approved-qualification-private'/uuid4().hex,'wrapped-native').setup_seasons();print('Canonical season setup',flush=True)
        cases=[f.make_season('mode-'+str(mode),mode) for mode in (range(4) if a.all_modes else [0])]
        free=void=pending=withheld=underfilled=official=early=late_queue=inventory=None
        if a.all_modes:
            early=f.make_season('early-start-lineup',0);cases.append(early)
            late_queue=f.make_season('early-start-waiver-intent',0);cases.append(late_queue)
            free=f.make_season('free-launcher-season',0,stake=0,prize=101);cases.append(free)
            void=f.make_season('all-weeks-void',0);void['allVoid']=True;cases.append(void)
            pending=f.make_season('weekly-dispute-timeout',0);cases.append(pending)
            withheld=f.make_season('withheld-draft-entropy',0)
            underfilled=f.make_season('underfilled-league',0,users=3)
            official=f.make_season('official-season-cancellation',0);f.official_cancel(official)
            original=f.players;f.players=original+[(i,[1,2,4,8,16][i%5]) for i in range(54,1501)]
            inventory=f.make_season('full-nhl-inventory',0);f.players=original
            f.reject('frozen NHL inventory cannot append after calendar publication',f.data.functions.appendAthletes(inventory['id'],[(1501,1)]))
        for c in cases+([withheld] if withheld else []):f.commit_entropy(c)
        if withheld:
            f.advance(f.funding_end);f.tx(f.season.functions.requestDraft(withheld['id']));f.reject('unfulfilled canonical entropy cannot start draft',f.season.functions.startDraft(withheld['id']))
            f.collect_refunds(underfilled,'league did not fill by published deadline')
        f.start_drafts(cases);print('Real entropy and twelve-round drafts completed',flush=True)
        for c in cases:f.prepare_transactions(c)
        if early:f.prepare_early_start(early,1)
        for c in cases:f.lock_first(c)
        if withheld:f.collect_refunds(withheld,'draft could not complete before first scoring period')
        if inventory:f.collect_refunds(inventory,'full NHL inventory and encrypted 1500-player preferences retained; unstarted draft refunded')
        print('First week locked',flush=True)
        if late_queue:f.prepare_early_start(late_queue,2)
        for phase in ('reveal','process','lock'):
            for c in cases:f.second_week(c,phase)
        print('Trades, private waivers and second week locks complete',flush=True)
        for c in cases:f.score_week(c,1);print('Scored first week '+c['label'],flush=True)
        if pending:f.challenge_week(pending)
        if free:f.challenge_week(free,denied=True)
        for c in cases:
            if c is not pending:f.finalize_week(c,1)
        if pending:f.timeout_week(pending);cases.remove(pending)
        for c in cases:f.score_week(c,2);print('Scored second week '+c['label'],flush=True)
        for c in cases:f.finalize_week(c,2)
        for c in cases:
            if c is void:
                f.tx(f.season.functions.initializeFinal(c['id']));f.collect_refunds(c,'all published scoring weeks conclusively void')
            else:f.finish_season(c)
        f.assert_conservation();f.export_execution(out);(out/'diagnostic.json').write_text(json.dumps({'diagnosticOnly':True,'outcomes':f.outcomes,'expectedRejections':f.rejections},indent=2)+'\n',encoding='utf-8');print('Funded season diagnostics complete; no certificate',flush=True)
    finally:node.terminate();node.wait(timeout=15);log.close()


if __name__=='__main__':main()
