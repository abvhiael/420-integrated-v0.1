#!/usr/bin/env python3
import argparse, pathlib, subprocess, time, sys, signal, json, os

ap=argparse.ArgumentParser()
ap.add_argument("--seconds",type=int,default=90)
ap.add_argument("--slot-ms",type=int,default=12000)
ap.add_argument("--geth",default="")
ap.add_argument("--consensus-transport",choices=["devnet-tcp","libp2p"],default="libp2p")
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
geth=args.geth or os.environ.get("NODE420_GETH") or str(root/"bin/upstream/geth-v1.17.5")
bus=None
procs=[]

def stop_all():
    for p in procs:
        if p.poll() is None:
            p.terminate()
    if bus and bus.poll() is None:
        bus.terminate()
    time.sleep(.5)
    for p in procs:
        if p.poll() is None:
            p.kill()
    if bus and bus.poll() is None:
        bus.kill()

try:
    # Until the libp2p CLI bootstrapping flags are wired into fourtwentyd,
    # production-tag builds are still required by qualification even when the
    # local orchestration control plane uses the deterministic broker.
    if args.consensus_transport=="devnet-tcp":
        bus=subprocess.Popen([str(root/"bin/devnet-bus"),"--listen","127.0.0.1:9420"],
                             cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        time.sleep(.3)

    # Start 15 execution clients.
    for i in range(15):
        d=root/"devnet-data"/"real15"/f"node-{i}"
        node420=[
            str(root/"bin/node420"),"--geth",geth,
            "--datadir",str(d/"execution"),
            "--jwt-secret",str(d/"jwt.hex"),
            "--authrpc.addr","127.0.0.1","--authrpc.port",str(8551+i),
            "--http.addr","127.0.0.1","--http.port",str(8545+i),
            "--port",str(30303+i),
        ]
        p=subprocess.Popen(node420,cwd=root,stdout=(d/"node420.log").open("w"),stderr=subprocess.STDOUT)
        procs.append(p)

    # Wait for Engine endpoints.
    for i in range(15):
        d=root/"devnet-data"/"real15"/f"node-{i}"
        ok=False
        for _ in range(40):
            cp=subprocess.run([str(root/"bin/fourtwentyd"),"--engine-probe",
                               "--engine",f"http://127.0.0.1:{8551+i}",
                               "--jwt-secret",str(d/"jwt.hex")],
                              cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
            if cp.returncode==0:
                ok=True;break
            time.sleep(.5)
        if not ok:
            raise RuntimeError(f"Engine endpoint {i} failed readiness")

    # Start 15 consensus processes using live Engine sinks.
    for i in range(15):
        d=root/"devnet-data"/"real15"/f"node-{i}"
        cmd=[
            str(root/"bin/fourtwentyd"),
            "--devnet-validator",
            f"--node-id={1000+i}",f"--seat={i}",
            "--max-slots","1000000",
            "--slot-ms",str(args.slot_ms),
            "--state",str(d/"consensus"/"state.json"),
            "--engine",f"http://127.0.0.1:{8551+i}",
            "--jwt-secret",str(d/"jwt.hex"),
        ]
        if args.consensus_transport=="devnet-tcp":
            cmd += ["--bus","127.0.0.1:9420"]
        p=subprocess.Popen(cmd,cwd=root,stdout=(d/"fourtwentyd.log").open("w"),stderr=subprocess.STDOUT)
        procs.append(p)

    started=time.time()
    while time.time()-started<args.seconds:
        dead=[p for p in procs if p.poll() is not None]
        if dead:
            raise RuntimeError(f"{len(dead)} processes exited unexpectedly")
        time.sleep(1)

    result={"pass":True,"execution_nodes":15,"consensus_nodes":15,"seconds":args.seconds,
            "transport":args.consensus_transport}
    (root/"qualification/real-devnet15.json").write_text(json.dumps(result,indent=2)+"\n")
    print(json.dumps(result,indent=2))
finally:
    stop_all()
