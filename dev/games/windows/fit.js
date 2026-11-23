// What Windows can play: the Who-does-what grid's subjects and actions (combo.js), each word passing the path's
// inclusion gates. Pure module: app.js and the path page (Node too) share this one rule.
import { SUBJECTS, ACTIONS, isSubject, isAction } from '../combo.js';

export const fit = {
  game: 'windows',
  job: 'apply', // both heard words matter: every other window shares one of them with the asked pair
  voices: 'any',
  minFocus: 1,
  roundSize: 4,
  curated: [...SUBJECTS, ...ACTIONS].map((x) => x.id),
  canUse(w) { return isSubject(w) || isAction(w); },
};
