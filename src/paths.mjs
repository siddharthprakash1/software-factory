import path from 'node:path';

export const ROOT = path.resolve(import.meta.dirname, '..');
export const CONFIG_FILE = path.join(ROOT, 'factory.config.mjs');

// Lessons learned per repo; committed.
export const MEMORY = path.join(ROOT, 'memory');

// Everything the factory generates lives under .factory/ and is not committed.
export const DATA = path.join(ROOT, '.factory');
export const RUNS = path.join(DATA, 'runs');
export const WORKSPACES = path.join(DATA, 'workspaces');
export const INBOX = path.join(DATA, 'inbox');
export const EVALS = path.join(DATA, 'evals');

export const runDir = (id) => path.join(RUNS, id);
