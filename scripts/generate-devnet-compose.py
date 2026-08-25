#!/usr/bin/env python3
import json, pathlib
root=pathlib.Path(__file__).resolve().parents[1]
cfg=json.loads((root/"devnet/config/nodes15.json").read_text())
lines=["version: '3.9'","services:"]
for n in cfg["nodes"]:
    i=n["seat"]
    lines += [
      f"  node420-{i}:",
      "    image: 420integrated/node420:dev",
      '    command: ["--datadir","/data","--jwt-secret","/secrets/jwt.hex","--authrpc.addr","0.0.0.0","--authrpc.port","8551","--http.addr","0.0.0.0","--http.port","8545","--port","30303"]',
      f'    volumes: ["./node-{i}/execution:/data","./node-{i}/jwt.hex:/secrets/jwt.hex:ro"]',
      f'    ports: ["{n["execution_http_port"]}:8545","{n["execution_p2p_port"]}:30303"]',
      f"  fourtwentyd-{i}:",
      "    image: 420integrated/fourtwentyd:dev",
      f'    command: ["--devnet-validator","--node-id={n["validator_id"]}","--seat={i}","--state=/data/consensus.json","--engine=http://node420-{i}:8551","--jwt-secret=/secrets/jwt.hex"]',
      f'    depends_on: ["node420-{i}"]',
      f'    volumes: ["./node-{i}/consensus:/data","./node-{i}/jwt.hex:/secrets/jwt.hex:ro"]',
    ]
out=root/"devnet/compose/docker-compose.devnet15.yml"
out.write_text("\n".join(lines)+"\n")
print(out)
