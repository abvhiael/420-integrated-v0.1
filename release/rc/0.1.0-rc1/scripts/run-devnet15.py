#!/usr/bin/env python3
import argparse, subprocess, time, sys, pathlib, shutil, json

def partition_spec(kind):
    if kind=="none": return ""
    if kind=="8-7": return "1000-1007|1008-1014"
    if kind=="11-4": return "1000-1010|1011-1014"
    raise ValueError(kind)

def run_phase(root,args,start_seats,label):
    bin=root/"bin"
    buscmd=[str(bin/"devnet-bus"),"--listen","127.0.0.1:9420"]
    pspec=partition_spec(args.partition)
    if pspec: buscmd += ["--partition",pspec]
    bus=subprocess.Popen(buscmd,cwd=root,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,text=True)
    time.sleep(.15)
    procs=[]
    try:
        for seat in start_seats:
            state=root/"devnet-data"/f"node-{seat}"/"consensus.json"
            engine=root/"devnet-data"/f"node-{seat}"/"engine-forkchoice.json"
            cmd=[str(bin/"fourtwentyd"),"--devnet-validator",f"--node-id={1000+seat}",f"--seat={seat}",
                 "--bus=127.0.0.1:9420",f"--max-slots={args.slots}",f"--slot-ms={args.slot_ms}",
                 f"--state={state}",f"--engine-state={engine}"]
            if args.primary_down: cmd.append("--primary-down")
            if args.fb1_down: cmd.append("--fb1-down")
            p=subprocess.Popen(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True)
            procs.append((seat,p))
        outputs=[]
        timeout=max(10,args.slots*args.slot_ms/1000+8)
        for seat,p in procs:
            try: out,_=p.communicate(timeout=timeout)
            except subprocess.TimeoutExpired:
                p.terminate();out,_=p.communicate(timeout=2)
            outputs.append(out)
        text="".join(outputs)
        if args.verbose: print(text,end="")
        proposals=sum("event=proposal" in line for line in text.splitlines())
        qcs=sum("event=qc" in line for line in text.splitlines())
        finals=[int(line.split("finalized=")[-1]) for line in text.splitlines()
                if "event=qc" in line and "finalized=" in line]
        finalized=max(finals or [0])
        result={"label":label,"nodes":len(start_seats),"partition":args.partition,
                "proposals":proposals,"qc_events":qcs,"max_finalized":finalized}
        print("DEVNET_PHASE "+json.dumps(result,sort_keys=True))
        return result
    finally:
        for _,p in procs:
            if p.poll() is None:p.terminate()
        bus.terminate()
        try:bus.wait(timeout=2)
        except:bus.kill()

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--slots",type=int,default=5)
    ap.add_argument("--slot-ms",type=int,default=120)
    ap.add_argument("--nodes",type=int,default=15)
    ap.add_argument("--partition",choices=["none","8-7","11-4"],default="none")
    ap.add_argument("--primary-down",action="store_true")
    ap.add_argument("--fb1-down",action="store_true")
    ap.add_argument("--restart-test",action="store_true")
    ap.add_argument("--keep-data",action="store_true")
    ap.add_argument("--verbose",action="store_true")
    args=ap.parse_args()
    root=pathlib.Path(__file__).resolve().parents[1]
    data=root/"devnet-data"
    if not args.keep_data and data.exists():shutil.rmtree(data)
    seats=list(range(args.nodes))
    phases=[run_phase(root,args,seats,"phase1")]
    if args.restart_test:phases.append(run_phase(root,args,seats,"restart"))
    summary={"nodes":args.nodes,"partition":args.partition,"phases":phases,
             "max_finalized":max(p["max_finalized"] for p in phases),
             "total_qc_events":sum(p["qc_events"] for p in phases)}
    print("DEVNET_SUMMARY "+json.dumps(summary,sort_keys=True))

    # Expected safety/liveness conditions.
    if args.partition=="8-7":
        return 0 if all(p["qc_events"]==0 for p in phases) else 4
    if args.partition=="11-4":
        return 0 if all(p["qc_events"]>0 for p in phases) else 5
    if args.nodes>=11:
        return 0 if all(p["qc_events"]>0 for p in phases) else 2
    return 0 if all(p["qc_events"]==0 for p in phases) else 3

if __name__=="__main__":sys.exit(main())
