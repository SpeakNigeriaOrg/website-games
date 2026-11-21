// Copies the Yorùbá game suite from a checkout's dev/games/ into this repo's public/, so it deploys at the site
// root next to the landing page and the older games: /path/, /river/, ..., /content/, /engine/, /art/.
//
// Left out: the dev "Games Lab" index (index.html: public/index.html is the landing page), the deprecated Frog Pond
// (pond/), and work in progress (art_candidates/, numbers/ and videos/ review pages, eq-listen/, notes).
//
//   node tools/assemble_site.mjs [--from <dir containing dev/games>]   (default: this repo)
// Run after every kit and path rebuild, then commit public/.
import fs from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const fromArg = process.argv.indexOf('--from');
const SRC = path.join(fromArg > 0 ? process.argv[fromArg + 1] : REPO, 'dev', 'games');
const DST = path.join(REPO, 'public');

const SKIP = new Set(['index.html', 'README.md', 'pond', 'art_candidates', 'numbers', 'videos', 'eq-listen']);
// dev notes, test play scripts and the path builder are not part of the site
const SKIP_FILE = (name) => name.endsWith('.md') || name.endsWith('.mjs') || name === 'test';
// folders this script owns in public/ (removed and copied fresh each run, so deleted files don't linger)
const PUBLIC_OWN = new Set(['phonics', 'tones', 'vocab', 'analytics', 'assets']);

let files = 0, bytes = 0;
function copy(src, dst) {
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.mkdirSync(dst, { recursive: true });
    for (const name of fs.readdirSync(src)) if (!SKIP_FILE(name)) copy(path.join(src, name), path.join(dst, name));
  } else {
    if (st.size > 25 * 1024 * 1024) throw new Error(`${src} is over Cloudflare Pages' 25 MiB file limit`);
    fs.copyFileSync(src, dst);
    files++; bytes += st.size;
  }
}

for (const name of fs.readdirSync(SRC)) {
  if (SKIP.has(name)) continue;
  if (PUBLIC_OWN.has(name)) throw new Error(`dev/games/${name} would overwrite public/${name}`);
  const dst = path.join(DST, name);
  fs.rmSync(dst, { recursive: true, force: true });
  copy(path.join(SRC, name), dst);
}
console.log(`copied ${files} files (${(bytes / 1024 / 1024).toFixed(1)} MB) from ${SRC} into ${DST}`);
