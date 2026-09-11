create table if not exists idx_assets (
  chain_id numeric(78,0) not null,
  asset_key text not null,
  asset_kind text not null check (asset_kind in ('native','erc20','erc721','erc1155')),
  contract_address text,
  token_id numeric(78,0),
  symbol text,
  name text,
  decimals integer,
  metadata_uri text,
  last_seen_block numeric(78,0) not null,
  primary key (chain_id, asset_key)
);

create table if not exists idx_asset_transfers (
  chain_id numeric(78,0) not null,
  block_number numeric(78,0) not null,
  tx_hash text not null,
  log_index integer not null check (log_index >= -1),
  asset_key text not null,
  asset_kind text not null,
  contract_address text,
  token_id numeric(78,0),
  from_address text not null,
  to_address text not null,
  amount numeric(78,0) not null check (amount >= 0),
  primary key (chain_id, tx_hash, log_index, asset_key, from_address, to_address, amount)
);

create index if not exists idx_asset_transfers_block on idx_asset_transfers(chain_id, block_number);
create index if not exists idx_asset_transfers_asset on idx_asset_transfers(chain_id, asset_key, block_number);
create index if not exists idx_asset_transfers_from on idx_asset_transfers(chain_id, from_address, block_number);
create index if not exists idx_asset_transfers_to on idx_asset_transfers(chain_id, to_address, block_number);

create table if not exists idx_asset_balances (
  chain_id numeric(78,0) not null,
  asset_key text not null,
  asset_kind text not null,
  contract_address text,
  token_id numeric(78,0),
  holder_address text not null,
  balance numeric(78,0) not null,
  primary key (chain_id, asset_key, holder_address)
);

create index if not exists idx_asset_balances_holder on idx_asset_balances(chain_id, holder_address);
