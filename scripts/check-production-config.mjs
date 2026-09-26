import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadEnv } from 'vite';

// This is the Supabase project the owner selected for production. Changing it
// requires an explicit review of the migrations, functions, and legal region.
const productionProjectRef = 'yagchgwgbttxfihlyddm';
const env = loadEnv('production', process.cwd(), 'VITE_');
const problems = [];

let projectRef;
try {
  const url = new URL(env.VITE_SUPABASE_URL ?? '');
  if (url.protocol !== 'https:') throw new Error('HTTPS required');
  projectRef = url.hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1];
} catch {
  // The error below describes the expected configuration without printing it.
}

if (projectRef !== productionProjectRef) {
  problems.push(`VITE_SUPABASE_URL must point to selected project ${productionProjectRef}`);
}
if (!env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()) {
  problems.push('VITE_SUPABASE_PUBLISHABLE_KEY is missing');
}

const legalSource = readFileSync(resolve('src/config/legal.ts'), 'utf8');
const legalPlaceholders = [...legalSource.matchAll(/^\s*(\w+):\s*'TODO_[A-Z_]+'/gm)].map((match) => match[1]);
if (legalPlaceholders.length) {
  problems.push(`Legal configuration is incomplete: ${legalPlaceholders.join(', ')}`);
}

if (problems.length) {
  console.error(`Production build blocked:\n- ${problems.join('\n- ')}`);
  process.exitCode = 1;
} else {
  console.log('Production configuration check passed.');
}
