// What Help Grandma can play: the commands the helper boy can carry out in the kitchen, each with its own thing there
// (the spill, the paper, the baby, the bowl, the hot pot). Pure module: app.js and the path page (Node too) share it.

export const CMDS = {
  wipe: 'nu_u_cleanit',
  throw: 'so_o_nu_throw_away',
  hold: 'dii_mu_hold',
  put: 'fi_sile_leave_it',
  dont: 'ma_fowo_kan_an_no_touch',
};
/** The thing each command is about, and the pictures: the thing in the kitchen, and the boy doing it. "Don't touch"
 * shows him reaching for the hot pot and then pulling his hands back. */
export const THINGS = {
  wipe: { thing: 'spill', act: ['wipe'] },
  throw: { thing: 'paper', act: ['throw'] },
  hold: { thing: 'baby', act: ['hold'] },
  put: { thing: 'bowl', act: ['put'] },
  dont: { thing: 'pot', act: ['reach', 'stop'] },
};
/** Commands by level: 1 = three far apart in meaning (wipe, throw away, hold); 2 = and "don't touch"; 3 = all five. */
export const LEVELS = { 1: ['wipe', 'throw', 'hold'], 2: ['wipe', 'throw', 'hold', 'dont'], 3: ['wipe', 'throw', 'hold', 'put', 'dont'] };

export const usable = (w) => !!(w && w.audio && (!w.inclusion || w.inclusion.path === 'included'));

export const fit = {
  game: 'helper',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 3,
  curated: LEVELS[3].map((k) => CMDS[k]),
  canUse(w) { return usable(w) && this.curated.includes(w.id); },
};
