"""Operational observer checks within the existing real execution harness.

Consensus/Engine/Indexer inputs are real. Canary, signer health and accounting
report transitions are explicit local signal fixtures; no network acceptance or
live financial lifecycle is claimed. Delivery targets are literal loopback only.
"""
import datetime, hashlib, http.server, json, os, pathlib, shutil, signal, subprocess, threading, time

class Qualification:
    def __init__(self,root,out,evidence,trust,pin,state,index_store,auth_port):
        self.root,self.out,self.evidence=root,out,evidence
        self.inputs=out/'monitor-inputs';self.inputs.mkdir()
        self.public=self.inputs/'public';self.public.mkdir()
        self.state=self.public/'consensus/settlement'
        self.cursor=(state/'sequence.json').read_bytes()
        self.cp=json.loads((state/'checkpoint.json').read_text())
        self.effects=[];self.requests=[];self.accepted=set();self.children=[];self.process=None;self.core_passed=False;self.divergence_recovered=False
        self.secret='local-qualification-delivery-token-95'
        owner=self
        class Receiver(http.server.BaseHTTPRequestHandler):
            def log_message(self,*args):pass
            def do_POST(self):
                alarm=json.loads(self.rfile.read(int(self.headers['Content-Length'])))
                assert self.headers.get('Authorization')=='Bearer '+owner.secret
                assert self.headers.get('Idempotency-Key')==alarm['id']
                assert owner.secret not in json.dumps(alarm)
                owner.requests.append({'id':alarm['id'],'rule':alarm['rule'],'transition':alarm['transition']})
                if len(owner.requests)==1:self.send_response(503);self.end_headers();return
                if alarm['id'] not in owner.accepted:
                    # Simulated destination acknowledges only after its durable
                    # idempotency ledger is fsynced. Replayed HTTP has no effect.
                    owner.accepted.add(alarm['id']);owner.effects.append(alarm)
                    raw=json.dumps(owner.effects).encode();path=owner.inputs/'accepted.json'
                    with path.open('wb') as f:f.write(raw);f.flush();os.fsync(f.fileno())
                self.send_response(202);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'id':alarm['id'],'status':'accepted'}).encode())
        self.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),Receiver)
        self.thread=threading.Thread(target=self.server.serve_forever,daemon=True);self.thread.start()
        token=self.inputs/'receiver-token';token.write_text(self.secret);token.chmod(0o600)
        self.config={'node':'qualification-validator','stateDir':str(out/'monitor-state'),'listen':'127.0.0.1:0','intervalSeconds':1,'freshSeconds':45,'maxAttempts':4,'baseBackoffSeconds':2,'maxBackoffSeconds':4,'allowExternalDelivery':False,
          'destinations':[{'id':'loopback-operator','url':f'http://127.0.0.1:{self.server.server_port}/alarms','bearerFile':str(token)}],
          'trust':str(trust),'trustSHA256':pin,'consensusDir':str(self.state),'engineURL':f'http://127.0.0.1:{auth_port}','engineJWTFile':str(out/'jwt.hex'),'indexerStore':str(index_store),'accountingReport':str(self.inputs/'accounting.json'),'canarySnapshot':str(self.inputs/'canary.json'),'signerHealth':str(self.inputs/'signer.json'),'validatorHealth':str(self.inputs/'validator.json'),'settlementHealth':str(out/'settlement-health.json'),'baselinePolicy':str(root/'testnet/public/monitoring/policy.json')}
        self.source_config=dict(self.config);self.source_config['consensusDir']=str(state)
        self.source_path=self.inputs/'source-config.json';self.source_path.write_text(json.dumps(self.source_config))
        self.publish('consensus');self.publish('indexer')
        self.config['trust']=str(self.public/'consensus/trust.json');self.config['indexerStore']=str(self.public/'indexer/index.json')
        self.config['accountingReport']=str(self.public/'accounting/report.json');self.config['canarySnapshot']=str(self.public/'canary/snapshot.json');self.config['signerHealth']=str(self.public/'health/signer/signer.json');self.config['validatorHealth']=str(self.public/'health/validator/validator.json')
        self.config_path=self.inputs/'config.json';self.config_path.write_text(json.dumps(self.config));self.refresh()
        subprocess.run([str(root/'bin/stake-monitor'),'--config',str(self.config_path),'--initialize'],cwd=root,check=True)
    def publish(self,component):
        subprocess.run([str(self.root/'bin/stake-monitor'),'--config',str(self.source_path),'--publish-public-inputs',str(self.public),'--publish-component',component],cwd=self.root,check=True)
    def refresh(self,safety=False,discrepancy=False,signing=False):
        now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z')
        canary={'schema':'420-canary-health-snapshot-v1','timestamp_utc':now,'active_seats':15,'safety_halt':safety,'conflicting_qc_detected':False,'randomness_degraded':False,'attestation_participation_pct':100,'primary_proposals':1,'fallback1_proposals':0,'fallback2_proposals':0,'peer_count_min':3,'engine_errors_total':0,'node420_version':self.secret}
        report={'schema':'420-stake-accounting-reconciliation-v1','chainId':420,'block':self.cp['Settlement']['ExecutionBlock'],'blockHash':'0x'+bytes(self.cp['Settlement']['BlockHash']).hex(),'consensusRoot':'0x'+bytes(self.cp['Head']['Root']).hex(),'finalizedRoot':'0x'+bytes(self.cp['Finalized']['Root']).hex(),'canonicalAuthority':False,'status':'DISCREPANCY' if discrepancy else 'RECONCILED','issuance':{},'expectedState':{'eligibleValidatorCount':'60'},'discrepancies':[{'code':'MISSING_INDEXER_EVENT','actual':self.secret}] if discrepancy else []}
        for name,value in [('canary.json',canary),('accounting.json',report)]:
            target=self.inputs/name;tmp=target.with_suffix('.tmp');tmp.write_text(json.dumps(value));tmp.replace(target)
        for component,status in [('signer','PERSISTENCE_FAILURE' if signing else 'READY'),('validator','SIGNING_PROTECTION_FAILURE' if signing else 'READY')]:
            (self.inputs/(component+'.json')).write_text(json.dumps({'schema':'420-stake-runtime-health-v1','component':component,'observedAt':now,'status':status}))
        for component in ['accounting','canary','signer-health','validator-health']:self.publish(component)
        for path in self.public.rglob('*.json'):assert self.secret not in path.read_text(), 'private data escaped the public input publisher'
    def start(self):
        log=(self.out/f'monitor-{len(self.children)}.log').open('w')
        self.process=subprocess.Popen([str(self.root/'bin/stake-monitor'),'--config',str(self.config_path)],cwd=self.root,stdout=log,stderr=subprocess.STDOUT,start_new_session=True)
        self.children.append({'pid':self.process.pid});log.close()
    def stop(self):
        if self.process and self.process.poll() is None:os.killpg(self.process.pid,signal.SIGKILL);self.process.wait(timeout=15)
        self.process=None
    def wait(self,rule,transition):
        deadline=time.monotonic()+30
        while time.monotonic()<deadline:
            if self.process and self.process.poll() is not None:raise AssertionError('observer process exited; inspect monitor log')
            if any(e['rule']==rule and e['transition']==transition for e in self.effects):return
            time.sleep(.05)
        raise AssertionError('alarm transition missing: '+rule+'/'+transition)
    def run(self):
        self.refresh(safety=True);self.start()
        deadline=time.monotonic()+20
        while time.monotonic()<deadline:
            ledger=self.out/'monitor-state/state.json'
            if ledger.exists() and any(r['status']=='retry' for r in json.loads(ledger.read_text())['records']):break
            time.sleep(.02)
        else:raise AssertionError('failed destination did not persist retry')
        self.stop();self.start();self.wait('safety_halt','FIRING')
        self.refresh(discrepancy=True);self.wait('safety_halt','RECOVERED');self.wait('accounting_discrepancy','FIRING');self.wait('indexer_reconciliation_discrepancy','FIRING')
        self.refresh(signing=True);self.wait('accounting_discrepancy','RECOVERED');self.wait('signing_protection_failure','FIRING');self.wait('persistence_failure','FIRING')
        self.refresh();self.wait('signing_protection_failure','RECOVERED');self.wait('persistence_failure','RECOVERED')
        (self.state/'sequence.json').write_text('{}');self.wait('sequence_state_unavailable','FIRING');(self.state/'sequence.json').write_bytes(self.cursor);self.wait('sequence_state_unavailable','RECOVERED')
        self.stop();self.start();time.sleep(1.2);self.stop()
        assert len([e for e in self.effects if e['rule']=='safety_halt' and e['transition']=='FIRING'])==1
        by_rule={}
        for e in self.effects:
            assert e['severity'] in ['CRITICAL','MAJOR','WARN']
            if e['transition']=='RECOVERED':assert by_rule.get(e['rule'])=='FIRING'
            by_rule[e['rule']]=e['transition']
        assert self.secret not in json.dumps(self.effects)
        self.core_passed=True
    def divergence(self,firing):
        self.refresh();self.start();self.wait('execution_divergence','FIRING' if firing else 'RECOVERED');self.stop()
        if not firing:self.divergence_recovered=True
    def close(self):
        self.stop();self.server.shutdown();self.server.server_close();self.thread.join(timeout=5)
        result={'schema':'420-stake-monitor-qualification-v1','candidate_sha':subprocess.check_output(['git','rev-parse','HEAD'],cwd=self.root,text=True).strip(),'binary_sha256':hashlib.sha256((self.root/'bin/stake-monitor').read_bytes()).hexdigest(),'scope':'real signed history, Engine, journal mirror and Indexer; explicitly simulated canary/accounting/signer-health and loopback destination','processes':self.children,'requests':self.requests,'effects':self.effects,'pass':self.core_passed and self.divergence_recovered}
        assert self.secret not in json.dumps(result)
        (self.out/'monitoring-evidence.json').write_text(json.dumps(result,indent=2))
        self.evidence['monitoring']={'processes':self.children,'effects':len(self.effects),'requests':len(self.requests),'binary_sha256':result['binary_sha256'],'pass':result['pass']}
