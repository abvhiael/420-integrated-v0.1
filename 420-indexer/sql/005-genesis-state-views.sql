create or replace view idx_protocol_object_events as
select
  e.*,
  coalesce(
    e.fields->>'objectId',
    e.fields->>'componentId',
    e.fields->>'labelHash',
    e.fields->>'profileId',
    e.fields->>'credentialId',
    e.fields->>'issuerId',
    e.fields->>'validatorId',
    e.fields->>'proposalId',
    e.fields->>'paymentId',
    e.fields->>'routeId',
    e.fields->>'messageId',
    e.fields->>'requestId',
    e.fields->>'rightId',
    e.fields->>'assetId'
  ) as object_key,
  case
    when e.protocol = '420Identity' then
      case e.event_name
        when 'ProfileCreated' then 'ACTIVE'
        when 'ProfileUpdated' then
          case lower(coalesce(e.fields->>'active',''))
            when 'true' then 'ACTIVE'
            when 'false' then 'INACTIVE'
            else null
          end
        when 'PrimaryNameSet' then 'PRIMARY_NAME_UPDATED'
        when 'ProfileControllerTransferStarted' then 'PENDING_CONTROLLER_TRANSFER'
        when 'ProfileControllerTransferred' then 'CONTROLLER_TRANSFERRED'
        when 'IssuerSet' then
          case lower(coalesce(e.fields->>'active',''))
            when 'true' then 'ACTIVE'
            when 'false' then 'INACTIVE'
            else 'ISSUER_UPDATED'
          end
        when 'CredentialIssued' then 'ACTIVE'
        when 'CredentialRevoked' then 'REVOKED'
        when 'CredentialRejected' then 'REJECTED'
        else null
      end
    else coalesce(
      e.fields->>'stateAfter',
      e.fields->>'status',
      e.fields->>'state',
      e.fields->>'active'
    )
  end as lifecycle_state
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
