// Verbs whose kit picture clearly shows the action to a young child (each picture looked at, 2026-11-17; the seven
// replaced on 2026-11-20 looked at again that day). Shared by the games that take verbs as pictures (Silly Parrot
// and Gate Rally's pictures mode), so there is one list; Stretchy and the path builder keep REJECTED out of
// teaching. MOTION names the gentle loop that suits each action.
// Pure module: Node imports it too.
// Rejected after looking (REJECTED below, with the reason): the picture does not show the verb, so no game teaches
// with it.
//   Not one word: fi_sile_leave_it and the other commands with objects (má sunkún, nù ú, mu omi, ...).
//   No picture: mo_know, nu_away, wo_wear (wọ̀ has no picture in the kit; its entry stays here for when it does).
export const REJECTED = {
  wa_come: 'a man holding out an open hand (reads as "give" or "hand"; looked at again 2026-11-20, unchanged)',
  fun_give: 'a man walking with a gift box (reads as "carry"; looked at again 2026-11-20, unchanged)',
  dide_stand: 'a man standing next to a chair (just standing there, not getting up; looked at again 2026-11-20, unchanged)',
  sere_play: 'a man behind a big die (looked at again 2026-11-20, unchanged)',
  te_press: 'a finger on a phone (the phone, not pressing)',
  to_urinate: 'a man beside a toilet (unclear, unsuitable)',
  ja_to_pluck_off: 'a hand holding an apple',
  kun_growl: 'a wolf howling at the moon (reads as "howl")',
  ran_send: 'the judge doubted it (imageCheck: "to deliver")',
};
// Pictures that do show the verb, but repeat another verb's picture: fine where there is no choice to make (Stretchy),
// kept out of the picture-choice games (Parrot, Rally's pictures), where the two would be told apart only by luck.
export const DUPLICATE = {
  sunkun_weep: 'same meaning and nearly the same picture as sun_to_cry, and an extra sound in the take',
  irin_walk: 'ìrìn "walk; stroll" (a walk), same picture idea as rin_to_walk, the verb',
};
export const MOTION = {
  sun_to_sleep: 'breathe',        // sleeping under a blanket
  sare_run: 'run',                // runner mid-stride
  rin_to_walk: 'walk',            // walking legs in a park
  ra_crawl: 'crawl',              // baby on hands and knees
  jokoo_sit: 'settle',            // a round figure sitting on the floor
  jeun_eat: 'nod',                // child eating rice with a spoon
  mu_to_drink: 'sip',             // drinking from a bottle
  sun_to_cry: 'sob',              // face with big tears
  'rerin-in_laugh': 'giggle',     // child laughing
  patewo_clap: 'clap',            // two hands clapping
  gbo_to_bark: 'bark',            // dog barking
  we_to_bathe: 'scrub',           // child washing hair in the shower
  wo_wear: 'stretch',             // pulling a shirt on over the head (no picture in the kit now: no game can use it)
  di_bind: 'tug',                 // tying shoelaces
  ru_carry: 'heave',              // people carrying a big pot together
  dana_cook: 'stir',              // stirring a pot
  nu_clean: 'wipe',               // wiping a table with a cloth (line drawing)
  wo_to_look: 'gaze',             // man looking up at a bird
  so_throw: 'throw',              // throwing a ball at a target
  peja_to_fish: 'sway',           // fishing from a rock
  pana_extinguish_fire: 'spray',  // fire extinguisher on a burning bin
  ro_think: 'ponder',             // hand on chin, puzzle piece
  // replaced 2026-11-20, each looked at:
  ra_buy: 'nod',                  // a woman holding a bag of tomatoes at a stall, the seller holding out the money
  gba_to_take: 'settle',          // a boy taking a cup and saucer handed to him
  mu_take: 'nod',                 // a girl reaching into a basket of oranges for one
  kan_touch: 'settle',            // a fingertip touching a soap bubble
  lo_go: 'walk',                  // a boy with a backpack walking away up a path, waving
  luwe_swim: 'sway',              // a child swimming
  pa_kill: 'settle',              // a fly swatter over a dead fly (the root verb "kill"; never shown with paná)
  se_to_do: 'nod',                // one boy with four arms: stirring, hammering, painting, sweeping (owner-supplied)
};
export const VERBS = Object.keys(MOTION);
/** Verbs never shown together (their pictures or meanings are too close). gbà and mú are both "take" (a cup
 * handed over, an orange picked up); lọ's boy walks away up a path, rìn's legs walk in a park. */
export const VERB_APART = [['sare_run', 'rin_to_walk'], ['jeun_eat', 'dana_cook'], ['we_to_bathe', 'wo_wear'], ['pa_kill', 'pana_extinguish_fire'],
  ['gba_to_take', 'mu_take'], ['lo_go', 'rin_to_walk']];
