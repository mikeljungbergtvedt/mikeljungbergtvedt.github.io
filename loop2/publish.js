'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { parseJsonl } = require('./schema');

function looksLikePagesRepo(dir) {
  if (!dir) return false;
  try {
    return fs.existsSync(path.join(dir, 'bot4-measurements.jsonl'))
      || fs.existsSync(path.join(dir, 'peasy-pulse.html'));
  } catch (_e) {
    return false;
  }
}

function findPagesRepo() {
  const envDir = process.env.LOOP2_PAGES_DIR;
  const candidates = [
    envDir,
    path.resolve(__dirname, '..'),
    '/Users/bot/mikeljungbergtvedt.github.io',
    path.join(os.homedir(), 'mikeljungbergtvedt.github.io'),
  ].filter(Boolean);
  for (const d of candidates) {
    if (looksLikePagesRepo(d)) return path.resolve(d);
  }
  return path.resolve(__dirname, '..');
}

function defaultJsonlPath() {
  if (process.env.LOOP2_JSONL) return path.resolve(process.env.LOOP2_JSONL);
  return path.join(findPagesRepo(), 'loop2-measurements.jsonl');
}

function readExisting(file) {
  if (!fs.existsSync(file)) return '';
  return fs.readFileSync(file, 'utf8');
}

function appendMeasurements(file, records) {
  const recs = Array.isArray(records) ? records : [records];
  const lines = recs.map((r) => JSON.stringify(r));
  let prev = readExisting(file);
  if (prev && !prev.endsWith('\n')) prev += '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, prev + lines.join('\n') + (lines.length ? '\n' : ''));
  return { file, appended: recs.length, total: parseJsonl(readExisting(file)).length };
}

/**
 * Same publish path as bot4-measurements.jsonl: commit the file in this GitHub Pages repo.
 * Message style: "loop2 measurements update <ISO>"
 */
function commitPages(file, opts) {
  const o = opts || {};
  const repo = o.repo || findPagesRepo();
  const rel = path.relative(repo, file);
  if (rel.startsWith('..')) {
    throw new Error('jsonl is outside pages repo: ' + file);
  }
  const iso = o.timestamp || new Date().toISOString().replace(/\.\d{3}Z$/, '');
  const msg = o.message || ('loop2 measurements update ' + iso);
  execFileSync('git', ['add', rel], { cwd: repo, stdio: 'inherit' });
  try {
    execFileSync('git', ['diff', '--staged', '--quiet'], { cwd: repo });
    return { committed: false, reason: 'no changes' };
  } catch (_e) {
    /* staged diff exists */
  }
  execFileSync('git', ['commit', '-m', msg], { cwd: repo, stdio: 'inherit' });
  if (o.push !== false) {
    execFileSync('git', ['push'], { cwd: repo, stdio: 'inherit' });
  }
  return { committed: true, message: msg, repo, file: rel };
}

module.exports = {
  findPagesRepo,
  defaultJsonlPath,
  appendMeasurements,
  commitPages,
  readExisting,
};
