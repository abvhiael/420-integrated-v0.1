import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { IndexCheckpoint420 } from './indexing.js';

export interface CheckpointStore420 {
  load(): Promise<IndexCheckpoint420 | null>;
  save(checkpoint: IndexCheckpoint420): Promise<void>;
}

export class MemoryCheckpointStore420 implements CheckpointStore420 {
  private checkpoint: IndexCheckpoint420 | null = null;

  async load(): Promise<IndexCheckpoint420 | null> {
    return this.checkpoint ? { ...this.checkpoint } : null;
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    this.checkpoint = { ...checkpoint };
  }
}

interface SerializedCheckpoint420 {
  version: 1;
  chainId: string;
  blockNumber: string;
  blockHash: string;
  parentHash: string;
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
      parentHash: parsed.parentHash as `0x${string}`
    };
  }

  async save(checkpoint: IndexCheckpoint420): Promise<void> {
    const payload: SerializedCheckpoint420 = {
      version: 1,
      chainId: checkpoint.chainId.toString(),
      blockNumber: checkpoint.blockNumber.toString(),
      blockHash: checkpoint.blockHash,
      parentHash: checkpoint.parentHash
    };
    await mkdir(dirname(this.path), { recursive: true });
    const temporary = `${this.path}.tmp`;
    await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    await rename(temporary, this.path);
  }
}
