// Reads every changeset the way the release will, so a malformed one fails its own pull request.
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import parse from '@changesets/parse';

/** Problems in the changesets (file name → content); each release must name a package in `packages`. */
export function checkChangesets(files, packages) {
  const problems = [];
  for (const [file, content] of files) {
    let releases;
    try {
      ({ releases } = parse(content));
    } catch (error) {
      problems.push(`${file}: ${error.message.split('\n')[0]}`);
      continue;
    }
    for (const { name } of releases) {
      if (!packages.has(name)) problems.push(`${file}: no package named ${name} in this workspace`);
    }
  }
  return problems;
}

function main() {
  const dir = '.changeset';
  const names = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  const files = new Map(names.map((f) => [f, readFileSync(join(dir, f), 'utf8')]));
  // A shell, because pnpm is pnpm.cmd on Windows; the command is a fixed string.
  const listed = JSON.parse(execSync('pnpm ls -r --depth -1 --json', { encoding: 'utf8' }));
  const problems = checkChangesets(files, new Set(listed.map((p) => p.name)));
  for (const problem of problems) console.error(problem);
  if (problems.length > 0) process.exit(1);
  console.log(`Changesets: ${files.size} read, all valid`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) main();
