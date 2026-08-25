import json
from pathlib import Path

cfg = json.loads(Path("config/protocol.json").read_text())

assert sum(cfg["monetary_policy"]["top_level_split_percent"].values()) == 100
assert cfg["consensus"]["rotation_interval_blocks"] == (
    cfg["consensus"]["consensus_epoch_blocks"] *
    cfg["consensus"]["rotation_interval_epochs"]
)
assert cfg["consensus"]["active_term_blocks"] == (
    cfg["consensus"]["rotation_interval_blocks"] *
    cfg["consensus"]["active_rotations_per_validator"]
)

seconds = cfg["consensus"]["rotation_interval_blocks"] * cfg["network"]["block_target_seconds"]
days = seconds / 86400
print(f"Rotation interval: {cfg['consensus']['rotation_interval_blocks']:,} blocks = {days:.4f} days")
print("Protocol parameter checks passed.")
