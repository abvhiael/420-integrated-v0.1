create or replace view idx_protocol_object_events as
select
  e.*,
  coalesce(
    e.fields->>'objectId',
    e.fields->>'componentId',
    e.fields->>'labelHash',
    e.fields->>'profileId',
    e.fields->>'validatorId',
    e.fields->>'proposalId',
    e.fields->>'paymentId',
    e.fields->>'routeId',
    e.fields->>'messageId',
    e.fields->>'requestId',
    e.fields->>'rightId',
    e.fields->>'assetId'
  ) as object_key,
  coalesce(
    e.fields->>'stateAfter',
    e.fields->>'status',
    e.fields->>'state',
    e.fields->>'active'
  ) as lifecycle_state
from idx_protocol_events e;

create or replace view idx_protocol_latest_object_state as
select distinct on (chain_id, protocol, object_key)
  chain_id,
  protocol,
  object_key,
  contract_address,
  event_name,
  lifecycle_state,
  fields,
  block_number,
  block_hash,
  tx_hash,
  tx_index,
  log_index
from idx_protocol_object_events
where object_key is not null
order by chain_id, protocol, object_key, block_number desc, tx_index desc, log_index desc;

create or replace view idx_names_state as
select * from idx_protocol_latest_object_state where protocol = '420Names';

create or replace view idx_identity_state as
select * from idx_protocol_latest_object_state where protocol = '420Identity';

create or replace view idx_stake_state as
select * from idx_protocol_latest_object_state where protocol = '420Stake';

create or replace view idx_governance_state as
select * from idx_protocol_latest_object_state where protocol = '420Governance';

create or replace view idx_pay_state as
select * from idx_protocol_latest_object_state where protocol = '420Pay';

create or replace view idx_swap_state as
select * from idx_protocol_latest_object_state where protocol in ('420Swap','420Exchange');

create or replace view idx_bridge_state as
select * from idx_protocol_latest_object_state where protocol = '420Bridge';

create or replace view idx_rights_state as
select * from idx_protocol_latest_object_state where protocol = '420Rights';

create or replace view idx_randomness_state as
select * from idx_protocol_latest_object_state where protocol = '420Randomness';
