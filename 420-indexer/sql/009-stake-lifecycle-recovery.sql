-- Rebuildable canonical lifecycle projection. Mirrors the retained Stake
-- reducer, including terminal-state absorption and non-state-changing events.
create or replace view idx_stake_state as
with lifecycle as (
  select e.*,
    'validatorId:' || lower(e.fields->>'validatorId') as object_key,
    case
      when e.event_name='ValidatorRegistered' then 'PENDING'
      when e.event_name='ExitNoticeApplied' then 'PENDING'
      when e.event_name='ValidatorBondWithdrawn' then 'COMPLETED'
      else case coalesce(e.fields->>'newStatus', e.fields->>'resultingStatus')
        when '1' then 'PENDING' when '2' then 'PENDING'
        when '3' then 'ACTIVE' when '4' then 'ACTIVE'
        when '5' then 'PENDING' when '6' then 'FAILED'
        when '7' then 'COMPLETED' when '8' then 'PENDING'
        when '9' then 'PENDING'
        else case when e.event_name='SlashApplied' then 'FAILED' else 'UNKNOWN' end
      end
    end as lifecycle_state,
    (e.event_name='ValidatorBondWithdrawn' or coalesce(e.fields->>'newStatus',e.fields->>'resultingStatus','')='7') as terminal
  from idx_protocol_events e
  join idx_blocks b on b.chain_id=e.chain_id and b.block_number=e.block_number and b.block_hash=e.block_hash
  join idx_checkpoints c on c.chain_id=e.chain_id and c.block_number>=e.block_number
  where e.protocol='420Stake' and e.fields ? 'validatorId'
    and e.event_name in ('ValidatorRegistered','ConsensusStateApplied','ExitNoticeApplied','SlashApplied','ValidatorBondWithdrawn')
), ranked as (
  select *, row_number() over (partition by chain_id, object_key order by
    terminal desc,
    case when terminal then block_number end asc,
    case when terminal then tx_index end asc,
    case when terminal then log_index end asc,
    block_number desc, tx_index desc, log_index desc) as rank
  from lifecycle
)
select chain_id,protocol,object_key,contract_address,event_name,lifecycle_state,fields,
  block_number,block_hash,tx_hash,tx_index,log_index
from ranked where rank=1;
