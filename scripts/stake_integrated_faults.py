"""STAKE-AUDIT-9.6 extension of the existing real-process recovery owner.

The production signer supplies one indispensable share of an 11/15 QC. Ten
co-signers and downstream accounting signals remain explicitly local fixtures.
No certificate is submitted when protected signing fails. Private fixture trees
are never copied into qualification artifacts.
"""
import hashlib,json,os,pathlib,signal,socket,subprocess,time


def run(root,out,monitor,produce,send,wait,spawn,kill_consensus,checkpoint,cursor,history,snapshot,start_execution,stop_execution,index_checkpoint,parent,cross_final,old_cursor):
    fixture=out/'protected-fixture';fixture.mkdir(mode=0o700)
    producer=root/'bin/settlement-fixture';signer=root/'bin/stake-signer';fault=root/'bin/stake-signer-fault'
    assert os.environ.get('STAKE_SIGNER_PG_DSN'), 'integrated qualification requires authenticated TLS PostgreSQL'
    policy=json.loads(subprocess.check_output([str(producer),'--provision-protected',str(fixture)],text=True))
    tls=fixture/'tls';tls.mkdir(mode=0o700)
    def command(args):subprocess.run(args,check=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
    command(['openssl','req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',str(tls/'ca.key'),'-out',str(tls/'ca.pem'),'-days','1','-subj','/CN=LOCAL-9.6-CA'])
    pins={}
    for i,name in enumerate(['server','client']):
        command(['openssl','req','-new','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',str(tls/(name+'.key')),'-out',str(tls/(name+'.csr')),'-subj','/CN='+name])
        ext=tls/(name+'.ext');ext.write_text('extendedKeyUsage='+('serverAuth\nsubjectAltName=DNS:localhost,IP:127.0.0.1\n' if name=='server' else 'clientAuth\n'))
        command(['openssl','x509','-req','-in',str(tls/(name+'.csr')),'-CA',str(tls/'ca.pem'),'-CAkey',str(tls/'ca.key'),'-set_serial',str(i+2),'-out',str(tls/(name+'.pem')),'-days','1','-extfile',str(ext)])
        for f in [tls/(name+'.key'),tls/'ca.key']:f.chmod(0o600)
        pem=subprocess.check_output(['openssl','x509','-in',str(tls/(name+'.pem')),'-pubkey','-noout'])
        der=subprocess.check_output(['openssl','pkey','-pubin','-outform','DER'],input=pem)
        pins[name]=hashlib.sha256(der).hexdigest()
    remote=fixture/'signer';local=fixture/'validator'
    dsn=remote/'witness.dsn';dsn.write_text(os.environ['STAKE_SIGNER_PG_DSN']);dsn.chmod(0o600)
    pin=hashlib.sha256((remote/'policy.json').read_bytes()).hexdigest()
    sock=socket.socket();sock.bind(('127.0.0.1',0));address='127.0.0.1:'+str(sock.getsockname()[1]);sock.close()
    args=['--policy',str(remote/'policy.json'),'--policy-sha256',pin,'--history',str(remote/'history.json'),'--bls-ikm',str(remote/'bls.hex'),'--witness-dsn',str(dsn),'--tls-cert',str(tls/'server.pem'),'--tls-key',str(tls/'server.key'),'--tls-ca',str(tls/'ca.pem'),'--client-spki-sha256',pins['client'],'--listen',address]
    node_args=[str(root/'bin/fourtwentyd'),'--protected-signing','--signer','https://'+address,'--signing-policy',str(local/'policy.json'),'--signing-policy-sha256',pin,'--signing-history',str(local/'history.json'),'--signer-client-cert',str(tls/'client.pem'),'--signer-client-key',str(tls/'client.key'),'--signer-ca',str(tls/'ca.pem'),'--signer-spki-sha256',pins['server']]
    config=fixture/'client.json';config.write_text(json.dumps({'Policy':policy,'NodeArgs':node_args}))
    health=fixture/'health';health.mkdir()
    clean_env={k:v for k,v in os.environ.items() if k not in ['STAKE_SIGNER_PG_DSN','PGPASSWORD']}
    env=dict(clean_env,STAKE_SIGNER_HEALTH_FILE=str(health/'signer.json'),STAKE_VALIDATOR_HEALTH_FILE=str(health/'validator.json'))
    # Explicitly provision a never-used local fixture identity; no auto-reset.
    subprocess.run([str(signer),*args,'--provision-never-used-key'],env=env,check=True)
    initial=(remote/'history.json').read_bytes()
    children=[];handles=[];server=None;validator=None;logs=[];steps=[]
    result={'schema':'420-stake-integrated-faults-v1','candidate_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip(),'pass':False,'scope':'real protected seat-zero signer, TLS PostgreSQL witness, typed-duty validator, certified settlement, Geth, Indexer and observer; ten QC shares/downstream counter/accounting signals are local fixtures','processes':children,'scenarios':steps,'binary_sha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in [signer,fault,root/'bin/fourtwentyd',producer]}}
    result['source_sha256']={p:hashlib.sha256((root/p).read_bytes()).hexdigest() for p in ['scripts/stake_integrated_faults.py','scripts/settlement_process_scenarios.py','integration/cmd/settlement-fixture/main.go','integration/cmd/settlement-fixture/protected.go','consensus/slashing/durable.go','consensus/slashing/write_fault_enabled.go','consensus/slashing/write_fault_none.go']}
    def launch(binary,argv,extra=None,stdin=None):
        f=(out/f'integrated-child-{len(children)}.log').open('w');logs.append(f)
        c=subprocess.Popen([str(binary),*argv],cwd=root,env=dict(env,**(extra or {})),stdin=stdin,stdout=subprocess.PIPE,stderr=f,text=True,start_new_session=True)
        children.append({'pid':c.pid,'binary':pathlib.Path(binary).name});handles.append(c);return c
    def kill(c):
        if c is not None and c.poll() is None:os.killpg(c.pid,signal.SIGKILL);c.wait(timeout=20)
    def start(fault_stage=None):
        nonlocal server
        server=launch(fault if fault_stage else signer,args,{'STAKE_SIGNING_STOP_AT':fault_stage} if fault_stage else None)
        until=time.monotonic()+15
        while time.monotonic()<until:
            assert server.poll() is None,'signer startup failed: '+(out/f'integrated-child-{len(children)-1}.log').read_text()
            try:
                s=socket.create_connection(tuple([address.split(':')[0],int(address.split(':')[1])]),timeout=.2);s.close();return
            except OSError:time.sleep(.05)
        raise AssertionError('protected signer not listening')
    def watcher():
        nonlocal validator
        validator=launch(node_args[0],node_args[1:],stdin=subprocess.PIPE)
        until=time.monotonic()+12
        while time.monotonic()<until:
            if (health/'validator.json').exists() and json.loads((health/'validator.json').read_text())['status']=='READY':return
            time.sleep(.05)
        raise AssertionError('real validator semantic health not ready')
    def alarm(rule,transition,mark):
        until=time.monotonic()+40
        while time.monotonic()<until:
            assert monitor.process.poll() is None,'monitor exited'
            if any(x['rule']==rule and x['transition']==transition for x in monitor.effects[mark:]):return
            time.sleep(.05)
        raise AssertionError('integrated alarm missing '+rule+'/'+transition)
    def record(name,before,**extra):
        after=snapshot();steps.append(dict(name=name,before=before,after=after,**extra))
    def sign(plan):
        return subprocess.run([str(producer),'--protected-config',str(config),'--record',str(plan)],cwd=root,env=env,text=True,capture_output=True,timeout=25)
    try:
        monitor.stop();monitor.refresh()
        monitor.config.update(signerHealth=str(health/'signer.json'),validatorHealth=str(health/'validator.json'))
        monitor.config_path.write_text(json.dumps(monitor.config))
        stable=snapshot();durable=(out/'consensus/checkpoint.json').read_bytes()
        # Build a genuine next payload; do not submit an uncertified alternative.
        candidate=produce(parent,5,5)
        plan=out/'plan-5-1.json'
        start('history-write')
        torn=launch(producer,['--protected-config',str(config),'--record',str(plan)])
        until=time.monotonic()+15
        while time.monotonic()<until:
            if any('signing_fault stage=history-write' in p.read_text() for p in out.glob('integrated-child-*.log')):break
            time.sleep(.05)
        else:raise AssertionError('partial journal write boundary not reached')
        temporary=list(remote.glob('.slashing-*'));assert len(temporary)==1
        partial=temporary[0].read_bytes()
        try:json.loads(partial)
        except ValueError:pass
        else:raise AssertionError('injected write is not partial')
        assert (remote/'history.json').read_bytes()==initial
        kill(server);stdout,_=torn.communicate(timeout=20)
        assert torn.returncode!=0 and not stdout and snapshot()==stable
        record('SIGKILL during partial private journal write retains prior durable history',stable,partial_bytes=len(partial))
        start('local-reserved')
        pending=launch(producer,['--protected-config',str(config),'--record',str(plan)])
        until=time.monotonic()+15
        while time.monotonic()<until:
            if any('signing_fault stage=local-reserved' in p.read_text() for p in out.glob('integrated-child-*.log')):break
            time.sleep(.05)
        else:raise AssertionError('interrupted reservation boundary not reached')
        assert (remote/'history.json').read_bytes()!=initial
        kill(server);stdout,_=pending.communicate(timeout=20)
        assert pending.returncode!=0 and not stdout,'crashed signer released quorum certificate'
        assert snapshot()==stable and (out/'consensus/checkpoint.json').read_bytes()==durable
        monitor.start();mark=len(monitor.effects);alarm('signing_protection_failure','FIRING',mark)
        failed=launch(signer,args);failed.communicate(timeout=15);assert failed.returncode!=0,'unwitnessed reservation reopened'
        recovery=launch(signer,[*args,'--recover-witness-history']);recovery.communicate(timeout=15);assert recovery.returncode==0
        start();signed=sign(plan);assert signed.returncode==0,signed.stderr
        protected=json.loads(signed.stdout)
        # Protected share is cryptographically part of the QC used by settlement.
        send(protected);wait('settled',5)
        accepted=snapshot();assert accepted['sequence']==accepted['observed']==6
        mark=len(monitor.effects);watcher();alarm('signing_protection_failure','RECOVERED',mark)
        record('interrupted signer reservation, witnessed recovery and protected-QC settlement',stable,signer_released_before_recovery=False)
        kill(validator)
        # Same duty can be retried; a second signing history cannot enable equivocation.
        retry=sign(plan);assert retry.returncode==0 and json.loads(retry.stdout)['Certificate']==protected['Certificate']
        send(protected);assert wait('rejected')['error']=='DUPLICATE_SETTLEMENT_REJECTED';assert snapshot()==accepted
        record('identical protected duty idempotent; duplicate settlement rejected',accepted)
        conflict=json.loads(plan.read_text());conflict['Payload']['blockHash']='0x'+'ab'*32
        conflict_path=fixture/'conflict.json';conflict_path.write_text(json.dumps(conflict))
        mark=len(monitor.effects)
        rejected=sign(conflict_path);assert rejected.returncode!=0 and not rejected.stdout
        alarm('signing_protection_failure','FIRING',mark)
        assert snapshot()==accepted
        record('conflicting QC vote cannot escape either signing history',accepted)
        # Explicitly recover failed runtime clients; never erase reservations.
        start_mark=len(monitor.effects);watcher();alarm('signing_protection_failure','RECOVERED',start_mark)
        # Source-owner views now track the genuine new canonical checkpoint.
        monitor.cp=checkpoint();monitor.cursor=(out/'consensus/sequence.json').read_bytes()
        indexed=index_checkpoint(accepted,protected,continuous=True)
        monitor.publish('consensus');monitor.publish('indexer');monitor.refresh()
        # Engine outage and signer outage overlap while all durable settlement
        # boundaries remain fixed. A typed signing attempt must emit no QC.
        kill(validator);kill(server);stop_execution(abrupt=True)
        mark=len(monitor.effects)
        unavailable=sign(plan);assert unavailable.returncode!=0 and not unavailable.stdout
        alarm('signing_protection_failure','FIRING',mark);alarm('engine_errors','FIRING',mark)
        monitor.stop();monitor.start()
        wait('halted')
        fixed=checkpoint();assert fixed['Settlement']['LastSequence']==6
        start_execution();wait('settled',5);start();watcher()
        alarm('signing_protection_failure','RECOVERED',mark);alarm('engine_errors','RECOVERED',mark)
        assert snapshot()==accepted and checkpoint()==fixed
        record('overlapping unavailable signer and Engine halt; coordinated restart',accepted)
        # Missing and contradictory accounting are observations, never authority.
        monitor.refresh();mark=len(monitor.effects)
        accounting=pathlib.Path(monitor.config['accountingReport']);saved=accounting.read_bytes();accounting.unlink()
        alarm('accounting_evidence_unavailable','FIRING',mark)
        accounting.write_bytes(saved);alarm('accounting_evidence_unavailable','RECOVERED',mark)
        mark=len(monitor.effects);monitor.refresh(discrepancy=True)
        alarm('accounting_discrepancy','FIRING',mark);monitor.refresh();alarm('accounting_discrepancy','RECOVERED',mark)
        assert snapshot()==accepted and checkpoint()==fixed
        record('missing and contradictory accounting alarms cannot alter settlement',accepted)
        # Actual live sequence journal is made stale while settlement is offline;
        # monitor reads the public owner mirror and explicit verified repair wins.
        kill_consensus();sequence=out/'consensus/sequence.json';sequence.write_bytes(old_cursor)
        (monitor.state/'sequence.json').write_bytes(old_cursor);mark=len(monitor.effects)
        alarm('sequence_state_mismatch','FIRING',mark)
        spawn();wait('halted');assert checkpoint()==fixed;kill_consensus()
        spawn(repair=True);wait('settled',5);assert snapshot()==accepted and cursor()['lastSequence']==6
        monitor.publish('consensus');alarm('sequence_state_mismatch','RECOVERED',mark)
        record('stale authoritative sequence halts; verified repair and matching recovery alarm',accepted)
        # A checksum-valid but history-contradicting execution checkpoint must
        # not become recovery authority, even with explicit sequence recovery.
        kill_consensus();cp_path=out/'consensus/checkpoint.json';valid_cp=cp_path.read_bytes()
        bad=json.loads(valid_cp);original=bad['Checksum'];bad['Checksum']=''
        assert hashlib.sha256(json.dumps(bad,separators=(',',':')).encode()).hexdigest()==original
        bad['Settlement']['BlockHash'][0]^=1
        bad['Checksum']=hashlib.sha256(json.dumps(bad,separators=(',',':')).encode()).hexdigest()
        cp_path.write_text(json.dumps(bad));(monitor.state/'checkpoint.json').write_text(json.dumps(bad));mark=len(monitor.effects)
        spawn(repair=True);assert wait('exited')['exit']!=0;assert snapshot()==accepted;kill_consensus()
        alarm('consensus_evidence_unavailable','FIRING',mark)
        cp_path.write_bytes(valid_cp);spawn();wait('settled',5);monitor.publish('consensus')
        alarm('consensus_evidence_unavailable','RECOVERED',mark)
        record('checksum-valid execution checkpoint contradiction cannot override certified history',accepted)
        # Reject conflicting finalized history with the integrated observer active.
        mark=len(monitor.effects);send(cross_final);rejection=wait('rejected');assert rejection['error']=='FINALIZED_BOUNDARY_REJECTED'
        assert checkpoint()==fixed and snapshot()==accepted
        record('conflicting finalized history cannot be overridden during recovery',accepted)
        # Crash after acceptance before consensus journal: a protected certificate
        # is replayed from durable pending intent, never signed/effected twice.
        kill(validator)
        sixth=produce(protected,6,6);plan6=out/'plan-6-1.json';signed6=sign(plan6);assert signed6.returncode==0,signed6.stderr
        sixth=json.loads(signed6.stdout);kill_consensus();spawn(fault_slot=6);wait('settled',5);send(sixth);wait('canonical',6)
        canonical=snapshot();assert canonical['sequence']==7 and cursor()['lastSequence']==6 and checkpoint()==fixed
        kill_consensus();spawn();wait('settled',6);assert snapshot()==canonical and cursor()['lastSequence']==7 and history()['Pending'] is None
        record('protected-QC acceptance before journal SIGKILL; independently reconciled once',accepted)
        # Restart the actual Indexer on the same store after protected recovery;
        # the new head must be reconstructed without duplicating earlier logs.
        old_indexer=monitor.evidence['indexer_processes'][-1]['pid']
        os.kill(old_indexer,signal.SIGKILL);os.waitpid(old_indexer,0)
        rebuilt=index_checkpoint(canonical,sixth,continuous=True)
        assert all(rebuilt['logs'].get(k)==v for k,v in indexed['logs'].items())
        identities=[(v['blockHash'],v['transactionHash'],v['logIndex']) for v in rebuilt['logs'].values()]
        assert len(identities)==len(set(identities))
        assert all(v['blockHash']==rebuilt['blocks'][str(v['blockNumber'])]['hash'] for v in rebuilt['logs'].values())
        canonical_hashes={b['hash'] for b in rebuilt['blocks'].values()}
        expected_logs=sum(len(r['Consensus']['body']['systemCalls'])*2 for r in history()['Entries'] if r['Payload']['blockHash'] in canonical_hashes)
        assert len(identities)==expected_logs
        monitor.cp=checkpoint();monitor.cursor=(out/'consensus/sequence.json').read_bytes()
        monitor.publish('consensus');monitor.publish('indexer');monitor.refresh();watcher()
        until=time.monotonic()+20
        critical={'safety_halt','execution_divergence','gateway_sequence_mismatch','sequence_state_unavailable','sequence_state_mismatch','signing_protection_failure','persistence_failure','accounting_discrepancy','consensus_evidence_unavailable'}
        while time.monotonic()<until:
            ledger=json.loads((out/'monitor-state/state.json').read_text())
            if not any(v['active'] for k,v in ledger['incidents'].items() if k in critical):break
            time.sleep(.1)
        else:raise AssertionError('coordinated recovery left active critical incident')
        assert snapshot()==canonical and cursor()['lastSequence']==canonical['sequence']==7
        result['indexer_restart']={'before':indexed['checkpoint'],'after':rebuilt['checkpoint'],'logs':len(rebuilt['logs'])}
        record('coordinated Indexer restart and operational recovery preserve canonical effects',canonical)
        result['pass']=True
    finally:
        for child in handles:kill(child)
        for f in logs:f.close()
        result['alarms']=[{'rule':e['rule'],'transition':e['transition'],'id':e['id']} for e in monitor.effects]
        (out/'integrated-fault-evidence.json').write_text(json.dumps(result,indent=2))
    assert result['pass']
    return result
