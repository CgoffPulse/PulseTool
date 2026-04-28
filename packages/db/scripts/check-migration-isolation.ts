#!/usr/bin/env tsx
/**
 * Schema-isolation linter for migrations.
 *
 * Convention: filenames are `NNNN_<schema>_<name>.sql` (e.g.
 * `0004_dev_dev_hub_init.sql`). A migration is allowed to touch ONLY the
 * schema declared in its filename. Cross-schema work requires an explicit
 * opt-in: filename `NNNN_cross_<a>_<b>_<name>.sql` AND a comment line
 * `-- @cross-schema: <reason>` somewhere in the file.
 *
 * Catches the 2am-typo class of bug where a "dev" migration silently
 * references `public.*`. Cheap, automated, runs before destructive work.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

const KNOWN_SCHEMAS = ['public', 'dev', 'crm', 'voice', 'analytics'];

interface Violation {
  file: string;
  rule: string;
  detail: string;
}

function parseFilename(file: string): { schemas: string[]; isCross: boolean } | null {
  // `NNNN_<schema>_<name>.sql` — match the schema as the first segment after digits.
  // Cross-schema: `NNNN_cross_<a>_<b>_<name>.sql`.
  const numMatch = file.match(/^(\d{4})_(.+)\.sql$/);
  if (!numMatch) return null;
  const rest = numMatch[2];
  if (rest.startsWith('cross_')) {
    const tail = rest.slice('cross_'.length).split('_');
    const schemas: string[] = [];
    for (const part of tail) {
      if (KNOWN_SCHEMAS.includes(part)) schemas.push(part);
      else break;
    }
    if (schemas.length < 2) return null;
    return { schemas, isCross: true };
  }
  for (const s of KNOWN_SCHEMAS) {
    if (rest === s || rest.startsWith(s + '_')) {
      return { schemas: [s], isCross: false };
    }
  }
  return null;
}

function findSchemaReferences(sql: string): Set<string> {
  const seen = new Set<string>();
  for (const schema of KNOWN_SCHEMAS) {
    const re = new RegExp(`\\b${schema}\\.[a-zA-Z_]`, 'g');
    if (re.test(sql)) seen.add(schema);
  }
  return seen;
}

async function main() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    console.log('No migrations found.');
    return;
  }

  const violations: Violation[] = [];

  for (const file of files) {
    const parsed = parseFilename(file);
    if (!parsed) {
      violations.push({
        file,
        rule: 'naming',
        detail: `filename does not match NNNN_<schema>_<name>.sql (allowed schemas: ${KNOWN_SCHEMAS.join(', ')}, or cross_<a>_<b>_)`,
      });
      continue;
    }

    const sql = await readFile(path.join(MIGRATIONS_DIR, file), 'utf8');
    const referenced = findSchemaReferences(sql);

    if (parsed.isCross) {
      if (!/--\s*@cross-schema:/i.test(sql)) {
        violations.push({
          file,
          rule: 'cross-schema-justification',
          detail: 'cross_*.sql migrations must include a `-- @cross-schema: <reason>` comment',
        });
      }
      for (const r of referenced) {
        if (!parsed.schemas.includes(r)) {
          violations.push({
            file,
            rule: 'cross-schema-undeclared',
            detail: `references ${r}.* but filename only declares ${parsed.schemas.join(', ')}`,
          });
        }
      }
    } else {
      const declared = parsed.schemas[0];
      for (const r of referenced) {
        if (r !== declared) {
          violations.push({
            file,
            rule: 'schema-isolation',
            detail: `references ${r}.* but filename declares ${declared} — cross-schema work requires renaming to cross_<a>_<b>_*.sql with a -- @cross-schema: comment`,
          });
        }
      }
    }
  }

  if (violations.length === 0) {
    console.log(`✔ ${files.length} migration(s) pass schema-isolation checks.`);
    return;
  }

  console.error(`✖ ${violations.length} migration violation(s):\n`);
  for (const v of violations) {
    console.error(`  [${v.rule}] ${v.file}`);
    console.error(`    ${v.detail}\n`);
  }
  process.exit(1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
