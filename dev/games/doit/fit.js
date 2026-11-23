// What Do It! can play: the commands it can act out on the table. The objects there are neutral props, not
// words the round asks. Pure module: app.js and the path page (Node too) share this one rule.

export const CMDS = {
  hold: 'dii_mu_hold',
  dont: 'ma_fowo_kan_an_no_touch',
  wipe: 'nu_u_cleanit',
  throw: 'so_o_nu_throw_away',
  put: 'fi_sile_leave_it',
};
/** Commands by level: 1 = hold vs don't; 2 = wipe vs throw vs don't; 3 = all five. */
export const LEVELS = { 1: ['hold', 'dont'], 2: ['wipe', 'throw', 'dont'], 3: ['hold', 'wipe', 'throw', 'put', 'dont'] };

export const usable = (w) => !!(w && w.audio);

export const fit = {
  game: 'doit',
  job: 'practice',
  voices: 'any',
  minFocus: 1,
  roundSize: 2,
  curated: LEVELS[3].map((k) => CMDS[k]),
  canUse(w) { return usable(w) && this.curated.includes(w.id); },
};
