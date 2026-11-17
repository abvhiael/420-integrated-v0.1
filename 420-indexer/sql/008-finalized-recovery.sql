-- Durable high-water mark; nullable for existing checkpoints until reconciled
-- against canonical history by the ingestor. Never infer finality from head age.
alter table idx_checkpoints add column if not exists finalized_number numeric(78,0);
alter table idx_checkpoints add column if not exists finalized_hash text;
