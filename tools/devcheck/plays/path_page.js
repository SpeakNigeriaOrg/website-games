// The path page: stones render, the next stone is marked, a stone links to its game with the step's words.
const stones = [...document.querySelectorAll('a.stone')];
const next = document.querySelector('.stone.next');
window.__shot('top');
document.getElementById('grown').click();
await new Promise((r) => setTimeout(r, 300));
window.__shot('grownup');
const bad = stones.filter((a) => !/\/\w+\/\?path=/.test(a.getAttribute('href')));
if (!stones.length || !next || bad.length) throw new Error(`stones ${stones.length}, next ${!!next}, bad links ${bad.length}`);
return `${stones.length} stones, ${document.querySelectorAll('.unit').length} units, next ${next.id}: ${next.getAttribute('href').slice(0, 80)}`;
