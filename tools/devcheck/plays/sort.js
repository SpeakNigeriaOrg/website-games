// Play-through for Sort It with real pointer drags: the ghost hand's teaching parcel, then every parcel dragged to
// its place, one dragged to a wrong place first (it must not fill that place and must come back two parcels later),
// one drag let go over nothing (slides home, no turn spent), to the finale with every place filled.
const g = window.__game, wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (f, ms = 40000) => { const t = Date.now(); while (!f()) { if (Date.now() - t > ms) throw new Error('timeout'); await wait(80); } };
const ready = () => until(() => g.finished || (!g.locked && g.want));
const ptr = (type, target, x, y) => target.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, pointerId: 7, pointerType: 'touch', isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 }));
const mid = (e) => { const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
async function dragTo(x1, y1) {
  const [x0, y0] = mid(g.parcel);
  ptr('pointerdown', g.parcel, x0, y0);
  for (let i = 1; i <= 16; i++) { ptr('pointermove', document.body, x0 + (x1 - x0) * i / 16, y0 + (y1 - y0) * i / 16); await wait(25); }
  ptr('pointerup', document.body, x1, y1);
}
const dragToPlace = (id) => dragTo(...mid(g.placeEl(id)));
const log = [];
await until(() => g.teaching); window.__shot('teaching');
await ready();
log.push('example ' + JSON.stringify(g.filled));
const seen = [];
let missed = null, missedAt = -1, nowhere = false;
for (let i = 0; i < 30 && !g.finished; i++) {
  await ready(); if (g.finished) break;
  seen.push(g.want);
  if (i === 0) window.__shot('turn');
  if (i === 1 && !nowhere) {
    // let go over empty ground: the parcel slides home and the turn goes on
    nowhere = true; const want = g.want;
    await dragTo(innerWidth - 20, innerHeight - 20); await wait(500);
    if (g.locked || g.want !== want) throw new Error('a drop on nothing spent the turn');
    log.push('drop on nothing: back home');
  }
  if (i === 2) {
    missed = g.want; missedAt = seen.length - 1;
    const wrong = g.wrongPlace(), before = g.filled[wrong].length;
    await dragToPlace(wrong); await wait(900); window.__shot('wrong');
    await until(() => !g.want || g.want !== missed || g.finished, 15000);
    if (g.filled[wrong].length !== before) throw new Error('a wrong drop filled the place');
    log.push(`wrong: ${missed} to ${wrong}`);
    continue;
  }
  const place = g.wantPlace, n = g.filled[place].length;
  await dragToPlace(place);
  await until(() => g.filled[place].length === n + 1, 8000);
  if (i === 0) { await wait(600); window.__shot('right'); }
}
await until(() => g.finished, 20000);
const back = seen.indexOf(missed, missedAt + 1);
if (back - missedAt !== 3) throw new Error(`missed parcel came back ${back - missedAt - 1} parcels later (order ${seen.join(',')})`);
const placed = Object.values(g.filled).flat().length;
if (placed !== g.total + 1) throw new Error(`placed ${placed}, expected ${g.total} + the example`);
await wait(900); window.__shot('finale');
return `${log.join(' | ')} | places ${g.places} | turns ${seen.length} | clean ${g.clean}/${g.total} | strip ${document.querySelectorAll('.progress-strip .slot.filled').length}`;
