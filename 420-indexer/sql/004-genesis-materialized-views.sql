create or replace view idx_registry_events as
select * from idx_protocol_events where protocol = '420Registry';

create or replace view idx_names_events as
select * from idx_protocol_events where protocol = '420Names';

create or replace view idx_identity_events as
select * from idx_protocol_events where protocol = '420Identity';

create or replace view idx_stake_events as
select * from idx_protocol_events where protocol = '420Stake';

create or replace view idx_governance_events as
select * from idx_protocol_events where protocol = '420Governance';

create or replace view idx_treasury_events as
select * from idx_protocol_events where protocol = '420Treasury';

create or replace view idx_pay_events as
select * from idx_protocol_events where protocol = '420Pay';

create or replace view idx_swap_events as
select * from idx_protocol_events where protocol = '420Swap';

create or replace view idx_exchange_events as
select * from idx_protocol_events where protocol = '420Exchange';

create or replace view idx_bridge_events as
select * from idx_protocol_events where protocol = '420Bridge';

create or replace view idx_rights_events as
select * from idx_protocol_events where protocol = '420Rights';

create or replace view idx_randomness_events as
select * from idx_protocol_events where protocol = '420Randomness';
