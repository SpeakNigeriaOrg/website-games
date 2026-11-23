// Screenshots down the path page: the first stones, a unit banner, the animals unit.
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const units = [...document.querySelectorAll('.unit')];
document.querySelector('.stone.next').scrollIntoView({ block: 'center' }); await wait(500); window.__shot('first-stones'); await wait(400);
units[1].scrollIntoView({ block: 'start' }); await wait(500); window.__shot('body-unit'); await wait(400);
const animals = units.find((u) => u.querySelector('img.scene[src*="animals"]'));
animals.scrollIntoView({ block: 'start' }); window.scrollBy(0, 300); await wait(500); window.__shot('animals'); await wait(400);
return `${units.length} units`;
