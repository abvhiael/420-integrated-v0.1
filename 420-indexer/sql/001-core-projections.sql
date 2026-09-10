create table if not exists idx_blocks (
  chain_id numeric(78,0) not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  parent_hash text not null,
  block_timestamp numeric(78,0) not null,
  primary key (chain_id, block_number),
  unique (chain_id, block_hash)
);

create table if not exists idx_addresses (
  chain_id numeric(78,0) not null,
  address text not null,
  is_contract boolean not null default false,
  primary key (chain_id, address)
);

create table if not exists idx_transactions (
  chain_id numeric(78,0) not null,
  tx_hash text not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  tx_index integer not null,
  from_address text not null,
  to_address text,
  value_wei numeric(78,0) not null,
  input text not null,
  primary key (chain_id, tx_hash),
  unique (chain_id, block_number, tx_index)
);
create index if not exists idx_transactions_block on idx_transactions(chain_id, block_number);
create index if not exists idx_transactions_from on idx_transactions(chain_id, from_address);
create index if not exists idx_transactions_to on idx_transactions(chain_id, to_address);

create table if not exists idx_receipts (
  chain_id numeric(78,0) not null,
  tx_hash text not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  tx_index integer not null,
  status smallint not null check (status in (0,1)),
  contract_address text,
  primary key (chain_id, tx_hash)
);
create index if not exists idx_receipts_block on idx_receipts(chain_id, block_number);

create table if not exists idx_logs (
  chain_id numeric(78,0) not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  tx_hash text not null,
  tx_index integer not null,
  log_index integer not null,
  address text not null,
  topics jsonb not null,
  data text not null,
  primary key (chain_id, block_hash, tx_hash, log_index)
);
create index if not exists idx_logs_block on idx_logs(chain_id, block_number);
create index if not exists idx_logs_address on idx_logs(chain_id, address);

create table if not exists idx_checkpoints (
  chain_id numeric(78,0) primary key,
  block_number numeric(78,0) not null,
  block_hash text not null,
  parent_hash text not null
);
