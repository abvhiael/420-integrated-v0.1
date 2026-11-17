import { mkdir, readFile, rename, unlink, open, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { IndexCheckpoint420 } from './indexing.js';

export interface CheckpointStore420 {
  load(): Promise<IndexCheckpoint420 | null>;
  save(checkpoint: IndexCheckpoint420): Promise<void>;
  clear(): Promise<void>;
}

export class MemoryCheckpointStore420 implements CheckpointStore420 {
  private checkpoint: IndexCheckpoint420 | null = null;

  async load(): Promise<IndexCheckpoint420 | null> {
    return this.checkpoint ? { ...this.checkpoint } : null;
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    this.checkpoint = { ...checkpoint };
  }

  async clear(): Promise<void> {
    this.checkpoint = null;
  }
}

interface SerializedCheckpoint420 {
  version: 1;
  chainId: string;
  blockNumber: string;
  blockHash: string;
  parentHash: string;
  finalizedNumber?: string;
  finalizedHash?: string;
}

export class FileCheckpointStore420 implements CheckpointStore420 {
  constructor(readonly path: string) {}

  async load(): Promise<IndexCheckpoint420 | null> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw error;
    }
    const parsed = JSON.parse(raw) as SerializedCheckpoint420;
    if (parsed.version !== 1) throw new Error(`unsupported checkpoint version: ${String(parsed.version)}`);
    return {
      chainId: BigInt(parsed.chainId),
      blockNumber: BigInt(parsed.blockNumber),
      blockHash: parsed.blockHash as `0x${string}`,
      parentHash: parsed.parentHash as `0x${string}`,
      ...(parsed.finalizedNumber !== undefined ? { finalizedNumber: BigInt(parsed.finalizedNumber), finalizedHash: parsed.finalizedHash as `0x${string}` } : {})
    };
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    const payload: SerializedCheckpoint420 = {
      version: 1,
      chainId: checkpoint.chainId.toString(),
      blockNumber: checkpoint.blockNumber.toString(),
      blockHash: checkpoint.blockHash,
      parentHash: checkpoint.parentHash,
      finalizedNumber: checkpoint.finalizedNumber?.toString(),
      finalizedHash: checkpoint.finalizedHash
    };
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    const file = await open(temporary, 'r+');
    try { await file.sync(); } finally { await file.close(); }
    await rename(temporary, this.path);
    const directory = await open(dirname(this.path), 'r');
    try { await directory.sync(); } finally { await directory.close(); }
  }

  async clear(): Promise<void> {
    try {
      await unlink(this.path);
      const directory = await open(dirname(this.path), 'r');
      try { await directory.sync(); } finally { await directory.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
}
