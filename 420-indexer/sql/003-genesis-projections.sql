create table if not exists idx_protocol_events (
  chain_id numeric(78,0) not null,
  block_number numeric(78,0) not null,
  block_hash text not null,
  tx_hash text not null,
  tx_index integer not null,
  log_index integer not null,
  contract_address text not null,
  protocol text not null,
  event_name text not null,
  fields jsonb not null,
  primary key (chain_id, block_hash, tx_hash, log_index)
);
create index if not exists idx_protocol_events_protocol_event on idx_protocol_events(chain_id, protocol, event_name, block_number);
create index if not exists idx_protocol_events_contract on idx_protocol_events(chain_id, contract_address, block_number);
