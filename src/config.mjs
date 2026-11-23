import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT, CONFIG_FILE } from './paths.mjs';

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over ?? {})) out[k] = isObject(v) && isObject(base[k]) ? merge(base[k], v) : v;
  return out;
}

export async function loadConfig(variant) {
  const config = (await import(pathToFileURL(CONFIG_FILE))).default;
  if (!variant) return config;
  if (!config.variants?.[variant]) throw new Error(`unknown variant "${variant}"`);
  return merge(config, config.variants[variant]);
}

// Accepts a name from config.repos or a filesystem path.
export function resolveRepo(config, nameOrPath) {
  const key = nameOrPath ?? config.defaultRepo;
  const def = config.repos?.[key];
  if (def) return { verify: [], ...def, name: key, path: path.resolve(ROOT, def.path) };
  return { name: path.basename(path.resolve(key)), path: path.resolve(key), verify: [] };
}

export const repoByGithub = (config, slug) =>
  Object.keys(config.repos ?? {}).find((k) => config.repos[k].github?.toLowerCase() === slug.toLowerCase());

// A stage's model is either a name or a map keyed by triage complexity.
export function resolveModel(stageDef, complexity) {
  const m = stageDef.model;
  return typeof m === 'string' ? m : m[complexity] ?? m.medium ?? Object.values(m)[0];
}
