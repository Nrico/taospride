import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const releaseDir = join(projectRoot, 'release');
const publicHtmlDir = join(releaseDir, 'public_html');
const archivePath = join(releaseDir, 'taospride-cpanel.zip');
const migrationPath = join(releaseDir, 'RUN-IN-PHPMYADMIN.sql');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const copy = async (source, destination) => {
  await mkdir(dirname(destination), { recursive: true });
  await cp(source, destination, {
    recursive: true,
    filter: path => basename(path) !== '.DS_Store',
  });
};

console.log('\nBuilding the React/Vite site...\n');
run(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'build']);

console.log('\nPreparing the cPanel public_html package...\n');
await rm(releaseDir, { recursive: true, force: true });
await mkdir(publicHtmlDir, { recursive: true });

// Vite output belongs directly in public_html.
await copy(join(projectRoot, 'dist'), publicHtmlDir);
await copy(join(projectRoot, '.htaccess'), join(publicHtmlDir, '.htaccess'));

// Production PHP code. api/config.php is intentionally NOT included: it
// contains live database credentials and must remain untouched on GoDaddy.
for (const file of ['index.php', 'board.php', 'gallery.php', '.htaccess', 'php.ini']) {
  await copy(join(projectRoot, 'api', file), join(publicHtmlDir, 'api', file));
}

// Include access-protection files, but never include existing uploaded data.
await copy(
  join(projectRoot, 'api', 'board_uploads', '.htaccess'),
  join(publicHtmlDir, 'api', 'board_uploads', '.htaccess'),
);
await mkdir(join(publicHtmlDir, 'api', 'vault_uploads'), { recursive: true });
await writeFile(join(publicHtmlDir, 'api', 'vault_uploads', '.htaccess'), 'Deny from all\n');

const instructions = `TAOS PRIDE CPANEL RELEASE
=========================

Created: ${new Date().toISOString()}

1. Back up the production database.
2. In phpMyAdmin, run RUN-IN-PHPMYADMIN.sql once. Never run it twice.
3. Complete the password-hash migration described in DEPLOY.md if it has not
   already been completed.
4. In cPanel File Manager, open public_html.
5. Upload taospride-cpanel.zip into public_html.
6. Select the ZIP and choose Extract. Extract into public_html itself.
7. Confirm overwrite when cPanel asks.
8. Delete the uploaded ZIP from the server after extraction.
9. Visit https://taospride.org and https://taospride.org/api/health.

This package deliberately excludes:
- api/config.php (production database credentials)
- gallery-photos/ (uploaded gallery originals and thumbnails)
- api/board_uploads/ contents
- api/vault_uploads/ contents

Extracting the ZIP over the existing site preserves those server-only files.
Do not delete public_html or the existing api/config.php before extracting.
`;

await writeFile(join(releaseDir, 'UPLOAD-INSTRUCTIONS.txt'), instructions);
await copy(
  join(projectRoot, 'database', 'migrations', '2026-09-28-event-lifecycle.sql'),
  migrationPath,
);

// The ZIP contains the contents of public_html at its root, so extracting it
// while inside cPanel's public_html directory puts every file in the right spot.
run('zip', ['-r', '-q', archivePath, '.'], { cwd: publicHtmlDir });

console.log('Release ready:');
console.log(`  ${archivePath}`);
console.log(`  ${join(releaseDir, 'UPLOAD-INSTRUCTIONS.txt')}`);
console.log(`  ${migrationPath}`);
console.log('\nThe live api/config.php and uploaded photos are not in the ZIP and will not be overwritten.\n');
