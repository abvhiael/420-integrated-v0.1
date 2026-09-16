import fs from 'node:fs';
import path from 'node:path';
import { BongGogglesProjector, digest } from './projector.js';
import { materializeState } from './materializedViews.js';

function stableEnvelope(projector) {
  const snapshot = projector.snapshot();
  return {
    version: 1,
    schemaHash: projector.schemaHash,
    chainId: projector.chainId,
    snapshot,
    events: structuredClone(projector.events),
    eventStreamDigest: digest(projector.events),
  };
}

export class PersistentProjectionStore {
  constructor(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) throw new Error('filePath required');
    this.filePath = filePath;
  }

  save(projector) {
    const envelope = stableEnvelope(projector);
    const dir = path.dirname(this.filePath);
    fs.mkdirSync(dir, { recursive: true });
    const tempPath = `${this.filePath}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(envelope)}\n`, { encoding: 'utf8', mode: 0o600 });
    fs.renameSync(tempPath, this.filePath);
    return envelope.snapshot;
  }

  load({ schemaHash, chainId }) {
    if (!fs.existsSync(this.filePath)) return null;
    const envelope = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
    if (envelope.version !== 1) throw new Error('unsupported projection store version');
    if (envelope.schemaHash !== schemaHash) throw new Error('projection schema mismatch');
    if (envelope.chainId !== chainId) throw new Error('projection chain mismatch');
    if (!Array.isArray(envelope.events)) throw new Error('invalid persisted event stream');
    if (digest(envelope.events) !== envelope.eventStreamDigest) throw new Error('persisted event stream digest mismatch');

    const projector = BongGogglesProjector.rebuild({ schemaHash, chainId, events: envelope.events });
    const rebuilt = projector.snapshot();
    if (rebuilt.stateRoot !== envelope.snapshot?.stateRoot) throw new Error('persisted state root mismatch');
    if (rebuilt.indexedBlock !== envelope.snapshot?.indexedBlock) throw new Error('persisted checkpoint mismatch');
    if (rebuilt.indexedBlockHash !== envelope.snapshot?.indexedBlockHash) throw new Error('persisted checkpoint hash mismatch');
    return projector;
  }

  recover({ schemaHash, chainId, canonicalBlockHash }) {
    const projector = this.load({ schemaHash, chainId });
    if (!projector) return { projector: new BongGogglesProjector({ schemaHash, chainId }), recovered: false, reorg: false };

    const snapshot = projector.snapshot();
    if (snapshot.indexedBlock === 0 || snapshot.indexedBlockHash === null) {
      return { projector, recovered: true, reorg: false };
    }

    if (typeof canonicalBlockHash !== 'function') throw new Error('canonicalBlockHash resolver required');
    const canonicalHash = canonicalBlockHash(snapshot.indexedBlock);
    if (canonicalHash === snapshot.indexedBlockHash) return { projector, recovered: true, reorg: false };

    const events = structuredClone(projector.events);
    let rollbackBlock = snapshot.indexedBlock;
    while (rollbackBlock > 0) {
      rollbackBlock -= 1;
      const persistedHash = projector.blockHashes.get(rollbackBlock);
      if (!persistedHash) continue;
      if (canonicalBlockHash(rollbackBlock) === persistedHash) break;
    }

    const retained = events.filter((event) => event.blockNumber <= rollbackBlock);
    const recoveredProjector = BongGogglesProjector.rebuild({ schemaHash, chainId, events: retained });
    this.save(recoveredProjector);
    return { projector: recoveredProjector, recovered: true, reorg: true, rollbackBlock };
  }

  inspect({ schemaHash, chainId }) {
    const projector = this.load({ schemaHash, chainId });
    if (!projector) return null;
    const view = materializeState(projector);
    return { snapshot: projector.snapshot(), viewDigest: view.viewDigest };
  }
}
