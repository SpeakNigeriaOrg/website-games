// kékeré (small), drawn in code: a big man holding a big clay pot and a small boy holding the same pot, small, both
// facing us on one ground line; the boy and his pot get circled afterwards. The owner’s idea (2026-11-20): the
// same thing in two sizes, held by a big and a small person, so "small" is the one thing that differs.
// Writes art_candidates/produce/kekere_hold.png (1024 x 1024).
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const INK = "#3a2412";
const SKIN = "#8a5232", SKIN2 = "#6e3f24";
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

function pot(cx, base, s, shadow = true) {
  // a round-bellied clay pot with a short neck and rim, drawn s times its 100-unit size
  const W = 100 * s, H = 110 * s;
  return (shadow ? `<ellipse cx="${cx}" cy="${base - 2}" rx="${W * 0.6}" ry="${9 * s}" fill="#00000022"/>` : "") +
    `<path d="M${cx - W * 0.32} ${base - H} Q${cx - W * 0.95} ${base - H * 0.55} ${cx - W * 0.42} ${base - 4 * s} Q${cx} ${base + 6 * s} ${cx + W * 0.42} ${base - 4 * s} Q${cx + W * 0.95} ${base - H * 0.55} ${cx + W * 0.32} ${base - H} Z" fill="#c8693a" stroke="${INK}" stroke-width="${Math.max(4, 3 * s)}" stroke-linejoin="round"/>` +
    `<path d="M${cx - W * 0.55} ${base - H * 0.55} Q${cx} ${base - H * 0.45} ${cx + W * 0.55} ${base - H * 0.55}" stroke="#9c4a24" stroke-width="${2.5 * s}" fill="none"/>` +
    `<rect x="${cx - W * 0.38}" y="${base - H - 14 * s}" width="${W * 0.76}" height="${16 * s}" rx="${6 * s}" fill="#b55c31" stroke="${INK}" stroke-width="${Math.max(4, 3 * s)}"/>` +
    `<path d="M${cx - W * 0.5} ${base - H * 0.75} Q${cx - W * 0.6} ${base - H * 0.5} ${cx - W * 0.45} ${base - H * 0.3}" stroke="#ffffff55" stroke-width="${6 * s}" fill="none" stroke-linecap="round"/>`;
}

// hands on either side of a pot held in front of the body at height y
const hands = (cx, y, half, s) => [-1, 1].map((d) => `<circle cx="${cx + d * half}" cy="${y}" r="${11 * s}" fill="${SKIN}" stroke="${INK}" stroke-width="3"/>`).join("");
const ground = 900;
let body = `<rect width="1024" height="1024" fill="#fff"/><ellipse cx="512" cy="${ground + 6}" rx="420" ry="20" fill="#00000014"/>`;
// the man: tall; arms come down and forward to hold the big pot against his belly
body += person({ x: 640, y: ground, h: 760, top: "#5ab4e0", trousers: "#2a5d8f", cap: "#b5762f" });
// held low, at the hips, so the body and face stay clear
body += pot(640, ground - 230, 1.55, false) + hands(640, ground - 330, 96, 1.6);
// the boy: small; the same pot, small, held the same way
body += person({ x: 250, y: ground, h: 300, top: "#f2c230", trousers: "#2a5d8f", cap: "#b5762f" });
body += pot(250, ground - 92, 0.6, false) + hands(250, ground - 130, 38, 0.7);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${body}</svg>`;
const out = path.resolve("dev/games/art_candidates/produce");
fs.mkdirSync(out, { recursive: true });
const html = path.join(os.tmpdir(), "kekere_hold.html");
fs.writeFileSync(html, `<body style="margin:0">${svg}</body>`);
spawnSync(process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe", ["--headless=new", "--disable-gpu", "--hide-scrollbars", `--screenshot=${path.join(out, "kekere_hold.png")}`, "--window-size=1024,1024", `file:///${html}`], { stdio: "ignore" });
console.log("wrote kekere_hold");
