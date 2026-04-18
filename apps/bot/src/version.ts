import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Resolve the bot package.json at runtime so the value stays in lock-step with
// the published version without pulling it into the TS compilation graph
// (which would collide with `rootDir: src`).
const here = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(resolve(here, '..', 'package.json'), 'utf8')) as {
  version: string;
};

export const VERSION: string = pkg.version;
