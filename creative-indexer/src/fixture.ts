import { readFile } from 'node:fs/promises';
import type { Decision10Fixture } from './types.js';

export async function loadDecision10Fixture(path: string): Promise<Decision10Fixture> {
  const raw = await readFile(path, 'utf8');
  const parsed = JSON.parse(raw) as Decision10Fixture;
  if (parsed.schema !== '420.creative.kernel.fixture.v1') {
    throw new Error(`unsupported fixture schema: ${parsed.schema}`);
  }
  return parsed;
}
