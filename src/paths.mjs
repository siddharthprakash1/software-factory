import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
// The FACTORY_* variables let tests (and unusual setups) relocate config, memory and data.
const env = (name, fallback) => (process.env[name] ? path.resolve(process.env[name]) : fallback);

export const CONFIG_FILE = env('FACTORY_CONFIG', path.join(ROOT, 'factory.config.mjs'));

// Lessons learned per repo; committed.
export const MEMORY = env('FACTORY_MEMORY', path.join(ROOT, 'memory'));

// Everything the factory generates lives under .factory/ and is not committed.
export const DATA = env('FACTORY_DATA', path.join(ROOT, '.factory'));
export const RUNS = path.join(DATA, 'runs');
export const WORKSPACES = path.join(DATA, 'workspaces');
export const INBOX = path.join(DATA, 'inbox');
export const EVALS = path.join(DATA, 'evals');

export const runDir = (id) => path.join(RUNS, id);
