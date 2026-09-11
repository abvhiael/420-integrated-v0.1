create table if not exists idx_canonical_history (
  chain_id numeric(78,0) not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  parent_hash text not null,
  primary key (chain_id, block_number)
);
create index if not exists idx_canonical_history_hash on idx_canonical_history(chain_id, block_hash);
