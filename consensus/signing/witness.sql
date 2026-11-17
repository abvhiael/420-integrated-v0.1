create table if not exists stake_signing_witness_v1 (
 identity text primary key, generation bigint not null check(generation>=0),
 history bytea not null, digest text not null);
