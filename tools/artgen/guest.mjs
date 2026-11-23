// àlejò (guest), drawn in code: the front of a house seen from the yard, the host standing in the open front door with
// arms open in welcome, and an adult visitor arriving with a travel bag over one shoulder and a small wrapped gift.
// The picture model kept adding kneeling figures, balloons and interior doors (owner, 2026-11-20).
// Writes art_candidates/produce/alejo_guest.svg and .png (1024 x 1024).
//   node tools/artgen/guest.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const INK = '#3a2412';
const SKIN = '#8a5232', SKIN2 = '#6e3f24';

// a standing adult in flat clip-art style; (x, y) is the point between the feet
function person({ x, y, h = 360, top = '#2f7fc1', trousers = '#2d3a4f', cap = null, wrapper = null, armsOpen = false, facing = 1 }) {
  const s = h / 360, X = (v) => x + v * s * facing, Y = (v) => y - v * s;
  let o = '';
  // legs (or a wrapper skirt)
  if (wrapper) o += `<path d="M${X(-34)} ${Y(150)} L${X(34)} ${Y(150)} L${X(40)} ${Y(8)} L${X(-40)} ${Y(8)} Z" fill="${wrapper}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  else o += `<path d="M${X(-30)} ${Y(150)} L${X(-24)} ${Y(8)} L${X(-4)} ${Y(8)} L${X(0)} ${Y(120)} L${X(4)} ${Y(8)} L${X(24)} ${Y(8)} L${X(30)} ${Y(150)} Z" fill="${trousers}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  o += `<ellipse cx="${X(-16)}" cy="${Y(4)}" rx="${18 * s}" ry="${7 * s}" fill="${INK}"/><ellipse cx="${X(16)}" cy="${Y(4)}" rx="${18 * s}" ry="${7 * s}" fill="${INK}"/>`;
  // arms (behind the body when down)
  const arm = (side) => armsOpen
    ? `<path d="M${X(side * 36)} ${Y(262)} Q${X(side * 80)} ${Y(250)} ${X(side * 104)} ${Y(290)}" stroke="${SKIN}" stroke-width="${18 * s}" fill="none" stroke-linecap="round"/><circle cx="${X(side * 106)}" cy="${Y(294)}" r="${11 * s}" fill="${SKIN}"/>`
    : `<path d="M${X(side * 38)} ${Y(258)} Q${X(side * 50)} ${Y(200)} ${X(side * 44)} ${Y(160)}" stroke="${SKIN}" stroke-width="${18 * s}" fill="none" stroke-linecap="round"/>`;
  o += arm(-1) + arm(1);
  // top: a long Yoruba-style shirt (buba)
  o += `<path d="M${X(-40)} ${Y(272)} Q${X(0)} ${Y(286)} ${X(40)} ${Y(272)} L${X(46)} ${Y(140)} L${X(-46)} ${Y(140)} Z" fill="${top}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  o += `<path d="M${X(-12)} ${Y(276)} L${X(0)} ${Y(250)} L${X(12)} ${Y(276)}" stroke="${INK}" stroke-width="4" fill="none"/>`;
  // neck and head
  o += `<rect x="${Math.min(X(-9), X(9))}" y="${Y(296)}" width="${18 * s}" height="${24 * s}" fill="${SKIN2}"/>`;
  o += `<ellipse cx="${X(0)}" cy="${Y(322)}" rx="${30 * s}" ry="${34 * s}" fill="${SKIN}" stroke="${INK}" stroke-width="5"/>`;
  // hair or cap
  o += cap ? `<path d="M${X(-30)} ${Y(334)} Q${X(-28)} ${Y(372)} ${X(4)} ${Y(372)} Q${X(34)} ${Y(368)} ${X(30)} ${Y(334)} Z" fill="${cap}" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`
    : `<path d="M${X(-30)} ${Y(328)} Q${X(-30)} ${Y(362)} ${X(0)} ${Y(360)} Q${X(30)} ${Y(362)} ${X(30)} ${Y(328)} Q${X(0)} ${Y(342)} ${X(-30)} ${Y(328)} Z" fill="#1d120a"/>`;
  // face: eyes and a smile, turned slightly towards `facing`
  o += `<circle cx="${X(4)}" cy="${Y(326)}" r="${3.6 * s}" fill="${INK}"/><circle cx="${X(20)}" cy="${Y(326)}" r="${3.6 * s}" fill="${INK}"/>`;
  o += `<path d="M${X(4)} ${Y(306)} Q${X(13)} ${Y(298)} ${X(22)} ${Y(306)}" stroke="${INK}" stroke-width="${3.5 * s}" fill="none" stroke-linecap="round"/>`;
  return o;
}

function scene() {
  let o = '';
  // sky, yard
  o += `<rect width="1024" height="1024" fill="#cfeefc"/><rect y="760" width="1024" height="264" fill="#e9c98f"/>`;
  o += `<ellipse cx="180" cy="150" rx="90" ry="34" fill="#fff"/><ellipse cx="250" cy="130" rx="70" ry="30" fill="#fff"/>`;
  // the house front: plastered wall, corrugated roof, window, open front door
  o += `<rect x="60" y="300" width="620" height="470" fill="#f2d3a2" stroke="${INK}" stroke-width="7"/>`;
  o += `<path d="M30 310 L370 180 L710 310 Z" fill="#b5523b" stroke="${INK}" stroke-width="7" stroke-linejoin="round"/>`;
  for (let i = 1; i < 12; i++) o += `<path d="M${30 + i * 57} ${310 - (i < 6 ? i * 22 : (12 - i) * 22)} L${30 + i * 57} 310" stroke="#8f3d2a" stroke-width="3"/>`;
  o += `<rect x="70" y="700" width="600" height="70" fill="#d9b27a"/>`; // a darker band at the foot of the wall
  // window with bars
  o += `<rect x="110" y="420" width="150" height="130" fill="#7cb9de" stroke="${INK}" stroke-width="6"/>`;
  for (const x of [148, 185, 222]) o += `<path d="M${x} 420 V550" stroke="${INK}" stroke-width="4"/>`;
  // front door: dark opening with the door swung inward, a step in front
  o += `<rect x="370" y="420" width="190" height="350" fill="#3b2a1f" stroke="${INK}" stroke-width="7"/>`;
  o += `<path d="M370 420 L420 440 L420 750 L370 770 Z" fill="#9a5a2c" stroke="${INK}" stroke-width="5" stroke-linejoin="round"/>`;
  o += `<rect x="350" y="770" width="230" height="22" fill="#cdb38a" stroke="${INK}" stroke-width="5"/>`;
  // a potted plant by the wall
  o += `<path d="M620 770 L640 700 L700 700 L720 770 Z" fill="#c26b3a" stroke="${INK}" stroke-width="5"/><path d="M670 700 Q640 620 610 600 M670 700 Q680 610 720 590 M670 700 Q700 640 740 640" stroke="#3f8a3a" stroke-width="12" fill="none" stroke-linecap="round"/>`;
  // the host in the doorway, arms open
  o += person({ x: 468, y: 772, h: 330, top: '#2f8f5b', trousers: '#2d3a4f', cap: '#7a2f4f', armsOpen: true, facing: 1 });
  // the visitor arriving from the right: travel bag over the shoulder, gift in hand, walking towards the door
  // bag first, so it hangs behind the visitor's far side: strap over the shoulder, bag at the hip
  o += `<path d="M672 560 Q720 600 745 668" stroke="${INK}" stroke-width="8" fill="none"/>`;
  o += `<path d="M722 664 L790 664 L784 730 Q756 740 728 730 Z" fill="#2e4a6b" stroke="${INK}" stroke-width="6" stroke-linejoin="round"/><path d="M724 686 H788" stroke="#1d3049" stroke-width="5"/>`;
  o += person({ x: 700, y: 860, h: 380, top: '#e3a32b', wrapper: '#5b3f9e', facing: -1 });
  // gift held out in front of the visitor
  o += `<rect x="580" y="660" width="66" height="58" fill="#e04b4b" stroke="${INK}" stroke-width="5"/><path d="M613 660 V718 M580 689 H646" stroke="#ffd34d" stroke-width="8"/><path d="M613 660 q-18 -26 -28 -6 q12 10 28 6 q18 -26 28 -6 q-12 10 -28 6" fill="#ffd34d" stroke="${INK}" stroke-width="3"/>`;
  o += `<path d="M664 610 Q650 660 640 690" stroke="${SKIN}" stroke-width="18" fill="none" stroke-linecap="round"/>`; // forearm out to the gift
  return o;
}

const out = path.resolve('dev/games/art_candidates/produce');
fs.mkdirSync(out, { recursive: true });
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="190 175 760 760">${scene()}</svg>`;
fs.writeFileSync(path.join(out, 'alejo_guest.svg'), svg);
const html = path.join(os.tmpdir(), 'alejo_guest.html');
fs.writeFileSync(html, `<body style="margin:0;background:#fff">${svg}</body>`);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--screenshot=${path.join(out, 'alejo_guest.png')}`, '--window-size=1024,1024', `file:///${html}`], { stdio: 'ignore' });
console.log('wrote alejo_guest');
