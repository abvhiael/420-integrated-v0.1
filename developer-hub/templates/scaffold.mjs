#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../..');
const registry = JSON.parse(await readFile(resolve(here, 'registry.json'), 'utf8'));

function fail(message) { console.error(`DEVHUB7_ERROR=${message}`); process.exit(2); }
function safeProjectName(name) { return typeof name === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(name) && !name.includes('..'); }
function templateById(id) { return registry.templates.find((entry) => entry.id === id) ?? null; }
function inside(base, target) { const rel = relative(base, target); return rel === '' || (!rel.startsWith('..') && !rel.startsWith(sep)); }

async function replaceTokens(path, projectName) {
  for (const entry of await readdir(path)) {
    const full = resolve(path, entry);
    const info = await stat(full);
    if (info.isDirectory()) await replaceTokens(full, projectName);
    else {
      const text = await readFile(full, 'utf8');
      await writeFile(full, text.replaceAll('{{projectName}}', projectName), 'utf8');
    }
  }
}

async function create(id, name, targetArg) {
  const template = templateById(id);
  if (!template) fail(`unknown template: ${id}`);
  if (!safeProjectName(name)) fail('project name is invalid');
  const source = resolve(repoRoot, template.source);
  if (!inside(resolve(repoRoot, 'developer-hub/templates/starters'), source)) fail('template source escaped starter root');
  const target = resolve(process.cwd(), targetArg ?? name);
  if (existsSync(target)) fail(`target already exists: ${target}`);
  await mkdir(dirname(target), { recursive: true });
  await cp(source, target, { recursive: true, errorOnExist: true });
  await replaceTokens(target, name);
  process.stdout.write(`${JSON.stringify({ ok: true, template: id, projectName: name, target }, null, 2)}\n`);
}

const [command = 'list', ...args] = process.argv.slice(2);
if (command === 'list') {
  process.stdout.write(`${JSON.stringify({ schemaVersion: registry.schemaVersion, templates: registry.templates }, null, 2)}\n`);
} else if (command === 'create') {
  await create(args[0], args[1], args[2]);
} else fail(`unknown command: ${command}`);
