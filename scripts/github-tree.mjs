// Read-only bridge for the authorized GitHub connector. Contains no credentials.
import { execFileSync } from 'node:child_process';
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const paths = git('diff', '--name-only', 'HEAD~1', 'HEAD').trim().split('\n').filter(Boolean);
const tracked = new Set(git('ls-files').trim().split('\n'));
const entries = paths.map(path => tracked.has(path) ? { path, mode: '100644', type: 'blob', content: git('show', `HEAD:${path}`) } : { path, mode: '100644', type: 'blob', sha: null });
process.stdout.write(JSON.stringify(entries));
